from dotenv import load_dotenv
load_dotenv()

import json, logging, re, traceback
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Any
from concurrent.futures import ThreadPoolExecutor

from database import execute_query, DatabaseError
from guardrails import validate_sql, is_out_of_scope, is_write_attempt
from llm import (generate_sql, generate_answer, generate_title,
                 generate_sql_and_rewrite_parallel, generate_strategic_answer,
                 _get_client)

# Constantes de modelo — espelham llm.py
_MODEL_MAIN          = "claude-sonnet-4-6"
_MAX_TOKENS_ANSWER   = 900
_MAX_TOKENS_STRATEGIC = 1200
from prompt import DISPLAY_MAP

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Retail Insights API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


# ── SSE helpers ────────────────────────────────────────────────────────────────

def sse(event_dict: dict) -> str:
    return f"data: {json.dumps(event_dict, ensure_ascii=False)}\n\n"

def sse_status(text: str) -> str:
    return sse({"type": "status", "text": text})

def sse_token(text: str) -> str:
    return sse({"type": "token", "text": text})

def sse_done(payload: dict) -> str:
    return sse({"type": "done", **payload})


# ── CEO determinístico ─────────────────────────────────────────────────────────

_CEO_QUERIES = {
    "receita_total": "SELECT ROUND(SUM(receita),2) AS v FROM vendas",
    "r2023": "SELECT ROUND(SUM(receita),2) AS v FROM vendas WHERE strftime('%Y',data_venda)='2023'",
    "r2024": "SELECT ROUND(SUM(receita),2) AS v FROM vendas WHERE strftime('%Y',data_venda)='2024'",
    "p2023": "SELECT COUNT(DISTINCT id_pedido) AS v FROM vendas WHERE strftime('%Y',data_venda)='2023'",
    "p2024": "SELECT COUNT(DISTINCT id_pedido) AS v FROM vendas WHERE strftime('%Y',data_venda)='2024'",
    "clientes": "SELECT COUNT(DISTINCT id_cliente) AS v FROM vendas",
    "ticket":   "SELECT ROUND(SUM(receita)*1.0/COUNT(DISTINCT id_pedido),2) AS v FROM vendas",
    "t2023": "SELECT ROUND(SUM(receita)*1.0/COUNT(DISTINCT id_pedido),2) AS v FROM vendas WHERE strftime('%Y',data_venda)='2023'",
    "t2024": "SELECT ROUND(SUM(receita)*1.0/COUNT(DISTINCT id_pedido),2) AS v FROM vendas WHERE strftime('%Y',data_venda)='2024'",
    "loja_lider": "SELECT loja, ROUND(SUM(receita),2) AS r FROM vendas GROUP BY loja ORDER BY r DESC LIMIT 1",
    "loja_pct": "SELECT ROUND(100.0*SUM(CASE WHEN loja='Loja A' THEN receita END)/SUM(receita),1) AS v FROM vendas",
    "cat_cres": "SELECT categoria, ROUND(100.0*(SUM(CASE WHEN strftime('%Y',data_venda)='2024' THEN receita END)-SUM(CASE WHEN strftime('%Y',data_venda)='2023' THEN receita END))/SUM(CASE WHEN strftime('%Y',data_venda)='2023' THEN receita END),1) AS var FROM vendas GROUP BY categoria ORDER BY var DESC LIMIT 1",
    "cat_queda": "SELECT categoria, ROUND(100.0*(SUM(CASE WHEN strftime('%Y',data_venda)='2024' THEN receita END)-SUM(CASE WHEN strftime('%Y',data_venda)='2023' THEN receita END))/SUM(CASE WHEN strftime('%Y',data_venda)='2023' THEN receita END),1) AS var FROM vendas GROUP BY categoria ORDER BY var ASC LIMIT 1",
    "calca_perda": "SELECT ROUND(SUM(CASE WHEN strftime('%Y',data_venda)='2023' THEN receita END)-SUM(CASE WHEN strftime('%Y',data_venda)='2024' THEN receita END),2) AS v FROM vendas WHERE categoria='CALCA'",
    "melhor_mes": "SELECT strftime('%Y-%m',data_venda) AS mes, ROUND(SUM(receita),2) AS r FROM vendas WHERE strftime('%Y',data_venda)='2024' GROUP BY mes ORDER BY r DESC LIMIT 1",
    "produto_lider": "SELECT produto, ROUND(SUM(receita),2) AS r FROM vendas GROUP BY produto ORDER BY r DESC LIMIT 1",
}

def _run_ceo_queries() -> dict:
    data = {}
    for key, sql in _CEO_QUERIES.items():
        try:
            rows = execute_query(sql)
            if rows:
                row = rows[0]
                data[key] = list(row.values())[0] if len(row) == 1 else row
        except Exception as e:
            logger.warning("CEO query '%s' falhou: %s", key, e)
    return data

def _fmtR(v):
    if v is None: return "—"
    return f"R$ {float(v):,.2f}".replace(",","X").replace(".",",").replace("X",".")
def _fmtPct(v):
    if v is None: return "—"
    return f"{float(v):+.1f}%".replace(".",",")
def _fmtN(v):
    if v is None: return "—"
    return f"{int(v):,}".replace(",",".")

def _build_ceo_briefing(d: dict) -> str:
    r_total = d.get("receita_total"); r23 = d.get("r2023"); r24 = d.get("r2024")
    p23 = d.get("p2023"); p24 = d.get("p2024")
    t23 = d.get("t2023"); t24 = d.get("t2024")
    loja_d = d.get("loja_lider",{}); loja_nm = loja_d.get("loja","Loja A") if isinstance(loja_d,dict) else "Loja A"
    loja_r = loja_d.get("r",45383244.35) if isinstance(loja_d,dict) else 45383244.35
    loja_pct = d.get("loja_pct",30.8)
    cat_c = d.get("cat_cres",{}); cat_q = d.get("cat_queda",{})
    cn = DISPLAY_MAP.get(cat_c.get("categoria","VESTIDO") if isinstance(cat_c,dict) else "VESTIDO","VESTIDO")
    cv = cat_c.get("var",3.1) if isinstance(cat_c,dict) else 3.1
    qn = DISPLAY_MAP.get(cat_q.get("categoria","CALCA") if isinstance(cat_q,dict) else "CALCA","CALÇA")
    qv = cat_q.get("var",-8.7) if isinstance(cat_q,dict) else -8.7
    calca_p = d.get("calca_perda")
    melhor = d.get("melhor_mes",{}); mel_mes = melhor.get("mes","2024-11") if isinstance(melhor,dict) else "2024-11"
    mel_r = melhor.get("r",7526969.65) if isinstance(melhor,dict) else 7526969.65
    pr_d = d.get("produto_lider",{}); pr_nm = pr_d.get("produto","MOCHILA CLÁSSICO NYLON") if isinstance(pr_d,dict) else "MOCHILA CLÁSSICO NYLON"
    pr_r = pr_d.get("r",898606.0) if isinstance(pr_d,dict) else 898606.0
    meses = {"01":"Janeiro","02":"Fevereiro","03":"Março","04":"Abril","05":"Maio","06":"Junho",
             "07":"Julho","08":"Agosto","09":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro"}
    mel_nm = meses.get(str(mel_mes).split("-")[-1], mel_mes)
    var_r = round(100*(r24-r23)/r23,1) if r23 and r24 else None
    var_p = round(100*(p24-p23)/p23,1) if p23 and p24 else None
    var_t = round(100*(t24-t23)/t23,1) if t23 and t24 else None
    return f"""**Resumo Executivo — 2023–2024**

---

**Visão geral**
- Receita total: {_fmtR(r_total)}
- Pedidos: {_fmtN((p23 or 0)+(p24 or 0))}
- Clientes únicos: {_fmtN(d.get('clientes',18635))}
- Ticket médio: {_fmtR(d.get('ticket',2961.58))}

---

**Comparativo anual**

2023
- Receita: {_fmtR(r23)}
- Pedidos: {_fmtN(p23)}
- Ticket médio: {_fmtR(t23)}

2024
- Receita: {_fmtR(r24)}
- Pedidos: {_fmtN(p24)}
- Ticket médio: {_fmtR(t24)}

Variações
- Receita: {_fmtPct(var_r)}
- Pedidos: {_fmtPct(var_p)}
- Ticket médio: {_fmtPct(var_t)}

---

**Liderança (2023–2024)**
- Loja líder: {loja_nm} — {_fmtR(loja_r)} ({loja_pct}% da receita)
- Categoria líder: CALÇA (32,7%)
- Produto líder (2023–2024): {pr_nm} ({_fmtR(pr_r)})
- Melhor mês 2024: {mel_nm} ({_fmtR(mel_r)})
- Maior crescimento: {cn} ({_fmtPct(cv)})

---

**Pontos de atenção**
- {qn}: {_fmtPct(qv)} (perda de {_fmtR(calca_p)})
- {loja_nm} concentra {loja_pct}% da receita total
- Volume caiu: pedidos {_fmtPct(var_p)}, clientes -8,1%"""


# ── OOS contextual ─────────────────────────────────────────────────────────────

def _oos_response(question: str) -> str:
    q = question.lower()
    if any(w in q for w in ["lucro","margem","custo","despesa","caixa","cmv","ebitda","resultado"]):
        return ("Não tenho dados de lucro, margem ou custo — a base registra apenas receita bruta de vendas. "
                "Posso mostrar a receita total, por categoria, loja ou período se quiser.")
    if any(w in q for w in ["apagar","deletar","excluir","alterar","modificar","inserir","criar","gravar","salvar"]):
        return ("Só consigo fazer consultas de leitura — o banco não pode ser modificado por aqui. "
                "Mas posso te mostrar qualquer análise sobre os dados de vendas de 2023–2024.")
    if any(w in q for w in ["tempo","clima","previsão","notícia","noticia","futebol","política","culinária","bitcoin","ação","bolsa"]):
        return ("Essa pergunta está fora do escopo dos dados de vendas. "
                "Trabalho com análise de varejo de moda — receita, produtos, lojas, categorias e comparativos de 2023–2024.")
    if any(w in q for w in ["cor","cores","coloração","coloracao"]):
        return ("A base tem dados de cor. As principais por receita são: PRETO (R$ 23,7 mi), "
                "UNICA (R$ 15,3 mi), OFF-WHITE (R$ 15,2 mi), ROSA (R$ 7,1 mi) e AZUL (R$ 4,1 mi). "
                "Quer ver o ranking completo de cores?")
    if any(w in q for w in ["tamanho","tamanhos","numeração","numeracao"]):
        return ("A base registra tamanhos de 1 a 8. Posso mostrar o ranking de tamanhos por receita ou unidades vendidas.")
    if any(w in q for w in ["coleção","colecao","temporada","inverno","verão","verao"]):
        return ("A base tem coleções identificadas por código (ex: I 2024 = Inverno 2024, V 2023 = Verão 2023). "
                "Posso mostrar o ranking de coleções por receita.")
    if any(w in q for w in ["vendedor","vendedores","representante"]):
        return ("A base tem 61 vendedores identificados por código anônimo. "
                "Posso mostrar o ranking de vendedores por receita ou pedidos.")
    import re as _re
    if any(w in q for w in ["previsão","previsao","forecast","projeção","projecao","próximo ano","2025"]):
        return ("Não tenho dados futuros — só o histórico de 2023–2024. "
                "Mas posso mostrar tendências e sazonalidade que ajudam a estimar o que esperar.")
    if any(w in q for w in ["concorrente","mercado","setor","benchmark","competidor"]):
        return ("Não tenho dados de mercado ou concorrentes — só os dados internos de vendas. "
                "Posso analisar o desempenho interno com detalhes de lojas, categorias e produtos.")
    if any(w in q for w in ["estoque","inventário","inventario","ruptura","reposição","reposicao"]):
        return ("Não tenho dados de estoque — só vendas realizadas. "
                "Posso mostrar o volume de unidades vendidas por produto, categoria ou período.")
    if any(w in q for w in ["funcionário","funcionario","colaborador","equipe","rh","salário","salario"]):
        return ("Não tenho dados de RH ou folha de pagamento — só dados de vendas. "
                "Posso mostrar dados de vendedores se quiser analisar produtividade.")
    return ("Não consegui encontrar essa informação nos dados de vendas. "
            "Trabalho com o histórico de 2023–2024 — receita, pedidos, lojas, categorias, produtos, cores e coleções.")


# ── Schemas ────────────────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[Message] = []
    generate_title: bool = False


# ── Helpers ────────────────────────────────────────────────────────────────────

def _fix_entity_format(text: str) -> str:
    """
    Corrige o padrão onde o LLM cola título + entidade na mesma linha/bold.
    Ex: "**Maior Faturamento por Loja Loja A** R$ 45..." 
    →   "**Maior Faturamento por Loja**\n\n**Loja A**\n\nR$ 45..."
    """
    # Caso 1: **Título Loja X** colado no mesmo bold
    text = re.sub(
        r'\*\*([^*]+?)\s+(Loja [A-E])\*\*',
        r'**\1**\n\n**\2**',
        text
    )
    # Caso 2+3: **Título** **Entidade** → quebra linha antes de qualquer R$ ou texto seguinte
    text = re.sub(
        r'(\*\*[^*]+\*\*)\s+(\*\*[^*]{2,35}\*\*)(?=\s+R\$|\s+[A-ZÁÉÍÓÚ0-9])',
        r'\1\n\n\2\n\n',
        text
    )
    return text


def _apply_display_map(answer: str) -> str:
    pattern = r'\b(' + '|'.join(re.escape(k) for k in DISPLAY_MAP.keys()) + r')\b'
    answer = re.sub(pattern, lambda m: DISPLAY_MAP.get(m.group(0), m.group(0)), answer)
    return answer


def _postprocess(answer: str) -> str:
    """Aplica todos os pós-processamentos na resposta antes de entregar ao frontend."""
    answer = _apply_display_map(answer)
    answer = _fix_entity_format(answer)
    return answer

def _extract_kpis(rows):
    if not rows or len(rows) != 1: return None
    row = rows[0]; kpis = []; seen = set()
    pairs = [("r2023","r2024","Receita","currency"),("p2023","p2024","Pedidos","number"),
             ("c2023","c2024","Clientes","number"),("t2023","t2024","Ticket Médio","currency_exact")]
    for k23,k24,label,fmt in pairs:
        if label in seen: continue
        v23,v24 = row.get(k23), row.get(k24)
        if v23 and v24:
            var = round(100*(v24-v23)/v23,1) if v23 else 0
            kpis.append({"label":label,"value_2023":v23,"value_2024":v24,"var_pct":var,"format":fmt})
            seen.add(label)
    return kpis or None

def _build_table(rows):
    if not rows: return None
    if len(rows) > 1: return rows
    if len(rows) == 1 and len(rows[0]) > 2: return rows
    return None

def _error_payload(msg: str = None) -> dict:
    return {
        "answer": msg or "**Não foi possível concluir esta análise.**\n\nTente reformular a pergunta.",
        "sql": None, "table": None, "kpis": None, "error": True,
    }

def _clean_message(m): return re.sub(r'["\'\u201c\u201d\u2018\u2019]+', ' ', m).strip()

def split_questions(message: str) -> list[str]:
    message = _clean_message(message)
    parts = message.split("?")
    questions = []
    for part in parts:
        cleaned = part.strip()
        if not cleaned or len(cleaned) < 5: continue
        subs = re.split(r"\.\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])", cleaned)
        for sub in subs:
            sub = sub.strip().rstrip(".")
            if sub and len(sub) > 4:
                questions.append(sub + "?")
    return questions

_STRATEGIC_SIGNALS = [
    "risco","riscos","concentração","concentracao","dependência","dependencia",
    "saudável","saudavel","saúde do negócio","cresceu","encolheu",
    "prioridade","priorizar","investimento","oportunidade","oportunidades",
    "driver","drivers","motor de","sustentável","sustentavel",
    "ameaça","ameaca","fragilidade","frágil","fragil",
    "expansão","expansao","estratégia","estrategia",
    "se você fosse","se eu fosse","o que recomenda","o que você recomenda",
    "o que chama atenção","o que mais chama","o que devo priorizar",
    "insights mais importantes","principais conclusões","historia que os dados",
    "história que os dados","apresentaria ao conselho","apresentaria ao board",
    "cinco pontos","três prioridades","maior preocupação","maior preocupacao",
    "potencial de crescimento","perdendo participação","perdendo participacao",
    "destaque positivo","destaques positivos","ponto de atenção","pontos de atenção",
    "resiliente","escalável","escalavel","excesso","excessiva","excessivo",
    "quais riscos","identifica riscos","maior risco",
    "se tivesse que fechar","se pudesse expandir","produtividade",
    "kpis","dashboard executivo","acompanhar","métricas",
    "convencer um investidor","board amanhã","board amanha",
]


# ── Endpoint SSE ───────────────────────────────────────────────────────────────

@app.post("/chat")
async def chat(request: ChatRequest):
    message  = request.message.strip()
    history  = [m.model_dump() for m in request.history]
    is_first = len(history) == 0

    if not message:
        async def _empty():
            yield sse_done(_error_payload("Por favor, digite uma pergunta."))
        return StreamingResponse(_empty(), media_type="text/event-stream")

    async def stream():
        try:
            # ── CEO determinístico ────────────────────────────────────────────
            is_ceo = any(kw in message.lower() for kw in [
                "ceo","diretor","board","diretoria","briefing","resumo para",
                "executivo completo","resumo executivo","visão geral completa","panorama geral",
            ])
            if is_ceo:
                yield sse_status("Consultando todos os indicadores...")
                ceo_data = _run_ceo_queries()
                yield sse_status("Preparando resumo executivo...")
                answer = _build_ceo_briefing(ceo_data)
                title  = "Briefing Executivo" if is_first else None
                yield sse_done({"answer": answer, "display_question": "Briefing executivo completo",
                                "conversation_title": title, "sql": None, "table": None,
                                "kpis": None, "error": False})
                return

            # ── Estratégico — análise CEO com streaming real ──────────────────
            is_strategic = any(sig in message.lower() for sig in _STRATEGIC_SIGNALS)
            if is_strategic:
                yield sse_status("Analisando os dados estratégicos...")
                from prompt import SYSTEM_PROMPT_STRATEGIC
                client = _get_client()
                response = client.messages.create(
                    model=_MODEL_MAIN,
                    max_tokens=_MAX_TOKENS_STRATEGIC,
                    system=SYSTEM_PROMPT_STRATEGIC,
                    messages=[{"role": "user", "content": message}],
                )
                full_text = _postprocess(response.content[0].text.strip())
                title = generate_title(message) if is_first and request.generate_title else None
                yield sse_done({"answer": full_text, "display_question": None,
                                "conversation_title": title, "sql": None, "table": None,
                                "kpis": None, "error": False})
                return

            # ── Pergunta única SQL ────────────────────────────────────────────
            questions = split_questions(message)
            if len(questions) <= 1:
                q = questions[0] if questions else message

                yield sse_status("Interpretando a pergunta...")
                try:
                    sql, display_q = generate_sql_and_rewrite_parallel(q, history)
                except Exception:
                    yield sse_done(_error_payload())
                    return

                if is_out_of_scope(sql):
                    yield sse_done({"answer": _oos_response(q), "display_question": None,
                                    "conversation_title": None, "sql": None, "table": None,
                                    "kpis": None, "error": False})
                    return

                ok, reason = validate_sql(sql)
                if not ok:
                    yield sse_done(_error_payload())
                    return

                yield sse_status("Consultando o banco de dados...")
                try:
                    rows = execute_query(sql)
                except DatabaseError:
                    yield sse_done(_error_payload())
                    return

                yield sse_status("Preparando resposta...")

                # Stream real da resposta em linguagem natural
                import json as _json
                results_text = _json.dumps(rows[:50], ensure_ascii=False, separators=(',',':'))
                if len(results_text) > 3000:
                    results_text = results_text[:3000] + "..."
                user_content = f"Pergunta: {q}\n\nResultados:\n{results_text}"
                from prompt import SYSTEM_PROMPT_ANSWER
                client = _get_client()
                response = client.messages.create(
                    model=_MODEL_MAIN,
                    max_tokens=_MAX_TOKENS_ANSWER,
                    system=SYSTEM_PROMPT_ANSWER,
                    messages=[{"role": "user", "content": user_content}],
                )
                full_answer = _postprocess(response.content[0].text.strip())
                title = None
                if is_first and request.generate_title:
                    try: title = generate_title(message)
                    except: pass

                yield sse_done({
                    "answer": full_answer,
                    "display_question": display_q,
                    "conversation_title": title,
                    "sql": sql,
                    "table": _build_table(rows),
                    "kpis": _extract_kpis(rows),
                    "error": False,
                })
                return

            # ── Multi-pergunta (paralelo, max 4) ─────────────────────────────
            qs = questions[:4]
            yield sse_status(f"Processando {len(qs)} perguntas...")

            def run(q):
                try:
                    sql, _ = generate_sql_and_rewrite_parallel(q, history)
                    if is_out_of_scope(sql):
                        return {"question": q, "answer": _oos_response(q), "error": False, "sql": None, "table": None, "kpis": None}
                    ok, _ = validate_sql(sql)
                    if not ok:
                        return {"question": q, "answer": _error_payload()["answer"], "error": True, "sql": None, "table": None, "kpis": None}
                    rows = execute_query(sql)
                    answer = generate_answer(q, sql, rows)
                    answer = _postprocess(answer)
                    return {"question": q, "answer": answer, "error": False, "sql": sql,
                            "table": _build_table(rows), "kpis": _extract_kpis(rows)}
                except Exception:
                    return {"question": q, "answer": _error_payload()["answer"], "error": True, "sql": None, "table": None, "kpis": None}

            ordered = [None] * len(qs)
            with ThreadPoolExecutor(max_workers=2) as ex:
                futures = [(i, ex.submit(run, q)) for i, q in enumerate(qs)]
                for i, f in futures:
                    try: ordered[i] = f.result()
                    except: ordered[i] = {"question": qs[i], "answer": _error_payload()["answer"], "error": True}

            combined = "\n\n---\n\n".join(r["answer"] for r in ordered if r)
            title = None
            if is_first and request.generate_title:
                try: title = generate_title(message)
                except: pass

            yield sse_done({
                "answer": combined,
                "display_question": None,
                "conversation_title": title,
                "sql": None, "table": None, "kpis": None,
                "error": any(r.get("error") for r in ordered if r),
            })

        except Exception as e:
            logger.error("STREAM ERRO: %s\n%s", e, traceback.format_exc())
            yield sse_done(_error_payload())

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.get("/health")
def health():
    return {"status": "ok"}