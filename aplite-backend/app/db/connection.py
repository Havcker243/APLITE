"""
Postgres connection helpers.

Centralizes creation of pooled connections from DATABASE_URL and provides
request-scoped connection handling plus a transaction context manager used
by the query layer.
"""

import os
import threading
from contextvars import ContextVar
from contextlib import contextmanager
from typing import Iterator

import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

_pool_lock = threading.Lock()
_pool: ThreadedConnectionPool | None = None

_request_conn: ContextVar[psycopg2.extensions.connection | None] = ContextVar("aplite_request_db_conn", default=None)


def _get_pool() -> ThreadedConnectionPool:
    global _pool
    if _pool is not None:
        return _pool

    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set; configure your Supabase Postgres connection string.")

    minconn = int(os.getenv("DB_POOL_MIN", "1"))
    maxconn = int(os.getenv("DB_POOL_MAX", "10"))
    if minconn < 1:
        minconn = 1
    if maxconn < minconn:
        maxconn = minconn

    with _pool_lock:
        if _pool is None:
            _pool = ThreadedConnectionPool(
                minconn=minconn,
                maxconn=maxconn,
                dsn=DATABASE_URL,
                cursor_factory=RealDictCursor,
            )
    return _pool


@contextmanager
def get_connection() -> Iterator[psycopg2.extensions.connection]:
    existing = _request_conn.get()
    if existing is not None:
        # Reuse a request-scoped connection when present.
        yield existing
        return

    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
        # If caller forgot to commit/rollback, ensure we don't leak open transactions in the pool.
        # (Most query helpers call `conn.commit()` explicitly.)
        if conn.status != psycopg2.extensions.STATUS_READY:
            conn.rollback()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        pool.putconn(conn)


@contextmanager
def request_connection() -> Iterator[psycopg2.extensions.connection]:
    """
    Create a single pooled DB connection for the duration of a request.

    This reduces pool churn when a request calls multiple query helpers.
    """
    # Keeps a per-request connection in a ContextVar to avoid nested pool checkouts.
    pool = _get_pool()
    conn = pool.getconn()
    token = _request_conn.set(conn)
    try:
        yield conn
        if conn.status != psycopg2.extensions.STATUS_READY:
            conn.rollback()
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        _request_conn.reset(token)
        pool.putconn(conn)


@contextmanager
def transaction() -> Iterator[psycopg2.extensions.connection]:
    """
    Convenience context manager for executing multiple statements atomically.

    Uses the shared pool connection helpers and guarantees rollback on error.
    """
    with get_connection() as conn:
        try:
            yield conn
            conn.commit()
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise
