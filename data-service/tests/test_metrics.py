import math

from engine import metrics as M


def test_volatility_of_constant_growth_is_zero():
    c = [100 * 1.001 ** i for i in range(260)]
    assert M.volatility(c) < 1e-6


def test_volatility_matches_known_alternating_series():
    c = [100.0]
    for i in range(252):
        c.append(c[-1] * (1.01 if i % 2 == 0 else 1 / 1.01))
    r = M.daily_returns(c)
    mean = sum(r) / len(r)
    expected = math.sqrt(sum((x - mean) ** 2 for x in r) / (len(r) - 1)) * math.sqrt(252) * 100
    assert abs(M.volatility(c) - expected) < 1e-9


def test_max_drawdown():
    assert M.max_drawdown([100, 120, 90, 110, 60, 130]) == -50.0
    assert M.max_drawdown([1, 2, 3]) == 0.0


def test_total_return_and_dividend_yield():
    hist = [["d", 100.0, 0.0]] * 200 + [["d", 110.0, 1.0]] * 4
    assert abs(M.total_return([r[1] for r in hist]) - 10.0) < 1e-9
    assert abs(M.dividend_yield(hist) - 4 / 110 * 100) < 1e-9


def test_bad_year_loss_and_split():
    assert M.bad_year_loss(10, 100_000) == 16_500
    assert M.stock_share(9, 5) == 74
    assert M.stock_share(1, 1) == 20
    assert M.stock_share(30, 10) == 90


def test_slice_range_keeps_last_point():
    hist = [[f"d{i}", float(i), 0.0] for i in range(1300)]
    for rng in M.RANGES:
        pts = M.slice_range(hist, rng)
        assert pts[-1] == ["d1299", 1299.0]
