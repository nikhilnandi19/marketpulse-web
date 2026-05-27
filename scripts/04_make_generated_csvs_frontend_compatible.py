# scripts/04_make_generated_csvs_frontend_compatible.py

from pathlib import Path
import numpy as np
import pandas as pd


GENERATED_DIR = Path("data/live/generated")

COMPANY_PATH = GENERATED_DIR / "marketpulse_dashboard_company_summary.csv"
FUTURE_PATH = GENERATED_DIR / "marketpulse_dashboard_future_forecast_wide.csv"
BACKTEST_PATH = GENERATED_DIR / "marketpulse_dashboard_actual_vs_predicted_wide.csv"
WEIGHTS_PATH = GENERATED_DIR / "marketpulse_model_dynamic_weights.csv"

SECTOR_OUT = GENERATED_DIR / "marketpulse_dashboard_sector_summary.csv"
KPIS_OUT = GENERATED_DIR / "marketpulse_dashboard_kpis.csv"
ERROR_DIST_OUT = GENERATED_DIR / "marketpulse_dashboard_model_error_distribution.csv"


MODEL_PREDICTION_MAP = {
    "naive": "predicted_naive",
    "moving_average_30d": "predicted_moving_average_30d",
    "drift": "predicted_drift",
    "recent_linear_trend_252d": "predicted_recent_linear_trend_252d",
    "recent_momentum_10d": "predicted_recent_momentum_10d",
    "adaptive_blended_momentum": "predicted_adaptive_blended_momentum",
}


def safe_mean(series):
    series = pd.to_numeric(series, errors="coerce")
    if series.dropna().empty:
        return np.nan
    return float(series.mean())


def compute_model_error_metrics(backtest: pd.DataFrame) -> pd.DataFrame:
    rows = []

    for symbol, group in backtest.groupby("symbol"):
        actual = pd.to_numeric(group["actual_price"], errors="coerce")

        for model_name, pred_col in MODEL_PREDICTION_MAP.items():
            if pred_col not in group.columns:
                continue

            predicted = pd.to_numeric(group[pred_col], errors="coerce")

            valid = pd.DataFrame(
                {
                    "actual": actual,
                    "predicted": predicted,
                }
            ).dropna()

            valid = valid[valid["actual"] > 0]

            if valid.empty:
                mae = np.nan
                rmse = np.nan
                mape = np.nan
            else:
                error = valid["predicted"] - valid["actual"]
                mae = float(error.abs().mean())
                rmse = float(np.sqrt((error ** 2).mean()))
                mape = float((error.abs() / valid["actual"] * 100).mean())

            rows.append(
                {
                    "symbol": symbol,
                    "model_name": model_name,
                    "model_mae": mae,
                    "model_rmse": rmse,
                    "model_mape": mape,
                }
            )

    metrics = pd.DataFrame(rows)

    best = (
        metrics.sort_values(["symbol", "model_mape"])
        .groupby("symbol")
        .first()
        .reset_index()
        .rename(
            columns={
                "model_name": "best_model_name",
                "model_mae": "best_model_mae",
                "model_rmse": "best_model_rmse",
                "model_mape": "best_model_mape",
            }
        )
    )

    return best


def classify_model_reliability(mape):
    if pd.isna(mape):
        return "Unknown"
    if mape <= 2:
        return "High"
    if mape <= 5:
        return "Moderate"
    return "Low"


def make_company_compatible(company: pd.DataFrame, future: pd.DataFrame, backtest: pd.DataFrame) -> pd.DataFrame:
    company = company.copy()

    best_metrics = compute_model_error_metrics(backtest)

    company = company.drop(
        columns=[
            col
            for col in ["best_model_name", "best_model_mae", "best_model_rmse", "best_model_mape"]
            if col in company.columns
        ],
        errors="ignore",
    )

    company = company.merge(best_metrics, on="symbol", how="left")

    f30 = future[future["forecast_horizon"] == 30].copy()

    f30_keep = [
        "symbol",
        "forecast_date",
        "latest_date",
        "latest_close",
        "forecast_lower_band",
        "forecast_upper_band",
        "forecast_naive",
        "forecast_moving_average_30d",
        "forecast_drift",
        "forecast_recent_linear_trend_252d",
        "forecast_recent_momentum_10d",
        "forecast_adaptive_blended_momentum",
        "forecast_weighted_ensemble",
        "forecast_weighted_ensemble_upside_pct",
    ]

    f30 = f30[[col for col in f30_keep if col in f30.columns]].copy()

    rename_f30 = {
        "forecast_date": "forecast_30d_date_live",
        "latest_date": "latest_date_live",
        "latest_close": "latest_close_live",
        "forecast_lower_band": "forecast_lower_band_30d",
        "forecast_upper_band": "forecast_upper_band_30d",
        "forecast_naive": "forecast_naive_30d",
        "forecast_moving_average_30d": "forecast_moving_average_30d_30d",
        "forecast_drift": "forecast_drift_30d",
        "forecast_recent_linear_trend_252d": "forecast_recent_linear_trend_252d_30d",
        "forecast_recent_momentum_10d": "forecast_recent_momentum_10d_30d",
        "forecast_adaptive_blended_momentum": "forecast_adaptive_blended_momentum_30d",
        "forecast_weighted_ensemble": "forecast_weighted_ensemble_30d",
        "forecast_weighted_ensemble_upside_pct": "forecast_weighted_ensemble_upside_pct_30d",
    }

    f30 = f30.rename(columns=rename_f30)

    # Drop columns that are about to be re-added from the fresh Day-30 forecast.
    # This prevents pandas merge suffix conflicts when the script is rerun.
    duplicate_merge_cols = [
        col for col in f30.columns
        if col != "symbol" and col in company.columns
    ]

    if duplicate_merge_cols:
        company = company.drop(columns=duplicate_merge_cols)

    company = company.merge(f30, on="symbol", how="left")

    if "latest_close_live" in company.columns:
        company["latest_close"] = company["latest_close_live"]
        company["latest_price"] = company["latest_close_live"]
        company["current_price"] = company["latest_close_live"]

    if "latest_date_live" in company.columns:
        company["latest_date"] = company["latest_date_live"]

    if "forecast_30d_date_live" in company.columns:
        company["forecast_30d_date"] = company["forecast_30d_date_live"]

    if "forecast_weighted_ensemble_30d" in company.columns:
        company["forecast_30d_price"] = company["forecast_weighted_ensemble_30d"]
        company["main_forecast_price_30d"] = company["forecast_weighted_ensemble_30d"]

    if "forecast_weighted_ensemble_upside_pct_30d" in company.columns:
        company["forecast_30d_upside_pct"] = company["forecast_weighted_ensemble_upside_pct_30d"]
        company["forecast_upside_pct"] = company["forecast_weighted_ensemble_upside_pct_30d"]

    if "annualized_volatility" in company.columns:
        company["annualized_volatility_pct"] = pd.to_numeric(
            company["annualized_volatility"], errors="coerce"
        ) * 100

    if "best_model_mape" in company.columns:
        company["model_reliability"] = company["best_model_mape"].apply(classify_model_reliability)

    if "investment_signal" in company.columns:
        company["final_signal"] = company["investment_signal"]

    company["dashboard_forecast_method"] = "Weighted Ensemble"
    company["main_forecast_model"] = "Weighted Ensemble"
    company["main_directional_model"] = "Adaptive Momentum"
    company["weighted_ensemble_method"] = "Constrained dynamic ensemble excluding XGBoost"

    # Keep old frontend-friendly columns even if values are unavailable.
    for col in [
        "first_date",
        "trading_days",
        "total_return_pct",
        "avg_daily_return_pct",
        "sector_median_volatility_pct",
        "volatility_vs_sector_pct",
        "sector_relative_risk",
        "revenue",
        "net_income",
        "ebitda",
        "eps",
        "profit_margin_pct",
        "sector_median_profit_margin_pct",
        "profit_margin_vs_sector_pct",
        "ebitda_margin_pct",
        "sector_median_ebitda_margin_pct",
        "ebitda_margin_vs_sector_pct",
        "fundamental_label",
        "review_reason",
    ]:
        if col not in company.columns:
            company[col] = np.nan

    company = company.sort_values(["sector", "symbol"]).reset_index(drop=True)

    company.to_csv(COMPANY_PATH, index=False)

    return company


def make_sector_summary(company: pd.DataFrame) -> pd.DataFrame:
    rows = []

    for sector, group in company.groupby("sector", dropna=False):
        sector_name = sector if pd.notna(sector) else "Unknown"

        rows.append(
            {
                "sector": sector_name,
                "number_of_companies": int(len(group)),
                "avg_forecast_30d_upside_pct": safe_mean(group["forecast_30d_upside_pct"]),
                "min_forecast_30d_upside_pct": float(pd.to_numeric(group["forecast_30d_upside_pct"], errors="coerce").min()),
                "max_forecast_30d_upside_pct": float(pd.to_numeric(group["forecast_30d_upside_pct"], errors="coerce").max()),
                "avg_model_mape": safe_mean(group["best_model_mape"]),
                "avg_annualized_volatility_pct": safe_mean(group["annualized_volatility_pct"]),
                "avg_profit_margin_pct": safe_mean(group["profit_margin_pct"]) if "profit_margin_pct" in group.columns else np.nan,
                "avg_ebitda_margin_pct": safe_mean(group["ebitda_margin_pct"]) if "ebitda_margin_pct" in group.columns else np.nan,
                "positive_forecast_count": int((group["forecast_signal"] == "Positive Forecast").sum()),
                "neutral_forecast_count": int((group["forecast_signal"] == "Neutral Forecast").sum()),
                "negative_forecast_count": int((group["forecast_signal"] == "Negative Forecast").sum()),
                "potential_opportunity_count": int((group["final_signal"] == "Potential Opportunity").sum()),
                "stable_watchlist_count": int((group["final_signal"] == "Stable Watchlist").sum()),
                "needs_further_review_count": int((group["final_signal"] == "Needs Further Review").sum()),
                "weak_negative_count": int((group["final_signal"] == "Weak Fundamentals / Negative Forecast").sum()),
                "high_volatility_speculative_count": int((group["final_signal"] == "High Volatility Speculative").sum()),
            }
        )

    sector = pd.DataFrame(rows)
    sector = sector.sort_values("avg_forecast_30d_upside_pct", ascending=False).reset_index(drop=True)
    sector.to_csv(SECTOR_OUT, index=False)

    return sector


def make_kpis(company: pd.DataFrame, future: pd.DataFrame, backtest: pd.DataFrame, weights: pd.DataFrame) -> pd.DataFrame:
    kpis = pd.DataFrame(
        [
            {
                "companies_analyzed": int(company["symbol"].nunique()),
                "avg_forecast_30d_upside_pct": safe_mean(company["forecast_30d_upside_pct"]),
                "avg_model_mape": safe_mean(company["best_model_mape"]),
                "avg_annualized_volatility_pct": safe_mean(company["annualized_volatility_pct"]),
                "avg_profit_margin_pct": safe_mean(company["profit_margin_pct"]) if "profit_margin_pct" in company.columns else np.nan,
                "positive_forecast_count": int((company["forecast_signal"] == "Positive Forecast").sum()),
                "neutral_forecast_count": int((company["forecast_signal"] == "Neutral Forecast").sum()),
                "negative_forecast_count": int((company["forecast_signal"] == "Negative Forecast").sum()),
                "potential_opportunities": int((company["final_signal"] == "Potential Opportunity").sum()),
                "stable_watchlist": int((company["final_signal"] == "Stable Watchlist").sum()),
                "needs_further_review": int((company["final_signal"] == "Needs Further Review").sum()),
                "weak_negative": int((company["final_signal"] == "Weak Fundamentals / Negative Forecast").sum()),
                "high_volatility_speculative": int((company["final_signal"] == "High Volatility Speculative").sum()),
                "latest_market_date": str(future["latest_date"].max()),
                "forecast_horizon_days": 30,
                "backtest_window_days": 90,
                "future_forecast_rows": int(len(future)),
                "backtest_rows": int(len(backtest)),
                "dynamic_weight_rows": int(len(weights)),
            }
        ]
    )

    kpis.to_csv(KPIS_OUT, index=False)

    return kpis


def make_model_error_distribution(company: pd.DataFrame) -> pd.DataFrame:
    mape = pd.to_numeric(company["best_model_mape"], errors="coerce")

    conditions = [
        mape <= 1,
        (mape > 1) & (mape <= 2),
        (mape > 2) & (mape <= 5),
        (mape > 5) & (mape <= 10),
        mape > 10,
    ]

    labels = [
        "Elite Reliability",
        "Very Strong Reliability",
        "Strong Reliability",
        "Moderate Reliability",
        "Higher Error",
    ]

    orders = {
        "Elite Reliability": 1,
        "Very Strong Reliability": 2,
        "Strong Reliability": 3,
        "Moderate Reliability": 4,
        "Higher Error": 5,
    }

    company = company.copy()
    company["model_error_band"] = np.select(conditions, labels, default="Higher Error")

    dist = (
        company.groupby("model_error_band")
        .size()
        .reset_index(name="company_count")
    )

    dist["model_error_band_order"] = dist["model_error_band"].map(orders)

    dist = dist[
        [
            "model_error_band",
            "model_error_band_order",
            "company_count",
        ]
    ].sort_values("model_error_band_order")

    dist.to_csv(ERROR_DIST_OUT, index=False)

    return dist


def main() -> None:
    company = pd.read_csv(COMPANY_PATH)
    future = pd.read_csv(FUTURE_PATH)
    backtest = pd.read_csv(BACKTEST_PATH)
    weights = pd.read_csv(WEIGHTS_PATH)

    print("Loaded generated CSVs")
    print("Company rows:", len(company))
    print("Future rows:", len(future))
    print("Backtest rows:", len(backtest))
    print("Weights rows:", len(weights))

    company = make_company_compatible(company, future, backtest)
    sector = make_sector_summary(company)
    kpis = make_kpis(company, future, backtest, weights)
    error_dist = make_model_error_distribution(company)

    print("\nCompatibility patch complete")

    print("\nCompany")
    print("Rows:", len(company))
    print("Symbols:", company["symbol"].nunique())
    print("Columns:", len(company.columns))

    print("\nSector")
    print("Rows:", len(sector))
    print("Columns:", len(sector.columns))

    print("\nKPIs")
    print("Rows:", len(kpis))
    print("Columns:", len(kpis.columns))

    print("\nModel error distribution")
    print(error_dist.to_string(index=False))

    print("\nKey KPI row:")
    print(kpis.to_string(index=False))


if __name__ == "__main__":
    main()
