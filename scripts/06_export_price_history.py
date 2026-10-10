# scripts/06_export_price_history.py
#
# Exports dividend- and split-adjusted daily closes for the Portfolio risk page.
#
# Why a separate script: 01_fetch_live_prices.py stores raw (not dividend-adjusted)
# closes for the forecast models. Risk numbers need total-return prices, otherwise
# returns around dividends and splits are silently wrong.
#
# Output (all under public/data/risk/):
#   meta.json       export date, source, methodology version, skipped symbols
#   calendar.json   list of trading dates (SPY's calendar), ISO strings
#   benchmark.json  {"symbol": "SPY", "start": i, "prices": [...]}
#   prices/{T}.json {"symbol": T, "start": i, "prices": [...]}
#
# "start" is the index into calendar.json where the first price sits. Prices are
# adjusted closes rounded to 4 decimals. A null inside "prices" is a missing day.
# Nothing is forward-filled here.

from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
import yfinance as yf

TICKER_SOURCE_PATH = Path("public/data/marketpulse_dashboard_company_summary.csv")
OUT_DIR = Path("public/data/risk")
BENCHMARK = "SPY"
HISTORY_START = "2017-12-01"  # buffer so the first 2018 return exists
CHUNK_SIZE = 60
MAX_STALE_TRADING_DAYS = 5
MAX_SKIPPED_SHARE = 0.03
METHODOLOGY_VERSION = "1.0.0"


def to_yf(symbol: str) -> str:
    return symbol.upper().strip().replace(".", "-")


def load_symbols() -> list[str]:
    df = pd.read_csv(TICKER_SOURCE_PATH)
    return sorted(df["symbol"].dropna().astype(str).str.upper().str.strip().unique().tolist())


def download_closes(yf_symbols: list[str]) -> pd.DataFrame:
    """Adjusted close, one column per yfinance symbol."""
    raw = yf.download(
        tickers=yf_symbols,
        start=HISTORY_START,
        interval="1d",
        auto_adjust=True,  # Close is then split- and dividend-adjusted
        actions=False,
        group_by="column",
        threads=True,
        progress=False,
    )
    if raw.empty:
        return pd.DataFrame()
    close = raw["Close"]
    if isinstance(close, pd.Series):
        close = close.to_frame(name=yf_symbols[0])
    return close


def trading_days_between(last: date, today: date) -> int:
    if last >= today:
        return 0
    return int(np.busday_count(last, today))


def series_payload(symbol: str, col: pd.Series, calendar: pd.DatetimeIndex) -> dict | None:
    s = col.reindex(calendar)
    valid = s.dropna()
    if valid.empty:
        return None
    first_idx = int(calendar.get_loc(valid.index[0]))
    last_idx = int(calendar.get_loc(valid.index[-1]))
    window = s.iloc[first_idx : last_idx + 1]
    prices = [None if pd.isna(v) else round(float(v), 4) for v in window.tolist()]
    # Trailing nulls are dropped by slicing to last_idx; leading by "start".
    return {"symbol": symbol, "start": first_idx, "prices": prices}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--allow-stale", action="store_true", help="skip the staleness check (offline dev only)")
    args = ap.parse_args()

    symbols = load_symbols()
    print(f"{len(symbols)} symbols from {TICKER_SOURCE_PATH}")

    bench = download_closes([BENCHMARK])
    if bench.empty or BENCHMARK not in bench.columns:
        print("ERROR: could not download the benchmark.", file=sys.stderr)
        return 1
    bench_close = bench[BENCHMARK].dropna()
    calendar = pd.DatetimeIndex(bench_close.index).tz_localize(None).normalize()
    bench_close.index = calendar

    last_date = calendar[-1].date()
    stale_days = trading_days_between(last_date, date.today())
    if stale_days > MAX_STALE_TRADING_DAYS and not args.allow_stale:
        print(f"ERROR: benchmark is {stale_days} trading days stale (last {last_date}).", file=sys.stderr)
        return 1

    frames = []
    for i in range(0, len(symbols), CHUNK_SIZE):
        chunk = symbols[i : i + CHUNK_SIZE]
        print(f"Downloading {i + 1}-{i + len(chunk)}...")
        frames.append(download_closes([to_yf(s) for s in chunk]))
    closes = pd.concat([f for f in frames if not f.empty], axis=1)
    closes.index = pd.DatetimeIndex(closes.index).tz_localize(None).normalize()
    closes = closes.loc[:, ~closes.columns.duplicated()]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "prices").mkdir(exist_ok=True)
    for old in (OUT_DIR / "prices").glob("*.json"):
        old.unlink()

    skipped: dict[str, str] = {}
    suspect: list[dict] = []
    written = 0
    for sym in symbols:
        col = closes.get(to_yf(sym))
        if col is None or col.dropna().empty:
            skipped[sym] = "no data returned"
            continue
        payload = series_payload(sym, col, calendar)
        if payload is None:
            skipped[sym] = "no overlap with benchmark calendar"
            continue
        arr = pd.Series([np.nan if p is None else p for p in payload["prices"]])
        if (arr.dropna() <= 0).any():
            skipped[sym] = "non-positive price"
            continue
        rets = arr.pct_change(fill_method=None).abs()
        big = int((rets > 0.5).sum())
        if big:
            suspect.append({"symbol": sym, "days_with_abs_return_over_50pct": big})
        # A symbol that stopped trading is stale, not current.
        last_valid_idx = payload["start"] + len(payload["prices"]) - 1
        if last_valid_idx < len(calendar) - 1 - MAX_STALE_TRADING_DAYS:
            skipped[sym] = f"last price {calendar[last_valid_idx].date()} (stopped trading)"
            continue
        (OUT_DIR / "prices" / f"{sym}.json").write_text(json.dumps(payload, separators=(",", ":")))
        written += 1

    skipped_share = len(skipped) / len(symbols)
    if skipped_share > MAX_SKIPPED_SHARE:
        print(f"ERROR: {len(skipped)} of {len(symbols)} symbols skipped ({skipped_share:.1%}).", file=sys.stderr)
        print(json.dumps(skipped, indent=2), file=sys.stderr)
        return 1

    (OUT_DIR / "calendar.json").write_text(json.dumps([d.strftime("%Y-%m-%d") for d in calendar], separators=(",", ":")))
    bench_payload = series_payload(BENCHMARK, bench_close, calendar)
    (OUT_DIR / "benchmark.json").write_text(json.dumps(bench_payload, separators=(",", ":")))
    meta = {
        "exported_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Yahoo Finance via yfinance, auto_adjust=True (split- and dividend-adjusted close)",
        "methodology_version": METHODOLOGY_VERSION,
        "benchmark": BENCHMARK,
        "first_date": calendar[0].strftime("%Y-%m-%d"),
        "last_date": calendar[-1].strftime("%Y-%m-%d"),
        "calendar_days": int(len(calendar)),
        "symbols_written": written,
        "symbols_skipped": skipped,
        "symbols_with_suspect_jumps": suspect,
    }
    (OUT_DIR / "meta.json").write_text(json.dumps(meta, indent=2))
    print(f"Wrote {written} tickers, {len(calendar)} days ({meta['first_date']} to {meta['last_date']}).")
    print(f"Skipped {len(skipped)}: {skipped}")
    print(f"Suspect jumps (>50% in a day): {suspect}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
