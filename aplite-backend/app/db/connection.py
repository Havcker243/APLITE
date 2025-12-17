"""
Postgres connection helper.

Reads DATABASE_URL from the environment (works with Supabase Postgres).
"""

import os
from contextlib import contextmanager
from typing import Iterator

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")


@contextmanager
def get_connection() -> Iterator[psycopg2.extensions.connection]:
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set; configure your Supabase Postgres connection string.")

    conn = psycopg2.connect(
        DATABASE_URL,
        cursor_factory=RealDictCursor
    )
    try:
        yield conn
    finally:
        conn.close()

