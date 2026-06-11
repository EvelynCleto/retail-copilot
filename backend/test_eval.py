"""
Validação automática das 6 perguntas obrigatórias do desafio.
Requer o servidor rodando em http://localhost:8000

Uso:
    python test_eval.py
"""

import json
import sys
import urllib.request
import urllib.error

BASE_URL = "http://localhost:8000/chat"

# ─── Cores para terminal ───────────────────────────────────────────────────────
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
BLUE   = "\033[94m"
BOLD   = "\033[1m"
RESET  = "\033[0m"

def ok(msg):    print(f"  {GREEN}✅ {msg}{RESET}")
def fail(msg):  print(f"  {RED}❌ {msg}{RESET}")
def info(msg):  print(f"  {YELLOW}ℹ  {msg}{RESET}")


# ─── Casos de teste ────────────────────────────────────────────────────────────

TEST_CASES = [
    {
        "id": "Q1",
        "pergunta": "Qual foi a receita total em 2024?",
        "checks": [
            {
                "descricao": "Contém o valor R$ 73.067.913",
                "fn": lambda r: any(v in r["answer"] for v in ["73.067.913", "73067913", "73,067,913"]),
            },
            {
                "descricao": "SQL não usa receita * quantidade",
                "fn": lambda r: "receita * quantidade" not in (r.get("sql") or "").lower()
                                and "receita*quantidade" not in (r.get("sql") or "").lower(),
            },
        ],
    },
    {
        "id": "Q2",
        "pergunta": "Quais as 5 categorias de produto que mais venderam em 2023?",
        "checks": [
            {
                "descricao": "Menciona CALCA ou CALÇA",
                "fn": lambda r: any(v in r["answer"].upper() for v in ["CALCA", "CALÇA"]),
            },
            {
                "descricao": "Menciona VESTIDO",
                "fn": lambda r: "VESTIDO" in r["answer"].upper(),
            },
            {
                "descricao": "Menciona CASACO",
                "fn": lambda r: "CASACO" in r["answer"].upper(),
            },
            {
                "descricao": "Menciona CAMISA",
                "fn": lambda r: "CAMISA" in r["answer"].upper(),
            },
            {
                "descricao": "Menciona SAIA",
                "fn": lambda r: "SAIA" in r["answer"].upper(),
            },
            {
                "descricao": "SQL filtra por 2023",
                "fn": lambda r: "2023" in (r.get("sql") or ""),
            },
        ],
    },
    {
        "id": "Q3",
        "pergunta": "Compare a receita de 2023 com a de 2024.",
        "checks": [
            {
                "descricao": "Contém receita 2023 (74.341.926)",
                "fn": lambda r: any(v in r["answer"] for v in ["74.341.926", "74341926", "74,341,926"]),
            },
            {
                "descricao": "Contém receita 2024 (73.067.913)",
                "fn": lambda r: any(v in r["answer"] for v in ["73.067.913", "73067913", "73,067,913"]),
            },
            {
                "descricao": "Menciona queda ou variação",
                "fn": lambda r: any(w in r["answer"].lower() for w in ["queda", "redução", "menor", "1,7", "1.7", "-1", "crescimento"]),
            },
        ],
    },
    {
        "id": "Q4",
        "pergunta": "Qual loja teve o maior faturamento?",
        "checks": [
            {
                "descricao": "Menciona Loja A",
                "fn": lambda r: "loja a" in r["answer"].lower(),
            },
            {
                "descricao": "Contém o valor 45.383.244",
                "fn": lambda r: any(v in r["answer"] for v in ["45.383.244", "45383244", "45,383,244"]),
            },
        ],
    },
    {
        "id": "Q5",
        "pergunta": "Quantas unidades foram vendidas por mês em 2024?",
        "checks": [
            {
                "descricao": "SQL filtra por 2024",
                "fn": lambda r: "2024" in (r.get("sql") or ""),
            },
            {
                "descricao": "SQL agrupa por mês (strftime)",
                "fn": lambda r: "strftime" in (r.get("sql") or "").lower(),
            },
            {
                "descricao": "Tabela retorna 12 linhas (um por mês)",
                "fn": lambda r: isinstance(r.get("table"), list) and len(r["table"]) == 12,
            },
        ],
    },
    {
        "id": "Q6",
        "pergunta": "Qual o ticket médio por pedido?",
        "checks": [
            {
                "descricao": "Contém o valor 2.961,58 ou 2961.58",
                "fn": lambda r: any(v in r["answer"] for v in ["2.961,58", "2961.58", "2,961.58", "2.961"]),
            },
            {
                "descricao": "SQL usa COUNT(DISTINCT id_pedido) — não AVG(receita)",
                "fn": lambda r: "distinct" in (r.get("sql") or "").lower()
                                and "avg(receita)" not in (r.get("sql") or "").lower(),
            },
        ],
    },
]


# ─── Funções auxiliares ────────────────────────────────────────────────────────

def call_chat(pergunta: str) -> dict:
    payload = json.dumps({"message": pergunta, "history": []}).encode("utf-8")
    req = urllib.request.Request(
        BASE_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def check_server() -> bool:
    try:
        urllib.request.urlopen("http://localhost:8000/health", timeout=5)
        return True
    except Exception:
        return False


def separator(char="─", width=60):
    print(char * width)


# ─── Runner principal ──────────────────────────────────────────────────────────

def run():
    print(f"\n{BOLD}{'═' * 60}")
    print("  RETAIL INSIGHTS — Validação das 6 Perguntas Obrigatórias")
    print(f"{'═' * 60}{RESET}\n")

    if not check_server():
        print(f"{RED}❌ Servidor não está rodando em http://localhost:8000")
        print(f"   Rode: uvicorn main:app --reload{RESET}\n")
        sys.exit(1)

    print(f"{GREEN}✅ Servidor online{RESET}\n")

    total_checks = 0
    passed_checks = 0
    questions_ok = 0

    for case in TEST_CASES:
        separator()
        print(f"{BOLD}{BLUE}[{case['id']}]{RESET} {case['pergunta']}")
        separator()

        try:
            response = call_chat(case["pergunta"])
        except urllib.error.URLError as e:
            fail(f"Erro de conexão: {e}")
            continue
        except Exception as e:
            fail(f"Erro inesperado: {e}")
            continue

        # Imprimir resposta
        print(f"\n{BOLD}Resposta:{RESET}")
        print(f"  {response.get('answer', '(sem resposta)')}\n")

        # Imprimir SQL
        sql = response.get("sql") or "(sem SQL)"
        print(f"{BOLD}SQL gerado:{RESET}")
        for line in sql.split("\n"):
            print(f"  {line}")
        print()

        # Imprimir tabela (se houver)
        table = response.get("table")
        if table:
            print(f"{BOLD}Tabela retornada ({len(table)} linhas):{RESET}")
            if table:
                headers = list(table[0].keys())
                col_w = max(len(h) for h in headers) + 2
                header_line = "  " + "  ".join(h.ljust(col_w) for h in headers)
                print(header_line)
                print("  " + "-" * (len(header_line) - 2))
                for row in table[:14]:  # Mostrar até 14 linhas
                    print("  " + "  ".join(str(row.get(h, "")).ljust(col_w) for h in headers))
                if len(table) > 14:
                    info(f"... e mais {len(table) - 14} linha(s)")
            print()

        # Rodar checks
        q_checks_passed = 0
        print(f"{BOLD}Validações:{RESET}")
        for check in case["checks"]:
            total_checks += 1
            try:
                result = check["fn"](response)
            except Exception:
                result = False

            if result:
                ok(check["descricao"])
                passed_checks += 1
                q_checks_passed += 1
            else:
                fail(check["descricao"])

        all_passed = q_checks_passed == len(case["checks"])
        if all_passed:
            questions_ok += 1
            print(f"\n  {GREEN}{BOLD}→ {case['id']}: PASSOU ({q_checks_passed}/{len(case['checks'])} checks){RESET}")
        else:
            print(f"\n  {RED}{BOLD}→ {case['id']}: FALHOU ({q_checks_passed}/{len(case['checks'])} checks){RESET}")

        print()

    # ─── Resumo final ──────────────────────────────────────────────────────────
    separator("═")
    print(f"{BOLD}  RESULTADO FINAL{RESET}")
    separator("═")
    print(f"  Perguntas:  {questions_ok}/{len(TEST_CASES)} aprovadas")
    print(f"  Checks:     {passed_checks}/{total_checks} passaram")

    if questions_ok == len(TEST_CASES):
        print(f"\n  {GREEN}{BOLD}🎉 Todas as perguntas obrigatórias passaram!{RESET}")
    else:
        reprovadas = len(TEST_CASES) - questions_ok
        print(f"\n  {RED}{BOLD}⚠  {reprovadas} pergunta(s) falharam. Revise o system prompt.{RESET}")

    separator("═")
    print()


if __name__ == "__main__":
    run()