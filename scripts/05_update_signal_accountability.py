# scripts/05_update_signal_accountability.py
"""
Signal Accountability Tracker — pipeline step 05.

Each pipeline run:
  1. Determines the current market date from freshly generated CSVs.
  2. Reads the existing snapshot history from public/data (if any).
  3. Appends one new row per symbol for any (snapshot_date, symbol) pair
     not already present — fully idempotent.
  4. Re-evaluates outcomes for all non-complete rows using live prices.
  5. Writes four output files to data/live/generated/:
       - marketpulse_signal_snapshots.csv
       - marketpulse_signal_performance_summary.csv
       - marketpulse_signal_performance_by_sector.csv
       - marketpulse_signal_performance_by_risk.csv

The run_live_data_pipeline.sh step then copies data/live/generated/* into
public/data alongside all other generated CSVs.

Inputs
------
  data/live/sp500_prices_live.csv
  data/live/generated/marketpulse_dashboard_company_summary.csv
  data/live/generated/marketpulse_dashboard_kpis.csv          (optional)
  public/data/marketpulse_signal_snapshots.csv                (optional, preserved)

Output columns — marketpulse_signal_snapshots.csv
--------------------------------------------------
  snapshot_date, symbol, company_name, sector, industry,
  latest_close, forecast_30d_price, forecast_30d_upside_pct,
  forecast_signal, final_signal, investment_signal,
  risk_level, model_reliability, annualized_volatility_pct,
  best_model_mape, dashboard_forecast_method,
  return_5d_pct, return_10d_pct, return_30d_pct,
  direction_correct_5d, direction_correct_10d, direction_correct_30d,
  hit_5d, hit_10d, hit_30d,
  outcome_status
"""

from pathlib import Path
from typing import Optional
import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

PRICE_PATH = Path("data/live/sp500_prices_live.csv")
COMPANY_PATH = Path("data/live/generated/marketpulse_dashboard_company_summary.csv")
KPIS_PATH = Path("data/live/generated/marketpulse_dashboard_kpis.csv")

# Read existing history from public/data (preserves rows across pipeline runs)
EXISTING_SNAPSHOT_PATH = Path("public/data/marketpulse_signal_snapshots.csv")

GENERATED_DIR = Path("data/live/generated")

SNAPSHOT_OUT = GENERATED_DIR / "marketpulse_signal_snapshots.csv"
SUMMARY_OUT = GENERATED_DIR / "marketpulse_signal_performance_summary.csv"
BY_SECTOR_OUT = GENERATED_DIR / "marketpulse_signal_performance_by_sector.csv"
BY_RISK_OUT = GENERATED_DIR / "marketpulse_signal_performance_by_risk.csv"

# Authoritative column order for the snapshot CSV
SNAPSHOT_COLS = [
    "snapshot_date",
    "symbol",
    "company_name",
    "sector",
    "industry",
    "latest_close",
    "forecast_30d_price",
    "forecast_30d_upside_pct",
    "forecast_signal",
    "final_signal",
    "investment_signal",
    "risk_level",
    "model_reliability",
    "annualized_volatility_pct",
    "best_model_mape",
    "dashboard_forecast_method",
    "return_5d_pct",
    "return_10d_pct",
    "return_30d_pct",
    "direction_correct_5d",
    "direction_correct_10d",
    "direction_correct_30d",
    "hit_5d",
    "hit_10d",
    "hit_30d",
    "outcome_status",
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _first_valid(row: pd.Series, candidates: list) -> object:
    """Return the first non-null value from a list of column names."""
    for col in candidates:
        if col in row.index:
            val = row[col]
            if pd.notna(val) and str(val).strip() not in ("", "nan", "None"):
                return val
    return np.nan


def _bool_to_int(b) -> object:
    """Convert a boolean or None to 1 / 0 / NaN for clean CSV round-trips."""
    if b is None or (isinstance(b, float) and np.isnan(b)):
        return np.nan
    return 1 if b else 0


def _safe_mean(series: pd.Series) -> object:
    vals = pd.to_numeric(series, errors="coerce").dropna()
    return round(float(vals.mean()), 4) if len(vals) > 0 else np.nan


def _hit_rate(series: pd.Series) -> object:
    """Hit rate as a percentage (0–100).  Handles 1/0/NaN columns."""
    vals = pd.to_numeric(series, errors="coerce").dropna()
    return round(float(vals.mean() * 100), 2) if len(vals) > 0 else np.nan


# ---------------------------------------------------------------------------
# 1. Determine snapshot date
# ---------------------------------------------------------------------------

def determine_snapshot_date(company: pd.DataFrame) -> str:
    """
    Priority order:
      1. latest_market_date from the freshly generated KPIs CSV
      2. latest_date from the company summary
      3. max date from the live prices file
    """
    if KPIS_PATH.exists():
        try:
            kpis = pd.read_csv(KPIS_PATH)
            if "latest_market_date" in kpis.columns:
                val = str(kpis["latest_market_date"].iloc[0]).strip()
                if val and val not in ("nan", "None", ""):
                    return val
        except Exception:
            pass

    for col in ["latest_date", "latest_date_live", "latest_date_price_feature"]:
        if col in company.columns:
            parsed = pd.to_datetime(company[col], errors="coerce").dropna()
            if len(parsed) > 0:
                return str(parsed.max().date())

    prices = pd.read_csv(PRICE_PATH, usecols=["date"])
    prices["date"] = pd.to_datetime(prices["date"], errors="coerce")
    return str(prices["date"].dropna().max().date())


# ---------------------------------------------------------------------------
# 2. Load existing snapshot history
# ---------------------------------------------------------------------------

def load_existing_snapshots() -> pd.DataFrame:
    """
    Load the existing snapshot CSV from public/data.
    All columns are read as strings so NaN-sensitive coercion happens later.
    Returns an empty DataFrame with the correct schema on first run.
    """
    if EXISTING_SNAPSHOT_PATH.exists():
        df = pd.read_csv(EXISTING_SNAPSHOT_PATH, dtype=str)
        # Add any missing columns silently (schema evolution)
        for col in SNAPSHOT_COLS:
            if col not in df.columns:
                df[col] = ""
        df = df[SNAPSHOT_COLS]
        print(f"  Loaded {len(df):,} existing snapshot rows "
              f"({df['snapshot_date'].nunique()} unique dates).")
        return df

    print("  No existing snapshot file — starting fresh.")
    return pd.DataFrame(columns=SNAPSHOT_COLS)


# ---------------------------------------------------------------------------
# 3. Build new snapshot rows for today's market date
# ---------------------------------------------------------------------------

def build_new_rows(company: pd.DataFrame, snapshot_date: str) -> pd.DataFrame:
    """
    Construct one row per symbol from the freshly generated company summary.
    Outcome columns are left blank — they will be filled by evaluate_outcomes().
    """
    rows = []

    for _, r in company.iterrows():
        latest_close = _first_valid(r, [
            "latest_close", "latest_close_live", "latest_close_price_feature", "current_price",
        ])
        annualized_vol = _first_valid(r, [
            "annualized_volatility_pct", "annualized_volatility", "volatility_90d",
        ])
        best_mape = _first_valid(r, [
            "best_model_mape", "best_model_recent_mape", "avg_recent_model_mape",
        ])
        forecast_method = _first_valid(r, [
            "dashboard_forecast_method", "weighted_ensemble_method", "main_forecast_model",
        ])

        rows.append({
            "snapshot_date":            snapshot_date,
            "symbol":                   str(r.get("symbol", "")).upper().strip(),
            "company_name":             str(r.get("company_name", "")),
            "sector":                   str(r.get("sector", "")),
            "industry":                 str(r.get("industry", "")),
            "latest_close":             latest_close,
            "forecast_30d_price":       _first_valid(r, ["forecast_30d_price"]),
            "forecast_30d_upside_pct":  _first_valid(r, ["forecast_30d_upside_pct", "forecast_upside_pct"]),
            "forecast_signal":          _first_valid(r, ["forecast_signal"]),
            "final_signal":             _first_valid(r, ["final_signal"]),
            "investment_signal":        _first_valid(r, ["investment_signal"]),
            "risk_level":               _first_valid(r, ["risk_level"]),
            "model_reliability":        _first_valid(r, ["model_reliability"]),
            "annualized_volatility_pct": annualized_vol,
            "best_model_mape":          best_mape,
            "dashboard_forecast_method": forecast_method,
            # Outcome columns — blank until evaluate_outcomes() runs
            "return_5d_pct":            np.nan,
            "return_10d_pct":           np.nan,
            "return_30d_pct":           np.nan,
            "direction_correct_5d":     np.nan,
            "direction_correct_10d":    np.nan,
            "direction_correct_30d":    np.nan,
            "hit_5d":                   np.nan,
            "hit_10d":                  np.nan,
            "hit_30d":                  np.nan,
            "outcome_status":           "pending",
        })

    df = pd.DataFrame(rows, columns=SNAPSHOT_COLS)
    return df


# ---------------------------------------------------------------------------
# 4. Outcome evaluation
# ---------------------------------------------------------------------------

def load_prices_by_symbol() -> dict:
    """
    Load the live prices CSV and return a dict:
        { SYMBOL: DataFrame sorted by date with index reset }
    Only keeps 'date' and 'close' columns to keep memory lean.
    """
    prices = pd.read_csv(PRICE_PATH, usecols=["date", "symbol", "close"])
    prices["date"]   = pd.to_datetime(prices["date"],   errors="coerce")
    prices["close"]  = pd.to_numeric(prices["close"],   errors="coerce")
    prices["symbol"] = prices["symbol"].astype(str).str.upper().str.strip()
    prices = prices.dropna(subset=["date", "symbol", "close"])
    prices = prices.sort_values(["symbol", "date"])

    result: dict = {}
    for symbol, group in prices.groupby("symbol"):
        result[symbol] = group[["date", "close"]].reset_index(drop=True)
    return result


def _forward_return(
    series: pd.DataFrame,
    snapshot_date_str: str,
    n_sessions: int,
) -> Optional[float]:
    """
    Compute the percentage return from the snapshot date (or the nearest
    available trading date on/after it) to n_sessions trading days later.

    Returns None if:
      - the snapshot date is beyond the available price history, or
      - there are fewer than n_sessions trading days after the anchor date.
    """
    anchor_dt = pd.Timestamp(snapshot_date_str)

    # Find the anchor row: first trading date on or after snapshot_date
    on_or_after = series[series["date"] >= anchor_dt]
    if on_or_after.empty:
        return None

    anchor_idx   = int(on_or_after.index[0])
    forward_idx  = anchor_idx + n_sessions

    # Check that forward_idx exists in the (0-based, contiguous) index
    if forward_idx >= len(series):
        return None

    anchor_close  = float(series.loc[anchor_idx, "close"])
    forward_close = float(series.loc[forward_idx, "close"])

    if anchor_close <= 0 or np.isnan(anchor_close):
        return None

    return (forward_close - anchor_close) / anchor_close * 100


def evaluate_outcomes(snapshots: pd.DataFrame, prices_by_symbol: dict) -> pd.DataFrame:
    """
    For every non-complete row, attempt to fill in 5d / 10d / 30d outcome columns.
    Existing complete rows are left unchanged.
    Returns the updated DataFrame.
    """
    df = snapshots.copy()

    # Coerce numeric columns that were loaded as strings
    for col in ["return_5d_pct", "return_10d_pct", "return_30d_pct",
                "hit_5d", "hit_10d", "hit_30d",
                "forecast_30d_upside_pct"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    updated = 0

    for idx in df.index:
        row = df.loc[idx]

        # Skip rows already marked complete
        if str(row.get("outcome_status", "")).strip() == "complete":
            continue

        symbol        = str(row["symbol"]).upper().strip()
        snapshot_date = str(row["snapshot_date"]).strip()
        series        = prices_by_symbol.get(symbol)

        if series is None or series.empty:
            continue

        ret5  = _forward_return(series, snapshot_date, 5)
        ret10 = _forward_return(series, snapshot_date, 10)
        ret30 = _forward_return(series, snapshot_date, 30)

        if ret5 is None and ret10 is None and ret30 is None:
            continue  # no new data available yet

        forecast_upside = pd.to_numeric(row.get("forecast_30d_upside_pct"), errors="coerce")

        def _direction(ret: Optional[float]) -> object:
            """Return 1 (correct), 0 (wrong), or NaN (indeterminate)."""
            if ret is None or np.isnan(ret):
                return np.nan
            if pd.isna(forecast_upside) or forecast_upside == 0:
                return np.nan
            return _bool_to_int((ret > 0) == (forecast_upside > 0))

        if ret5 is not None:
            dc5 = _direction(ret5)
            df.at[idx, "return_5d_pct"]        = round(ret5, 4)
            df.at[idx, "direction_correct_5d"]  = dc5
            df.at[idx, "hit_5d"]                = dc5

        if ret10 is not None:
            dc10 = _direction(ret10)
            df.at[idx, "return_10d_pct"]        = round(ret10, 4)
            df.at[idx, "direction_correct_10d"] = dc10
            df.at[idx, "hit_10d"]               = dc10

        if ret30 is not None:
            dc30 = _direction(ret30)
            df.at[idx, "return_30d_pct"]        = round(ret30, 4)
            df.at[idx, "direction_correct_30d"] = dc30
            df.at[idx, "hit_30d"]               = dc30

        # Update outcome_status
        if ret30 is not None:
            df.at[idx, "outcome_status"] = "complete"
        elif ret5 is not None or ret10 is not None:
            df.at[idx, "outcome_status"] = "partial"

        updated += 1

    print(f"  Outcome rows updated: {updated:,}")
    return df


# ---------------------------------------------------------------------------
# 5. Performance aggregations
# ---------------------------------------------------------------------------

def _resolve_signal_category(row: pd.Series) -> str:
    """Return final_signal > investment_signal > forecast_signal > 'Unknown'."""
    for col in ("final_signal", "investment_signal", "forecast_signal"):
        val = str(row.get(col, "")).strip()
        if val and val not in ("nan", "None", ""):
            return val
    return "Unknown"


def build_summary(snapshots: pd.DataFrame) -> pd.DataFrame:
    """Group by signal category."""
    df = snapshots.copy()
    df["signal_category"] = df.apply(_resolve_signal_category, axis=1)

    for col in ["forecast_30d_upside_pct",
                "return_5d_pct", "return_10d_pct", "return_30d_pct",
                "hit_5d", "hit_10d", "hit_30d"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    rows = []
    for cat, g in df.groupby("signal_category", dropna=False):
        rows.append({
            "signal_category":          cat,
            "snapshot_count":           len(g),
            "pending_count":            int((g["outcome_status"] == "pending").sum()),
            "partial_count":            int((g["outcome_status"] == "partial").sum()),
            "complete_count":           int((g["outcome_status"] == "complete").sum()),
            "avg_forecast_30d_upside_pct": _safe_mean(g["forecast_30d_upside_pct"]),
            "avg_return_5d_pct":        _safe_mean(g["return_5d_pct"]),
            "avg_return_10d_pct":       _safe_mean(g["return_10d_pct"]),
            "avg_return_30d_pct":       _safe_mean(g["return_30d_pct"]),
            "hit_rate_5d_pct":          _hit_rate(g["hit_5d"]),
            "hit_rate_10d_pct":         _hit_rate(g["hit_10d"]),
            "hit_rate_30d_pct":         _hit_rate(g["hit_30d"]),
        })

    return (
        pd.DataFrame(rows)
        .sort_values("snapshot_count", ascending=False)
        .reset_index(drop=True)
    )


def _sector_or_risk_block(df: pd.DataFrame, group_col: str, out_col: str) -> pd.DataFrame:
    """Shared aggregation logic for sector and risk summaries."""
    for col in ["forecast_30d_upside_pct",
                "return_5d_pct", "return_10d_pct", "return_30d_pct", "hit_30d"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    rows = []
    for val, g in df.groupby(group_col, dropna=False):
        rows.append({
            out_col:                       val,
            "snapshot_count":              len(g),
            "complete_count":              int((g["outcome_status"] == "complete").sum()),
            "avg_forecast_30d_upside_pct": _safe_mean(g["forecast_30d_upside_pct"]),
            "avg_return_5d_pct":           _safe_mean(g["return_5d_pct"]),
            "avg_return_10d_pct":          _safe_mean(g["return_10d_pct"]),
            "avg_return_30d_pct":          _safe_mean(g["return_30d_pct"]),
            "hit_rate_30d_pct":            _hit_rate(g["hit_30d"]),
        })

    return (
        pd.DataFrame(rows)
        .sort_values("snapshot_count", ascending=False)
        .reset_index(drop=True)
    )


def build_by_sector(snapshots: pd.DataFrame) -> pd.DataFrame:
    return _sector_or_risk_block(snapshots.copy(), "sector", "sector")


def build_by_risk(snapshots: pd.DataFrame) -> pd.DataFrame:
    return _sector_or_risk_block(snapshots.copy(), "risk_level", "risk_level")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    # ── Load company summary ──────────────────────────────────────────────
    if not COMPANY_PATH.exists():
        raise FileNotFoundError(f"Missing required file: {COMPANY_PATH}")

    print("Loading company summary...")
    company = pd.read_csv(COMPANY_PATH)
    company["symbol"] = company["symbol"].astype(str).str.upper().str.strip()
    print(f"  Symbols: {company['symbol'].nunique():,}  Rows: {len(company):,}")

    # ── Determine snapshot date ───────────────────────────────────────────
    print("Determining snapshot date...")
    snapshot_date = determine_snapshot_date(company)
    print(f"  Snapshot date: {snapshot_date}")

    # ── Load existing history ─────────────────────────────────────────────
    print("Loading existing snapshot history...")
    existing = load_existing_snapshots()

    # Build a set of (snapshot_date, symbol) pairs already present
    if len(existing) > 0:
        existing_pairs: set = set(
            zip(existing["snapshot_date"].astype(str).str.strip(),
                existing["symbol"].astype(str).str.upper().str.strip())
        )
    else:
        existing_pairs = set()

    # ── Build new rows ────────────────────────────────────────────────────
    print(f"Building new snapshot rows for {snapshot_date}...")
    new_rows = build_new_rows(company, snapshot_date)

    # Filter out any (date, symbol) that already exists
    new_rows = new_rows[
        ~new_rows.apply(
            lambda r: (str(r["snapshot_date"]).strip(),
                       str(r["symbol"]).upper().strip()) in existing_pairs,
            axis=1,
        )
    ].reset_index(drop=True)

    print(f"  New rows to append: {len(new_rows):,}  "
          f"(already existed: {len(company) - len(new_rows):,})")

    # ── Combine existing + new ────────────────────────────────────────────
    if len(existing) > 0 and len(new_rows) > 0:
        combined = pd.concat([existing, new_rows], ignore_index=True)
    elif len(existing) > 0:
        combined = existing.copy()
    else:
        combined = new_rows.copy()

    # Guarantee all schema columns exist in the correct order
    for col in SNAPSHOT_COLS:
        if col not in combined.columns:
            combined[col] = np.nan
    combined = combined[SNAPSHOT_COLS]

    print(f"  Combined rows before outcome evaluation: {len(combined):,}")

    # ── Evaluate outcomes ─────────────────────────────────────────────────
    if not PRICE_PATH.exists():
        raise FileNotFoundError(f"Missing required file: {PRICE_PATH}")

    print("Loading live prices for outcome evaluation...")
    prices_by_symbol = load_prices_by_symbol()
    print(f"  Price symbols loaded: {len(prices_by_symbol):,}")

    print("Evaluating outcomes for non-complete rows...")
    combined = evaluate_outcomes(combined, prices_by_symbol)

    # ── Write snapshot CSV ────────────────────────────────────────────────
    for col in SNAPSHOT_COLS:
        if col not in combined.columns:
            combined[col] = np.nan
    combined = combined[SNAPSHOT_COLS]

    combined.to_csv(SNAPSHOT_OUT, index=False)

    status_dist = combined["outcome_status"].value_counts().to_dict()
    unique_dates = sorted(combined["snapshot_date"].dropna().unique())

    print(f"\nSignal snapshots saved: {SNAPSHOT_OUT}")
    print(f"  Total rows:    {len(combined):,}")
    print(f"  Unique dates:  {len(unique_dates):,}  ({unique_dates[0] if unique_dates else 'n/a'}"
          f" → {unique_dates[-1] if unique_dates else 'n/a'})")
    print(f"  outcome_status distribution: {status_dist}")

    # ── Write performance summaries ───────────────────────────────────────
    print("\nBuilding performance summaries...")

    summary = build_summary(combined)
    summary.to_csv(SUMMARY_OUT, index=False)
    print(f"  Signal performance summary:   {SUMMARY_OUT}  ({len(summary)} rows)")

    by_sector = build_by_sector(combined)
    by_sector.to_csv(BY_SECTOR_OUT, index=False)
    print(f"  Signal performance by sector: {BY_SECTOR_OUT}  ({len(by_sector)} rows)")

    by_risk = build_by_risk(combined)
    by_risk.to_csv(BY_RISK_OUT, index=False)
    print(f"  Signal performance by risk:   {BY_RISK_OUT}  ({len(by_risk)} rows)")


if __name__ == "__main__":
    main()
