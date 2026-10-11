"""
Generates tests/risk/fixtures/golden.json.

This is the Python reference implementation (pandas + numpy). It is used ONLY to
produce expected values for the TypeScript tests. It never runs in the app.

It deliberately does not share code or helper structure with lib/risk: every
metric is written here from the formulas in the methodology, using numpy's
quantile (linear interpolation) and ddof=1 everywhere.

Run from the repo root:
    .venv/bin/python tests/risk/fixtures/generate_golden.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

RISK_DIR = Path("public/data/risk")
OUT = Path("tests/risk/fixtures/golden.json")
TICKERS = ["AAPL", "MSFT", "JPM", "XOM", "JNJ", "NVDA"]
ANN = 252

SCENARIOS = [
    ("q4_2018", "2018-09-20", "2018-12-24"),
    ("covid_2020", "2020-02-19", "2020-03-23"),
    ("bear_2022", "2022-01-03", "2022-10-12"),
    ("tariff_2025", "2025-02-19", "2025-04-08"),
    ("worst_day", "2020-03-13", "2020-03-16"),
]


def load_prices() -> tuple[pd.DataFrame, pd.Series, list[str]]:
    cal = json.loads((RISK_DIR / "calendar.json").read_text())
    idx = pd.Index(cal)

    def aligned(path: Path) -> pd.Series:
        f = json.loads(path.read_text())
        s = pd.Series([np.nan] * len(cal), index=idx, dtype=float)
        vals = [np.nan if v is None else v for v in f["prices"]]
        s.iloc[f["start"] : f["start"] + len(vals)] = vals
        return s

    df = pd.DataFrame({t: aligned(RISK_DIR / "prices" / f"{t}.json") for t in TICKERS})
    bench = aligned(RISK_DIR / "benchmark.json")
    return df, bench, cal


def max_drawdown(r: np.ndarray) -> dict:
    wealth = np.concatenate([[1.0], np.cumprod(1.0 + r)])
    peak = np.maximum.accumulate(wealth)
    dd = wealth / peak - 1.0
    trough = int(np.argmin(dd))  # first occurrence of the deepest point
    peak_idx = int(np.argmax(wealth[: trough + 1]))  # first occurrence of the running peak value
    # running peak at the trough is the max over [0..trough]; find where it was first reached
    peak_val = wealth[: trough + 1].max()
    peak_idx = int(np.where(wealth[: trough + 1] == peak_val)[0][0])
    rec = None
    for t in range(trough + 1, len(wealth)):
        if wealth[t] >= peak_val:
            rec = t
            break
    underwater = (rec if rec is not None else len(wealth) - 1) - peak_idx if dd.min() < 0 else 0
    return {"max_drawdown": float(dd.min()), "peak_idx": peak_idx, "trough_idx": trough, "recovery_idx": rec, "days_underwater": underwater}


def tail(r: np.ndarray, conf: float) -> dict:
    q = np.quantile(r, 1 - conf)
    t = r <= q
    z = {0.95: 1.645, 0.99: 2.326}[conf]
    return {
        "var": float(-q),
        "es": float(-r[t].mean()),
        "normal_var": float(-(r.mean() - z * r.std(ddof=1))),
        "tail_count": int(t.sum()),
    }


def worst(r: np.ndarray, k: int) -> dict:
    # rolling compounded return over k days, using pandas
    s = pd.Series(r)
    roll = (1 + s).rolling(k).apply(np.prod, raw=True) - 1
    end = int(roll.idxmin())
    return {"value": float(roll.min()), "start_idx": end - k + 1, "end_idx": end}


def nan_to_none(a) -> list:
    return [None if np.isnan(v) else float(v) for v in a]


def rolling_avg_corr(R: np.ndarray, w: np.ndarray, win: int) -> list:
    """Average pairwise correlation per window, using np.corrcoef on each window directly."""
    n, T = R.shape
    off = ~np.eye(n, dtype=bool)
    ww = np.outer(w, w)
    out = [np.nan] * T
    for t in range(win - 1, T):
        c = np.corrcoef(R[:, t - win + 1 : t + 1])
        out[t] = (ww[off] * c[off]).sum() / ww[off].sum()
    return out


def case(df: pd.DataFrame, bench: pd.Series, cal: list[str], window: int, w: np.ndarray, name: str) -> dict:
    prices = df.copy()
    prices["_bench"] = bench
    rets = prices.pct_change()
    win = rets.iloc[-window:]
    assert not win.isna().any().any(), "fixture tickers must have no gaps in the window"
    R = win[TICKERS].to_numpy().T  # assets x T
    m = win["_bench"].to_numpy()
    rp = w @ R

    cov_d = np.cov(R, ddof=1)
    cov_a = cov_d * ANN
    corr = np.corrcoef(R)
    vol_p = float(np.sqrt(w @ cov_a @ w))
    mrc = (cov_a @ w) / vol_p
    rc = w * mrc
    asset_vol = R.std(axis=1, ddof=1) * np.sqrt(ANN)

    q95 = np.quantile(rp, 0.05)
    tail_set = rp <= q95
    tail_contrib = -w * R[:, tail_set].mean(axis=1)

    beta_p = float(np.cov(rp, m, ddof=1)[0, 1] / np.var(m, ddof=1))
    r2 = float(np.corrcoef(rp, m)[0, 1] ** 2)
    iu = np.triu_indices(len(TICKERS), k=1)
    off = ~np.eye(len(TICKERS), dtype=bool)
    ww = np.outer(w, w)
    avg_corr = float((ww[off] * corr[off]).sum() / ww[off].sum())
    pair = int(np.argmax(corr[iu]))

    hhi = float((w**2).sum())
    return {
        "name": name,
        "window": window,
        "weights": w.tolist(),
        "dates": list(win.index),
        "base_date": cal[cal.index(win.index[0]) - 1],
        "ann_vol": float(rp.std(ddof=1) * np.sqrt(ANN)),
        "ann_return": float(np.prod(1 + rp) ** (ANN / len(rp)) - 1),
        "bench_ann_vol": float(m.std(ddof=1) * np.sqrt(ANN)),
        "bench_ann_return": float(np.prod(1 + m) ** (ANN / len(m)) - 1),
        "drawdown": max_drawdown(rp),
        "bench_max_drawdown": max_drawdown(m)["max_drawdown"],
        "beta": beta_p,
        "r_squared": r2,
        "tail95": tail(rp, 0.95),
        "tail99": tail(rp, 0.99),
        "worst1": worst(rp, 1),
        "worst5": worst(rp, 5),
        "worst20": worst(rp, 20),
        "hhi": hhi,
        "effective_holdings": 1 / hhi,
        "top1": float(np.sort(w)[::-1][:1].sum()),
        "top3": float(np.sort(w)[::-1][:3].sum()),
        "asset_vol": asset_vol.tolist(),
        "asset_beta": [float(np.cov(R[i], m, ddof=1)[0, 1] / np.var(m, ddof=1)) for i in range(len(TICKERS))],
        "div_ratio": float((w * asset_vol).sum() / vol_p),
        "avg_corr": avg_corr,
        "most_corr_pair": [TICKERS[iu[0][pair]], TICKERS[iu[1][pair]], float(corr[iu][pair])],
        "corr": corr.tolist(),
        "cov_annual": cov_a.tolist(),
        "port_vol": vol_p,
        "mrc": mrc.tolist(),
        "rc": rc.tolist(),
        "rc_pct": (rc / vol_p).tolist(),
        "tail_es": float(-rp[tail_set].mean()),
        "tail_contrib": tail_contrib.tolist(),
        "port_returns": rp.tolist(),
        "roll_vol21": nan_to_none(pd.Series(rp).rolling(21).std(ddof=1).to_numpy() * np.sqrt(ANN)),
        "roll_vol63": nan_to_none(pd.Series(rp).rolling(63).std(ddof=1).to_numpy() * np.sqrt(ANN)),
        "bench_roll_vol21": nan_to_none(pd.Series(m).rolling(21).std(ddof=1).to_numpy() * np.sqrt(ANN)),
        "bench_roll_vol63": nan_to_none(pd.Series(m).rolling(63).std(ddof=1).to_numpy() * np.sqrt(ANN)),
        "roll_avg_corr60": nan_to_none(np.array(rolling_avg_corr(R, w, 60))),
    }


def scenario(df: pd.DataFrame, bench: pd.Series, w: np.ndarray, sid: str, start: str, end: str) -> dict:
    sub = df.loc[start:end]
    p0, p1 = sub.iloc[0], sub.iloc[-1]
    R = (p1 / p0 - 1).to_numpy()
    rp = float(w @ R)
    # buy-and-hold daily value path
    value = (sub / p0).to_numpy() @ w
    daily = value[1:] / value[:-1] - 1
    wealth = value / value[0]
    peak = np.maximum.accumulate(wealth)
    return {
        "id": sid,
        "start": start,
        "end": end,
        "asset_returns": R.tolist(),
        "contributions": (w * R).tolist(),
        "portfolio_return": rp,
        "benchmark_return": float(bench.loc[end] / bench.loc[start] - 1),
        "worst_day": float(daily.min()),
        "worst_day_date": str(sub.index[1:][int(np.argmin(daily))]),
        "max_drawdown": float((wealth / peak - 1).min()),
    }


def main() -> None:
    df, bench, cal = load_prices()
    w1 = np.array([0.30, 0.25, 0.15, 0.10, 0.10, 0.10])
    w2 = np.full(6, 1 / 6)
    out = {
        "tickers": TICKERS,
        "calendar": cal,
        "benchmark": [None if np.isnan(v) else float(v) for v in bench.tolist()],
        "prices": {t: [None if np.isnan(v) else float(v) for v in df[t].tolist()] for t in TICKERS},
        "cases": [
            case(df, bench, cal, 504, w1, "2Y custom weights"),
            case(df, bench, cal, 252, w2, "1Y equal weights"),
        ],
        "scenarios": [scenario(df, bench, w1, *s) for s in SCENARIOS],
        "scenario_weights": w1.tolist(),
    }
    OUT.write_text(json.dumps(out, separators=(",", ":")))
    print(f"Wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
