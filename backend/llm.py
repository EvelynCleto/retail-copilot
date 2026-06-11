import json
import logging
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

import anthropic

from prompt import SYSTEM_PROMPT_SQL, SYSTEM_PROMPT_ANSWER

MODEL = "claude-sonnet-4-6"
MAX_TOKENS_SQL    = 512
MAX_TOKENS_ANSWER = 1536
MAX_TOKENS_UTIL   = 24   # rewrite e title: muito curtos

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def _get_client() -> anthropic.Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY não configurada.")
    return anthropic.Anthropic(api_key=api_key)


def _extract_text(response: anthropic.types.Message) -> str:
    if not response.content:
        raise ValueError("Resposta vazia da API.")
    block = response.content[0]
    if hasattr(block, "text"):
        return block.text.strip()
    raise ValueError(f"Tipo inesperado: {type(block)}")


def _strip_markdown(text: str) -> str:
    if text.startswith("```"):
        lines = text.split("\n")
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        return "\n".join(inner).strip()
    return text


def _compress_history(history: list[dict]) -> list[dict]:
    """Comprime respostas longas do assistant para não poluir o contexto SQL."""
    recent = history[-8:] if len(history) > 8 else history
    compressed = []
    for msg in recent:
        if msg["role"] == "user":
            compressed.append({"role": "user", "content": msg["content"]})
        else:
            lines = [l.strip().lstrip("#*").strip() for l in msg["content"].split("\n") if l.strip()]
            first = next((l for l in lines if len(l) > 10 and not l.startswith("|")), "")
            compressed.append({"role": "assistant", "content": first[:150] or "(resposta anterior)"})
    return compressed


def generate_sql(question: str, history: list[dict]) -> str:
    client = _get_client()
    messages = _compress_history(history)
    messages.append({"role": "user", "content": question})
    logger.info("→ SQL | '%s'", question[:80])
    response = client.messages.create(
        model=MODEL, max_tokens=MAX_TOKENS_SQL,
        system=SYSTEM_PROMPT_SQL, messages=messages,
    )
    logger.info("← SQL | in=%s out=%s", response.usage.input_tokens, response.usage.output_tokens)
    sql = _strip_markdown(_extract_text(response))
    logger.info("   %s", sql[:200])
    return sql


def generate_answer(question: str, sql: str, results: list[dict[str, Any]]) -> str:
    client = _get_client()
    results_text = json.dumps(results, ensure_ascii=False, indent=2)
    user_content = f"Pergunta: {question}\n\nResultados:\n{results_text}"
    logger.info("→ ANS | %d linha(s)", len(results))
    response = client.messages.create(
        model=MODEL, max_tokens=MAX_TOKENS_ANSWER,
        system=SYSTEM_PROMPT_ANSWER,
        messages=[{"role": "user", "content": user_content}],
    )
    logger.info("← ANS | out=%s", response.usage.output_tokens)
    return _extract_text(response)


def rewrite_question(question: str) -> str:
    """Reformula a pergunta em título executivo curto (máx 5 palavras)."""
    client = _get_client()
    system = (
        "Reformule a pergunta em um título executivo de no máximo 5 palavras em português. "
        "Sem pontuação final. Sem verbos de pergunta. Exemplos: "
        "'quanto vendemos em 2024?' → 'Receita total de 2024', "
        "'quais as 5 categorias?' → 'Top 5 categorias por receita', "
        "'me dê um resumo executivo' → 'Resumo executivo do período'. "
        "Retorne APENAS o título."
    )
    try:
        response = client.messages.create(
            model=MODEL, max_tokens=MAX_TOKENS_UTIL,
            system=system,
            messages=[{"role": "user", "content": question}],
        )
        return _extract_text(response)
    except Exception:
        return question.rstrip("?.").strip()[:60]


def generate_title(first_question: str) -> str:
    """Gera título de conversa curto (máx 4 palavras)."""
    client = _get_client()
    system = (
        "Gere um título de conversa com no máximo 4 palavras em português. "
        "Tom executivo, sem pontuação. Exemplos: "
        "'Receita total de 2024', 'Ranking de categorias', 'Ticket médio', "
        "'Comparativo anual', 'Resumo executivo'. Retorne APENAS o título."
    )
    try:
        response = client.messages.create(
            model=MODEL, max_tokens=MAX_TOKENS_UTIL,
            system=system,
            messages=[{"role": "user", "content": first_question}],
        )
        return _extract_text(response)
    except Exception:
        words = first_question.replace("?", "").replace(".", "").split()
        return " ".join(words[:4])


def generate_sql_and_rewrite_parallel(question: str, history: list[dict]) -> tuple[str, str]:
    """
    Executa generate_sql e rewrite_question em paralelo.
    Retorna (sql, display_question).
    Economiza ~600ms por request.
    """
    sql_result     = [None]
    rewrite_result = [None]

    with ThreadPoolExecutor(max_workers=2) as executor:
        f_sql     = executor.submit(generate_sql, question, history)
        f_rewrite = executor.submit(rewrite_question, question)

        for future in as_completed([f_sql, f_rewrite]):
            if future is f_sql:
                try:
                    sql_result[0] = future.result()
                except Exception as e:
                    sql_result[0] = Exception(str(e))
            else:
                try:
                    rewrite_result[0] = future.result()
                except Exception:
                    rewrite_result[0] = question

    if isinstance(sql_result[0], Exception):
        raise sql_result[0]

    return sql_result[0], rewrite_result[0] or question