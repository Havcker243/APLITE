"""
Database connection placeholder used for future Postgres integration.

The MVP stores data in-memory via app.db.queries, but this module keeps the
interface ready for when a real connection pool is added.
"""

from contextlib import contextmanager
from typing import Iterator, Optional

Connection = Optional[object]


@contextmanager
def get_connection() -> Iterator[Connection]:
    """Yield a fake connection object for compatibility with future code."""
    yield None
