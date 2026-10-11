"""
Prints the numbers used in docs/risk-lab-explainer.md.

Worked example: AAPL 50%, JPM 30%, XOM 20%, 2-year window, SPY benchmark.
Reads the same adjusted-close files the Portfolio page uses (public/data/risk).
Prices refresh daily, so rerun this to get today's numbers.

    .venv/bin/python scripts/risk_explainer_example.py
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

RISK = Path("public/data/risk")
TICKERS = ["AAPL", "JPM", "XOM"]
W = np.array([0.50, 0.30, 0.20])
SIZE = 100_000
ANN = 252


def series(path: Path, cal: list[str]) -> pd.Series:
    f = json.loads(path.read_text())
    s = pd.Series([np.nan] * len(cal), index=cal, dtype=float)
    s.iloc[f["start"] : f["start"] + len(f["prices"])] = [np.nan if v is None else v for v in f["prices"]]
    return s


def main() -> None:
    cal = json.loads((RISK / "calendar.json").read_text())
    meta = json.loads((RISK / "meta.json").read_text())
    px = pd.DataFrame({t: series(RISK / "prices" / f"{t}.json", cal) for t in TICKERS})
    spy = series(RISK / "benchmark.json", cal)
    ret = px.pct_change()
    spy_ret = spy.pct_change()

    def block(n: int) -> dict:
        r = ret.iloc[-n:]
        m = spy_ret.iloc[-n:]
        assert not r.isna().any().any()
        R = r.to_numpy().T
        rp = W @ R
        cov = np.cov(R, ddof=1) * ANN
        vol_i = np.sqrt(np.diag(cov))
        vol_p = float(np.sqrt(W @ cov @ W))
        out = {
            "n": n, "start": r.index[0], "end": r.index[-1], "base": cal[cal.index(r.index[0]) - 1],
            "vol_i": vol_i, "vol_p": vol_p, "wavg_vol": float(W @ vol_i), "div_ratio": float((W @ vol_i) / vol_p),
            "corr": np.corrcoef(R), "cov": cov,
            "beta_i": [np.cov(R[i], m, ddof=1)[0, 1] / np.var(m, ddof=1) for i in range(3)],
            "beta_p": float(np.cov(rp, m, ddof=1)[0, 1] / np.var(m, ddof=1)),
            "ann_ret": float(np.prod(1 + rp) ** (ANN / n) - 1), "spy_ann_ret": float(np.prod(1 + m) ** (ANN / n) - 1),
            "spy_vol": float(m.std(ddof=1) * np.sqrt(ANN)),
            "rp": rp,
        }
        mrc = (cov @ W) / vol_p
        out["mrc"], out["rc"], out["rc_pct"] = mrc, W * mrc, W * mrc / vol_p
        for c in (0.95, 0.99):
            q = np.quantile(rp, 1 - c)
            tail = rp <= q
            z = {0.95: 1.645, 0.99: 2.326}[c]
            out[f"var{int(c*100)}"] = float(-q)
            out[f"es{int(c*100)}"] = float(-rp[tail].mean())
            out[f"tail{int(c*100)}"] = int(tail.sum())
            out[f"nvar{int(c*100)}"] = float(-(rp.mean() - z * rp.std(ddof=1)))
            out[f"pos{int(c*100)}"] = (n - 1) * (1 - c)
            if c == 0.95:
                out["es_contrib"] = (-W * R[:, tail].mean(axis=1)).tolist()
        wealth = np.concatenate([[1.0], np.cumprod(1 + rp)])
        dd = wealth / np.maximum.accumulate(wealth) - 1
        tr = int(np.argmin(dd))
        pk = int(np.where(wealth[: tr + 1] == wealth[: tr + 1].max())[0][0])
        dates = [out["base"]] + list(r.index)
        rec = next((i for i in range(tr + 1, len(wealth)) if wealth[i] >= wealth[pk]), None)
        out["dd"] = {"max": float(dd.min()), "peak": dates[pk], "trough": dates[tr], "recovery": dates[rec] if rec else None, "days_under": (rec if rec else len(wealth) - 1) - pk}
        srt = np.sort(rp)
        out["worst_sorted"] = srt[:30].tolist()
        out["worst_day"] = (float(rp.min()), r.index[int(np.argmin(rp))])
        return out

    two = block(504)
    np.set_printoptions(precision=6, suppress=True)
    print("DATA THROUGH", meta["last_date"], "| window", two["start"], "to", two["end"], "| base", two["base"], "| n", two["n"])
    for k in ["vol_i", "vol_p", "wavg_vol", "div_ratio", "beta_i", "beta_p", "ann_ret", "spy_ann_ret", "spy_vol", "mrc", "rc", "rc_pct", "var95", "es95", "tail95", "nvar95", "pos95", "var99", "es99", "tail99", "nvar99", "pos99", "es_contrib", "dd", "worst_day"]:
        print(k, two[k])
    print("corr\n", two["corr"])
    print("cov\n", two["cov"])
    print("worst 30 sorted", np.round(two["worst_sorted"], 5).tolist())
    print("sum rc", two["rc"].sum(), "sum es_contrib", sum(two["es_contrib"]))
    print("\nWINDOWS (vol, VaR95, ES95, tail95, VaR99, tail99)")
    for label, n in [("1Y", 252), ("2Y", 504), ("3Y", 756), ("5Y", 1260)]:
        b = block(n)
        print(label, round(b["vol_p"], 4), round(b["var95"], 4), round(b["es95"], 4), b["tail95"], round(b["var99"], 4), b["tail99"], round(b["dd"]["max"], 4))
    # COVID replay, buy and hold from 2020-02-19 to 2020-03-23
    p0, p1 = px.loc["2020-02-19"], px.loc["2020-03-23"]
    R = (p1 / p0 - 1).to_numpy()
    print("\nCOVID", R.round(4).tolist(), "contrib", (W * R).round(4).tolist(), "portfolio", round(float(W @ R), 4), "SPY", round(float(spy.loc["2020-03-23"] / spy.loc["2020-02-19"] - 1), 4))


if __name__ == "__main__":
    main()
