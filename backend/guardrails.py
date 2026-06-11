import re

# Palavras-chave de escrita/DDL que nunca podem aparecer
WRITE_KEYWORDS = [
    "INSERT", "UPDATE", "DELETE", "DROP", "CREATE",
    "ALTER", "TRUNCATE", "REPLACE", "ATTACH", "DETACH",
    "PRAGMA", "VACUUM",
]

# Colunas válidas da tabela vendas
VALID_COLUMNS = {
    "data_venda", "id_pedido", "loja", "uf", "categoria",
    "colecao", "produto", "tamanho", "cor", "id_cliente",
    "id_vendedor", "quantidade", "preco_unitario", "receita",
}


def validate_sql(sql: str) -> tuple[bool, str]:
    """
    Valida o SQL gerado pelo LLM antes de executar.
    Retorna (ok: bool, reason: str).

    Distingue três casos:
      - SQL de escrita/DDL → bloqueado com mensagem técnica (para log)
      - Texto não-SQL (LLM confuso) → tratado como FORA_DO_ESCOPO internamente
      - SQL válido SELECT → aprovado
    """
    if not sql or not sql.strip():
        return False, "INVALID_SQL: vazio"

    cleaned = sql.strip().upper()

    # Bloquear palavras-chave de escrita — verificar antes do SELECT check
    for keyword in WRITE_KEYWORDS:
        if re.search(rf"\b{keyword}\b", cleaned):
            return False, f"WRITE_ATTEMPT: {keyword}"

    # Deve começar com SELECT após remover espaços/newlines
    first_token = cleaned.split()[0] if cleaned.split() else ""
    if first_token != "SELECT":
        return False, "INVALID_SQL: não é SELECT"

    # Bloquear múltiplos statements
    statements = [s.strip() for s in sql.split(";") if s.strip()]
    if len(statements) > 1:
        return False, "INVALID_SQL: múltiplos statements"

    return True, ""


def is_out_of_scope(sql: str) -> bool:
    """Verifica se o LLM sinalizou que a pergunta está fora do escopo."""
    return sql.strip().upper() == "FORA_DO_ESCOPO"


def is_invalid_sql(reason: str) -> bool:
    """
    Retorna True se o motivo de falha é SQL inválido/lixo do LLM
    (não um comando de escrita intencional).
    Usado pelo main.py para exibir mensagem amigável em vez de erro técnico.
    """
    return reason.startswith("INVALID_SQL:")


def is_write_attempt(reason: str) -> bool:
    """Retorna True se foi uma tentativa de escrita no banco."""
    return reason.startswith("WRITE_ATTEMPT:")