"""Disk cache with a time to live and a stale fallback.

get_or_fetch returns (value, stale). If a fetch fails, the last cached value comes back with stale=True,
so a flaky API never breaks the demo.
"""
import logging
import time
from typing import Any, Callable, Optional, Tuple

import diskcache

import config

log = logging.getLogger(__name__)
_cache = diskcache.Cache(config.CACHE_DIR)


def get_or_fetch(key: str, ttl: float, fetch: Callable[[], Any]) -> Tuple[Optional[Any], bool]:
    entry = _cache.get(key)
    if entry and time.time() - entry["t"] < ttl:
        return entry["v"], False
    try:
        value = fetch()
    except Exception as exc:  # network, rate limit, bad JSON
        log.warning("fetch failed for %s: %s", key, exc)
        value = None
    if value is not None:
        _cache.set(key, {"t": time.time(), "v": value})
        return value, False
    if entry:
        return entry["v"], True
    return None, False
