"""
Database connection shim kept for future Postgres integration.

The current build stores data on disk via app.db.queries while preserving the
interface required for a real connection pool.
"""

from contextlib import contextmanager
from typing import Iterator, Optional

Connection = Optional[object]


@contextmanager
def get_connection() -> Iterator[Connection]:
    """Yield a fake connection object for compatibility with future code."""
    yield None
