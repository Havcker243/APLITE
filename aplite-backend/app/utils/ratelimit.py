"""
Simple in-process rate limiting helpers.

This is an MVP implementation intended to prevent accidental overload and basic abuse.
For multi-instance deployments, replace this with a shared backend (Redis) or edge limits
(Cloudflare/Nginx/API gateway), otherwise limits won't be enforced globally.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Dict, Tuple


@dataclass(frozen=True)
class RateLimit:
    limit: int
    window_seconds: int


class _FixedWindowStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._buckets: Dict[str, Tuple[int, int]] = {}
        self._last_prune = 0.0

    def check(self, key: str, *, limit: int, window_seconds: int) -> tuple[bool, int]:
        """
        Return (allowed, retry_after_seconds).

        Uses a fixed-window counter:
        - window key is computed as floor(now/window_seconds)
        - counter resets at the start of a new window
        """
        if limit <= 0:
            return True, 0
        if window_seconds <= 0:
            return True, 0

        now = int(time.time())
        window_id = now // window_seconds

        with self._lock:
            self._maybe_prune(now, window_seconds)
            current = self._buckets.get(key)
            if current is None or current[0] != window_id:
                self._buckets[key] = (window_id, 1)
                return True, 0

            count = current[1]
            if count >= limit:
                window_end = (window_id + 1) * window_seconds
                return False, max(1, window_end - now)

            self._buckets[key] = (window_id, count + 1)
            return True, 0

    def _maybe_prune(self, now: int, window_seconds: int) -> None:
        # Best-effort pruning to avoid unbounded memory growth.
        # Prune at most once every ~60 seconds.
        if now - int(self._last_prune) < 60:
            return
        self._last_prune = float(now)

        # Keep only buckets from the current and previous window to allow retry_after accuracy.
        current_window = now // window_seconds
        min_window = current_window - 1

        if len(self._buckets) <= 10_000:
            # Avoid work when small.
            return

        keys_to_delete = [k for k, (wid, _) in self._buckets.items() if wid < min_window]
        for k in keys_to_delete:
            self._buckets.pop(k, None)


_store = _FixedWindowStore()


def check_rate_limit(key: str, rule: RateLimit) -> tuple[bool, int]:
    return _store.check(key, limit=int(rule.limit), window_seconds=int(rule.window_seconds))

