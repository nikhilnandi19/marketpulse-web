# /public/data/

Place your Databricks CSV exports here. The dashboard loads them automatically.

## Required files

| File | Description |
|---|---|
| `marketpulse_dashboard_company_summary.csv` | Main company table — drives Explorer, Overview, Matrix |
| `marketpulse_dashboard_sector_summary.csv` | Sector-level aggregates — drives Sector Comparison |
| `marketpulse_dashboard_actual_vs_predicted_wide.csv` | Test-period predictions — drives Forecast Performance |
| `marketpulse_dashboard_future_forecast_wide.csv` | 30-day forward forecasts — drives Forecast Performance |
| `marketpulse_dashboard_kpis.csv` | Pre-computed KPIs — used for Overview cards (optional; computed from company CSV if missing) |

## Notes

- If files are missing, the app loads sample/demo data automatically
- CSVs must use the exact column names listed in the project documentation
- Numeric nulls should be empty strings (not "null" text) for correct parsing
- Date columns: ISO format preferred (YYYY-MM-DD)
