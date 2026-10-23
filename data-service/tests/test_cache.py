import cache


def test_fresh_value_is_cached():
    calls = []
    fetch = lambda: calls.append(1) or {"v": 1}
    assert cache.get_or_fetch("t:fresh", 60, fetch) == ({"v": 1}, False)
    assert cache.get_or_fetch("t:fresh", 60, fetch) == ({"v": 1}, False)
    assert len(calls) == 1


def test_falls_back_to_stale_value_when_fetch_fails():
    cache.get_or_fetch("t:stale", 0, lambda: {"v": 2})
    def boom():
        raise ConnectionError("API down")
    assert cache.get_or_fetch("t:stale", 0, boom) == ({"v": 2}, True)


def test_returns_none_when_nothing_cached_and_fetch_fails():
    def boom():
        raise TimeoutError()
    assert cache.get_or_fetch("t:none", 0, boom) == (None, False)
