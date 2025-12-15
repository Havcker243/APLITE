"""
Postgres connection helper.

Reads DATABASE_URL from the environment (works with Supabase Postgres).
"""

import os
from contextlib import contextmanager
from typing import Iterator

import psycopg
from psycopg.rows import dict_row

DATABASE_URL = os.getenv("DATABASE_URL")


@contextmanager
def get_connection() -> Iterator[psycopg.Connection]:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set; configure your Supabase Postgres connection string.")
    conn = psycopg.connect(DATABASE_URL, row_factory=dict_row, autocommit=True)
    try:
        yield conn
    finally:
        conn.close()
