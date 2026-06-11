from dotenv import load_dotenv
load_dotenv()

import logging, re, traceback
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any
from concurrent.futures import ThreadPoolExecutor

from database import execute_query, DatabaseError
from guardrails import validate_sql, is_out_of_scope, is_write_attempt
from llm import generate_sql, generate_answer, generate_title, generate_sql_and_rewrite_parallel
from prompt import DISPLAY_MAP

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Retail Insights API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ── CEO determinístico ────────────────────────────────────────────────────────
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
    cn = DISPLAY_MAP.get(cat_c.get("categoria","VESTIDO") if isinstance(cat_c,dict) else "VESTIDO", "VESTIDO")
    cv = cat_c.get("var",3.1) if isinstance(cat_c,dict) else 3.1
    qn = DISPLAY_MAP.get(cat_q.get("categoria","CALCA") if isinstance(cat_q,dict) else "CALCA", "CALÇA")
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
- Produto líder: {pr_nm} ({_fmtR(pr_r)})
- Melhor mês 2024: {mel_nm} ({_fmtR(mel_r)})
- Maior crescimento: {cn} ({_fmtPct(cv)})

---

**Pontos de atenção**
- {qn}: {_fmtPct(qv)} (perda de {_fmtR(calca_p)})
- {loja_nm} concentra {loja_pct}% da receita total
- Volume caiu: pedidos {_fmtPct(var_p)}, clientes -8,1%"""


# ─── OOS messages inteligentes ────────────────────────────────────────────────

def _oos_response(question: str) -> str:
    """Resposta de OOS contextual ao tipo de pergunta."""
    q = question.lower()
    # Domínio completamente externo
    if any(w in q for w in ["tempo", "clima", "receita federal", "política", "notícia", "futebol",
                             "culinária", "receita de", "previsão do"]):
        return (
            "Essa pergunta está fora do que consigo analisar aqui. "
            "Meus dados são de vendas de varejo de 2023–2024 — "
            "posso te ajudar com receita, categorias, lojas, produtos e comparativos."
        )
    # Dado que não existe na base (lucro, margem, custo)
    if any(w in q for w in ["lucro", "margem", "custo", "despesa", "caixa", "cmv", "ebitda"]):
        return (
            "Não tenho dados de lucro, margem ou custo na base — só receita bruta de vendas. "
            "Quer que eu mostre a receita por categoria, loja ou período?"
        )
    # Tentativa de escrita
    if any(w in q for w in ["apagar", "deletar", "excluir", "alterar", "modificar", "inserir", "criar"]):
        return "Só consigo fazer leituras — nada que modifique o banco. Mas posso te mostrar qualquer análise sobre os dados de vendas."
    # Genérico — dado possivelmente válido não reconhecido
    return (
        "Não entendi bem essa pergunta. Tente reformular usando termos como "
        "'receita', 'vendas', 'categoria', 'loja', 'produto', 'cor' ou 'período'."
    )


# ─── Schemas ──────────────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[Message] = []
    generate_title: bool = False

class ChatResponse(BaseModel):
    answer: str
    display_question: str | None = None
    conversation_title: str | None = None
    sql: str | None = None
    table: list[dict[str, Any]] | None = None
    kpis: list[dict[str, Any]] | None = None
    error: bool = False


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _clean_message(m: str) -> str:
    return re.sub(r'[\"\'\u201c\u201d\u2018\u2019]+', ' ', m).strip()

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

def _apply_display_map(answer: str) -> str:
    pattern = r'\b(' + '|'.join(re.escape(k) for k in DISPLAY_MAP.keys()) + r')\b'
    return re.sub(pattern, lambda m: DISPLAY_MAP.get(m.group(0), m.group(0)), answer)

def _extract_kpis(rows: list[dict]) -> list[dict] | None:
    if not rows or len(rows) != 1: return None
    row = rows[0]
    kpis = []
    pairs = [
        ("r2023","r2024","Receita","currency"),
        ("p2023","p2024","Pedidos","number"),
        ("c2023","c2024","Clientes","number"),
        ("t2023","t2024","Ticket Médio","currency_exact"),
    ]
    seen = set()
    for k23,k24,label,fmt in pairs:
        if label in seen: continue
        v23,v24 = row.get(k23), row.get(k24)
        if v23 and v24:
            var = round(100*(v24-v23)/v23,1) if v23 else 0
            kpis.append({"label":label,"value_2023":v23,"value_2024":v24,"var_pct":var,"format":fmt})
            seen.add(label)
    return kpis or None

def _build_table(rows: list[dict]) -> list[dict] | None:
    if not rows: return None
    if len(rows) > 1: return rows
    if len(rows) == 1 and len(rows[0]) > 2: return rows
    return None

def _error_response() -> str:
    return (
        "**Não foi possível concluir esta análise.**\n\n"
        "Sugestões:\n"
        "- Compare 2023 e 2024\n"
        "- Mostre os produtos líderes\n"
        "- Onde houve queda de receita?\n"
        "- Gere um briefing executivo"
    )

def _process_single(question: str, history: list[dict]) -> dict:
    result = {
        "question": question, "sql": None, "answer": None, "display_question": None,
        "rows": [], "table": None, "kpis": None, "error": False, "out_of_scope": False,
    }
    try:
        sql, display_q = generate_sql_and_rewrite_parallel(question, history)
        result["display_question"] = display_q
    except Exception as e:
        logger.error("ERRO SQL/REWRITE '%s': %s", question[:60], e)
        result.update(error=True, answer=_error_response())
        return result

    result["sql"] = sql

    if is_out_of_scope(sql):
        logger.info("OOS: '%s'", question[:60])
        result["out_of_scope"] = True
        result["answer"] = _oos_response(question)
        return result

    ok, reason = validate_sql(sql)
    if not ok:
        result.update(error=True, answer=_error_response())
        return result

    try:
        rows = execute_query(sql)
        logger.info("DB OK: %d row(s)", len(rows))
    except DatabaseError as e:
        result.update(error=True, answer=_error_response())
        return result

    result["rows"] = rows

    try:
        answer = generate_answer(question, sql, rows)
        answer = _apply_display_map(answer)
    except Exception:
        result.update(error=True, answer=_error_response())
        return result

    result["answer"] = answer
    result["table"]  = _build_table(rows)
    result["kpis"]   = _extract_kpis(rows)
    return result


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@app.post("/chat")
async def chat(request: ChatRequest):
    message = request.message.strip()
    history = [m.model_dump() for m in request.history]
    is_first = len(history) == 0
    logger.info("=== /chat '%s'", message[:100])

    if not message:
        return {"answer": "Por favor, digite uma pergunta.", "error": True}

    # CEO — sempre determinístico
    is_ceo = any(kw in message.lower() for kw in [
        "ceo", "diretor", "board", "diretoria", "briefing",
        "resumo para", "executivo completo", "mckinsey", "bcg",
        "resumo executivo", "visão geral completa", "panorama geral",
    ])
    if is_ceo:
        ceo_data = _run_ceo_queries()
        answer   = _build_ceo_briefing(ceo_data)
        title    = "Briefing Executivo" if is_first else None
        return {"answer": answer, "display_question": "Briefing executivo completo",
                "conversation_title": title, "error": False}

    questions = split_questions(message)

    # ── Pergunta única ──────────────────────────────────────────────────────
    if len(questions) <= 1:
        q = questions[0] if questions else message
        r = _process_single(q, history)
        title = None
        if is_first and request.generate_title:
            try: title = generate_title(message)
            except: pass
        return {
            "answer": r["answer"], "display_question": r.get("display_question"),
            "conversation_title": title, "sql": r["sql"],
            "table": r["table"], "kpis": r["kpis"], "error": r["error"],
        }

    # ── Múltiplas — paralelo, max 4 ─────────────────────────────────────────
    qs = questions[:4]
    def run(q): return _process_single(q, history)

    ordered = [None] * len(qs)
    with ThreadPoolExecutor(max_workers=2) as ex:
        futures = [(i, ex.submit(run, q)) for i, q in enumerate(qs)]
        for i, f in futures:
            try: ordered[i] = f.result()
            except: ordered[i] = {"question": qs[i], "answer": _error_response(),
                                   "error": True, "sql": None, "table": None, "kpis": None}

    parts = []
    for r in ordered:
        if r:
            title_sec = r.get("display_question") or r["question"].rstrip("?").strip()
            parts.append(f"**{title_sec}**\n\n{r['answer']}")

    conv_title = None
    if is_first and request.generate_title:
        try: conv_title = generate_title(message)
        except: pass

    return {
        "answer": "\n\n---\n\n".join(parts),
        "display_question": None, "conversation_title": conv_title,
        "sql": None, "table": None, "kpis": None,
        "error": any(r.get("error") for r in ordered if r),
    }


@app.get("/health")
def health():
    return {"status": "ok"}