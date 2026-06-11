import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).parent / "vendas.db"


class DatabaseError(Exception):
    pass


def execute_query(sql: str) -> list[dict[str, Any]]:
    """
    Executa uma query SELECT no vendas.db.
    Retorna lista de dicts [{coluna: valor}, ...].
    Lança DatabaseError em caso de falha.
    """
    if not DB_PATH.exists():
        raise DatabaseError(f"Banco de dados não encontrado em: {DB_PATH}")

    try:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute(sql)
        rows = cur.fetchall()
        conn.close()
        return [dict(row) for row in rows]

    except sqlite3.OperationalError as e:
        raise DatabaseError(f"Erro ao executar query: {str(e)}")
    except Exception as e:
        raise DatabaseError(f"Erro inesperado no banco: {str(e)}")
