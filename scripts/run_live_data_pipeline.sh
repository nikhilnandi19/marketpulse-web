#!/usr/bin/env bash
set -euo pipefail

echo "Starting MarketPulse live data pipeline..."

mkdir -p data/live
mkdir -p data/live/generated

echo "Step 1: Fetch live prices"
python scripts/01_fetch_live_prices.py

echo "Step 2: Generate forecast CSVs"
python scripts/02_generate_forecast_csvs.py

echo "Step 3: Generate remaining dashboard CSVs"
python scripts/03_generate_remaining_dashboard_csvs.py

echo "Step 4: Make generated CSVs frontend-compatible"
python scripts/04_make_generated_csvs_frontend_compatible.py

echo "Step 5: Update signal accountability tracker"
python scripts/05_update_signal_accountability.py

echo "Step 6: Copy generated CSVs into public/data"
cp data/live/generated/marketpulse_dashboard_company_summary.csv public/data/
cp data/live/generated/marketpulse_dashboard_future_forecast_wide.csv public/data/
cp data/live/generated/marketpulse_dashboard_actual_vs_predicted_wide.csv public/data/
cp data/live/generated/marketpulse_dashboard_sector_summary.csv public/data/
cp data/live/generated/marketpulse_dashboard_kpis.csv public/data/
cp data/live/generated/marketpulse_dashboard_model_error_distribution.csv public/data/
cp data/live/generated/marketpulse_signal_snapshots.csv public/data/
cp data/live/generated/marketpulse_signal_performance_summary.csv public/data/
cp data/live/generated/marketpulse_signal_performance_by_sector.csv public/data/
cp data/live/generated/marketpulse_signal_performance_by_risk.csv public/data/

echo "Step 7: Validate public CSVs"
python - <<'PY'
import pandas as pd
from pathlib import Path

required_files = [
    "marketpulse_dashboard_company_summary.csv",
    "marketpulse_dashboard_future_forecast_wide.csv",
    "marketpulse_dashboard_actual_vs_predicted_wide.csv",
    "marketpulse_dashboard_sector_summary.csv",
    "marketpulse_dashboard_kpis.csv",
    "marketpulse_dashboard_model_error_distribution.csv",
    "marketpulse_signal_snapshots.csv",
    "marketpulse_signal_performance_summary.csv",
    "marketpulse_signal_performance_by_sector.csv",
    "marketpulse_signal_performance_by_risk.csv",
]

base = Path("public/data")

for file_name in required_files:
    path = base / file_name
    if not path.exists():
        raise FileNotFoundError(f"Missing required public CSV: {path}")

future = pd.read_csv(base / "marketpulse_dashboard_future_forecast_wide.csv")
company = pd.read_csv(base / "marketpulse_dashboard_company_summary.csv")
backtest = pd.read_csv(base / "marketpulse_dashboard_actual_vs_predicted_wide.csv")

required_future_cols = [
    "symbol",
    "forecast_horizon",
    "latest_date",
    "latest_close",
    "forecast_weighted_ensemble",
    "forecast_weighted_ensemble_upside_pct",
]

missing_future_cols = [c for c in required_future_cols if c not in future.columns]
if missing_future_cols:
    raise ValueError(f"Future CSV missing columns: {missing_future_cols}")

if future.empty:
    raise ValueError("Future CSV is empty")

if company.empty:
    raise ValueError("Company summary CSV is empty")

if backtest.empty:
    raise ValueError("Backtest CSV is empty")

if future["forecast_weighted_ensemble"].isna().all():
    raise ValueError("Weighted ensemble is fully null")

print("Validation passed")
print("Company symbols:", company["symbol"].nunique())
print("Future rows:", len(future))
print("Future symbols:", future["symbol"].nunique())
print("Future latest_date:", future["latest_date"].min(), "to", future["latest_date"].max())
print("Backtest rows:", len(backtest))

# Signal accountability validation
snapshots = pd.read_csv(base / "marketpulse_signal_snapshots.csv")
summary   = pd.read_csv(base / "marketpulse_signal_performance_summary.csv")
by_sector = pd.read_csv(base / "marketpulse_signal_performance_by_sector.csv")
by_risk   = pd.read_csv(base / "marketpulse_signal_performance_by_risk.csv")

print("\nSignal accountability:")
print("  Snapshot rows:", len(snapshots))
print("  Snapshot unique dates:", snapshots["snapshot_date"].nunique(),
      "->", sorted(snapshots["snapshot_date"].dropna().unique()))
print("  Signal summary rows:", len(summary))
print("  Sector summary rows:", len(by_sector))
print("  Risk summary rows:", len(by_risk))
print("  Outcome status distribution:", snapshots["outcome_status"].value_counts().to_dict())
PY

echo "MarketPulse live data pipeline completed."
