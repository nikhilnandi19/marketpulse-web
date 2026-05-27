# scripts/03_generate_remaining_dashboard_csvs.py

from pathlib import Path
import numpy as np
import pandas as pd


PRICE_PATH = Path("data/live/sp500_prices_live.csv")
OLD_COMPANY_PATH = Path("public/data/marketpulse_dashboard_company_summary.csv")
OLD_KPIS_PATH = Path("public/data/marketpulse_dashboard_kpis.csv")

GENERATED_DIR = Path("data/live/generated")

FUTURE_PATH = GENERATED_DIR / "marketpulse_dashboard_future_forecast_wide.csv"
BACKTEST_PATH = GENERATED_DIR / "marketpulse_dashboard_actual_vs_predicted_wide.csv"
WEIGHTS_PATH = GENERATED_DIR / "marketpulse_model_dynamic_weights.csv"

COMPANY_OUT = GENERATED_DIR / "marketpulse_dashboard_company_summary.csv"
SECTOR_OUT = GENERATED_DIR / "marketpulse_dashboard_sector_summary.csv"
KPIS_OUT = GENERATED_DIR / "marketpulse_dashboard_kpis.csv"
ERROR_DIST_OUT = GENERATED_DIR / "marketpulse_dashboard_model_error_distribution.csv"


def classify_forecast_signal(upside: float) -> str:
    if pd.isna(upside):
        return "Neutral Forecast"
    if upside >= 2:
        return "Positive Forecast"
    if upside <= -2:
        return "Negative Forecast"
    return "Neutral Forecast"


def classify_risk_level(annualized_volatility: float) -> str:
    if pd.isna(annualized_volatility):
        return "Unknown Risk"
    if annualized_volatility >= 0.55:
        return "High Risk"
    if annualized_volatility >= 0.35:
        return "Medium Risk"
    return "Low Risk"


def classify_model_reliability(best_mape: float) -> str:
    if pd.isna(best_mape):
        return "Unknown"
    if best_mape <= 2:
        return "High"
    if best_mape <= 5:
        return "Moderate"
    return "Low"


def classify_investment_signal(row: pd.Series) -> str:
    upside = row.get("forecast_30d_upside_pct", np.nan)
    volatility = row.get("annualized_volatility", np.nan)
    reliability = row.get("model_reliability", "Unknown")

    if pd.isna(upside):
        return "Needs Further Review"

    if not pd.isna(volatility) and volatility >= 0.65 and upside >= 5:
        return "High Volatility Speculative"

    if upside >= 5 and reliability != "Low":
        return "Potential Opportunity"

    if upside <= -5:
        return "Weak Fundamentals / Negative Forecast"

    if abs(upside) <= 2:
        return "Stable Watchlist"

    return "Needs Further Review"


def load_inputs():
    required_paths = [
        PRICE_PATH,
        OLD_COMPANY_PATH,
        FUTURE_PATH,
        BACKTEST_PATH,
        WEIGHTS_PATH,
    ]

    for path in required_paths:
        if not path.exists():
            raise FileNotFoundError(f"Missing required file: {path}")

    prices = pd.read_csv(PRICE_PATH)
    old_company = pd.read_csv(OLD_COMPANY_PATH)
    future = pd.read_csv(FUTURE_PATH)
    backtest = pd.read_csv(BACKTEST_PATH)
    weights = pd.read_csv(WEIGHTS_PATH)

    for df in [prices, old_company, future, backtest, weights]:
        if "symbol" in df.columns:
            df["symbol"] = df["symbol"].astype(str).str.upper().str.strip()

    prices["date"] = pd.to_datetime(prices["date"], errors="coerce")
    future["forecast_date"] = pd.to_datetime(future["forecast_date"], errors="coerce")
    future["latest_date"] = pd.to_datetime(future["latest_date"], errors="coerce")
    backtest["date"] = pd.to_datetime(backtest["date"], errors="coerce")

    return prices, old_company, future, backtest, weights


def calculate_price_features(prices: pd.DataFrame) -> pd.DataFrame:
    rows = []

    for symbol, group in prices.groupby("symbol"):
        group = group.sort_values("date").copy()

        latest_row = group.iloc[-1]

        close = pd.to_numeric(group["close"], errors="coerce")
        volume = pd.to_numeric(group["volume"], errors="coerce")

        log_returns = np.log(close / close.shift(1)).replace([np.inf, -np.inf], np.nan).dropna()

        recent_90_returns = log_returns.tail(90)

        annualized_volatility = (
            float(recent_90_returns.std() * np.sqrt(252))
            if len(recent_90_returns) >= 2
            else np.nan
        )

        avg_volume_30d = float(volume.tail(30).mean()) if len(volume.dropna()) > 0 else np.nan

        rows.append(
            {
                "symbol": symbol,
                "latest_date": latest_row["date"].date(),
                "latest_close": float(latest_row["close"]),
                "latest_price": float(latest_row["close"]),
                "current_price": float(latest_row["close"]),
                "annualized_volatility": annualized_volatility,
                "volatility_90d": annualized_volatility,
                "avg_volume_30d": avg_volume_30d,
                "price_history_rows": len(group),
            }
        )

    return pd.DataFrame(rows)


def calculate_model_features(weights: pd.DataFrame) -> pd.DataFrame:
    best = (
        weights.sort_values(["symbol", "recent_mape"])
        .groupby("symbol")
        .first()
        .reset_index()
    )

    best = best[
        [
            "symbol",
            "model_name",
            "recent_mape",
            "directional_accuracy",
        ]
    ].rename(
        columns={
            "model_name": "best_model_name",
            "recent_mape": "best_model_recent_mape",
            "directional_accuracy": "best_model_directional_accuracy",
        }
    )

    avg_mape = (
        weights.groupby("symbol")["recent_mape"]
        .mean()
        .reset_index()
        .rename(columns={"recent_mape": "avg_recent_model_mape"})
    )

    weight_pct = (
        weights.pivot_table(
            index="symbol",
            columns="model_name",
            values="final_weight_pct",
            aggfunc="first",
        )
        .reset_index()
    )

    weight_pct.columns = [
        "symbol" if col == "symbol" else f"weight_pct_{col}"
        for col in weight_pct.columns
    ]

    mape_wide = (
        weights.pivot_table(
            index="symbol",
            columns="model_name",
            values="recent_mape",
            aggfunc="first",
        )
        .reset_index()
    )

    mape_wide.columns = [
        "symbol" if col == "symbol" else f"recent_mape_{col}"
        for col in mape_wide.columns
    ]

    out = best.merge(avg_mape, on="symbol", how="left")
    out = out.merge(weight_pct, on="symbol", how="left")
    out = out.merge(mape_wide, on="symbol", how="left")

    out["model_reliability"] = out["best_model_recent_mape"].apply(classify_model_reliability)

    return out


def calculate_forecast_features(future: pd.DataFrame) -> pd.DataFrame:
    f30 = future[future["forecast_horizon"] == 30].copy()

    f30["forecast_30d_price"] = f30["forecast_weighted_ensemble"]
    f30["forecast_30d_upside_pct"] = f30["forecast_weighted_ensemble_upside_pct"]

    f30["weighted_ensemble_30d_price"] = f30["forecast_weighted_ensemble"]
    f30["weighted_ensemble_30d_upside_pct"] = f30["forecast_weighted_ensemble_upside_pct"]

    f30["adaptive_momentum_30d_price"] = f30["forecast_adaptive_blended_momentum"]
    f30["adaptive_momentum_30d_upside_pct"] = (
        (f30["forecast_adaptive_blended_momentum"] - f30["latest_close"])
        / f30["latest_close"]
        * 100
    )

    f30["naive_30d_price"] = f30["forecast_naive"]
    f30["drift_30d_price"] = f30["forecast_drift"]
    f30["moving_average_30d_price"] = f30["forecast_moving_average_30d"]
    f30["recent_momentum_10d_30d_price"] = f30["forecast_recent_momentum_10d"]
    f30["linear_trend_252d_30d_price"] = f30["forecast_recent_linear_trend_252d"]

    if "forecast_xgboost_direct" in f30.columns:
        f30["xgboost_direct_30d_price"] = f30["forecast_xgboost_direct"]
        f30["xgboost_direct_30d_upside_pct"] = f30["forecast_xgboost_direct_upside_pct"]
    else:
        f30["xgboost_direct_30d_price"] = np.nan
        f30["xgboost_direct_30d_upside_pct"] = np.nan

    keep_cols = [
        "symbol",
        "company_name",
        "sector",
        "industry",
        "latest_date",
        "latest_close",
        "forecast_date",
        "forecast_30d_price",
        "forecast_30d_upside_pct",
        "weighted_ensemble_30d_price",
        "weighted_ensemble_30d_upside_pct",
        "adaptive_momentum_30d_price",
        "adaptive_momentum_30d_upside_pct",
        "xgboost_direct_30d_price",
        "xgboost_direct_30d_upside_pct",
        "naive_30d_price",
        "drift_30d_price",
        "moving_average_30d_price",
        "recent_momentum_10d_30d_price",
        "linear_trend_252d_30d_price",
    ]

    return f30[[col for col in keep_cols if col in f30.columns]].copy()


def build_company_summary(
    old_company: pd.DataFrame,
    future: pd.DataFrame,
    prices: pd.DataFrame,
    weights: pd.DataFrame,
) -> pd.DataFrame:
    active_symbols = sorted(future["symbol"].unique())

    base = old_company[old_company["symbol"].isin(active_symbols)].copy()

    missing_base_symbols = sorted(set(active_symbols) - set(base["symbol"]))

    if missing_base_symbols:
        add_rows = pd.DataFrame({"symbol": missing_base_symbols})
        base = pd.concat([base, add_rows], ignore_index=True)

    price_features = calculate_price_features(prices)
    forecast_features = calculate_forecast_features(future)
    model_features = calculate_model_features(weights)

    updates = (
        forecast_features
        .merge(price_features, on="symbol", how="left", suffixes=("", "_price_feature"))
        .merge(model_features, on="symbol", how="left")
    )

    # Prefer forecast metadata if available, but keep old metadata if the old company file has richer fields.
    base = base.set_index("symbol")
    updates = updates.set_index("symbol")

    for col in updates.columns:
        base[col] = updates[col]

    company = base.reset_index()

    company["forecast_signal"] = company["forecast_30d_upside_pct"].apply(classify_forecast_signal)
    company["risk_level"] = company["annualized_volatility"].apply(classify_risk_level)
    company["investment_signal"] = company.apply(classify_investment_signal, axis=1)

    # Compatibility aliases for frontend flexibility.
    company["forecast_upside_pct"] = company["forecast_30d_upside_pct"]
    company["forecast_price_30d"] = company["forecast_30d_price"]
    company["main_forecast_price_30d"] = company["forecast_30d_price"]
    company["main_forecast_model"] = "Weighted Ensemble"
    company["main_directional_model"] = "Adaptive Momentum"
    company["weighted_ensemble_method"] = "Constrained dynamic ensemble excluding XGBoost"

    company = company.sort_values(["sector", "symbol"]).reset_index(drop=True)

    return company


def build_sector_summary(company: pd.DataFrame) -> pd.DataFrame:
    rows = []

    for sector, group in company.groupby("sector", dropna=False):
        sector_name = sector if pd.notna(sector) else "Unknown"

        top_row = group.sort_values("forecast_30d_upside_pct", ascending=False).head(1)

        rows.append(
            {
                "sector": sector_name,
                "company_count": len(group),
                "avg_latest_close": group["latest_close"].mean(),
                "avg_forecast_30d_upside_pct": group["forecast_30d_upside_pct"].mean(),
                "median_forecast_30d_upside_pct": group["forecast_30d_upside_pct"].median(),
                "avg_annualized_volatility": group["annualized_volatility"].mean(),
                "avg_recent_model_mape": group["avg_recent_model_mape"].mean(),
                "positive_forecast_count": (group["forecast_signal"] == "Positive Forecast").sum(),
                "neutral_forecast_count": (group["forecast_signal"] == "Neutral Forecast").sum(),
                "negative_forecast_count": (group["forecast_signal"] == "Negative Forecast").sum(),
                "potential_opportunity_count": (group["investment_signal"] == "Potential Opportunity").sum(),
                "weak_negative_count": (
                    group["investment_signal"] == "Weak Fundamentals / Negative Forecast"
                ).sum(),
                "high_risk_count": (group["risk_level"] == "High Risk").sum(),
                "top_upside_symbol": top_row["symbol"].iloc[0] if not top_row.empty else None,
                "top_upside_pct": (
                    top_row["forecast_30d_upside_pct"].iloc[0] if not top_row.empty else np.nan
                ),
            }
        )

    sector_summary = pd.DataFrame(rows)
    sector_summary = sector_summary.sort_values("avg_forecast_30d_upside_pct", ascending=False)

    return sector_summary.reset_index(drop=True)


def build_kpis(company: pd.DataFrame, future: pd.DataFrame, backtest: pd.DataFrame, weights: pd.DataFrame) -> pd.DataFrame:
    latest_market_date = str(future["latest_date"].max().date())

    kpi_values = {
        "total_companies": int(company["symbol"].nunique()),
        "latest_market_date": latest_market_date,
        "forecast_horizon_days": 30,
        "backtest_window_days": 90,
        "avg_forecast_30d_upside_pct": round(float(company["forecast_30d_upside_pct"].mean()), 4),
        "median_forecast_30d_upside_pct": round(float(company["forecast_30d_upside_pct"].median()), 4),
        "positive_forecast_count": int((company["forecast_signal"] == "Positive Forecast").sum()),
        "neutral_forecast_count": int((company["forecast_signal"] == "Neutral Forecast").sum()),
        "negative_forecast_count": int((company["forecast_signal"] == "Negative Forecast").sum()),
        "potential_opportunity_count": int((company["investment_signal"] == "Potential Opportunity").sum()),
        "stable_watchlist_count": int((company["investment_signal"] == "Stable Watchlist").sum()),
        "needs_further_review_count": int((company["investment_signal"] == "Needs Further Review").sum()),
        "weak_negative_count": int((company["investment_signal"] == "Weak Fundamentals / Negative Forecast").sum()),
        "high_volatility_speculative_count": int((company["investment_signal"] == "High Volatility Speculative").sum()),
        "avg_annualized_volatility": round(float(company["annualized_volatility"].mean()), 6),
        "avg_recent_model_mape": round(float(company["avg_recent_model_mape"].mean()), 6),
        "future_forecast_rows": int(len(future)),
        "backtest_rows": int(len(backtest)),
        "dynamic_weight_rows": int(len(weights)),
    }

    if OLD_KPIS_PATH.exists():
        old_kpis = pd.read_csv(OLD_KPIS_PATH)

        if {"metric", "value"}.issubset(set(old_kpis.columns)):
            return pd.DataFrame(
                [{"metric": key, "value": value} for key, value in kpi_values.items()]
            )

    return pd.DataFrame([kpi_values])


def build_model_error_distribution(weights: pd.DataFrame) -> pd.DataFrame:
    dist = weights.copy()

    dist["mape_bucket"] = pd.cut(
        dist["recent_mape"],
        bins=[-np.inf, 1, 2, 5, 10, 20, np.inf],
        labels=["<=1%", "1-2%", "2-5%", "5-10%", "10-20%", ">20%"],
    )

    grouped = (
        dist.groupby(["model_name", "model_role", "mape_bucket"], observed=False)
        .agg(
            company_count=("symbol", "count"),
            avg_recent_mape=("recent_mape", "mean"),
            avg_directional_accuracy=("directional_accuracy", "mean"),
            avg_final_weight_pct=("final_weight_pct", "mean"),
        )
        .reset_index()
    )

    return grouped


def main() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)

    prices, old_company, future, backtest, weights = load_inputs()

    print("Loaded inputs")
    print("Prices rows:", len(prices))
    print("Old company rows:", len(old_company))
    print("Future rows:", len(future))
    print("Backtest rows:", len(backtest))
    print("Weights rows:", len(weights))

    print("\nBuilding company summary...")
    company = build_company_summary(old_company, future, prices, weights)
    company.to_csv(COMPANY_OUT, index=False)

    print("Company summary saved:", COMPANY_OUT)
    print("Company rows:", len(company))
    print("Company symbols:", company["symbol"].nunique())

    print("\nBuilding sector summary...")
    sector = build_sector_summary(company)
    sector.to_csv(SECTOR_OUT, index=False)

    print("Sector summary saved:", SECTOR_OUT)
    print("Sector rows:", len(sector))

    print("\nBuilding KPIs...")
    kpis = build_kpis(company, future, backtest, weights)
    kpis.to_csv(KPIS_OUT, index=False)

    print("KPIs saved:", KPIS_OUT)
    print("KPI rows:", len(kpis))

    print("\nBuilding model error distribution...")
    error_dist = build_model_error_distribution(weights)
    error_dist.to_csv(ERROR_DIST_OUT, index=False)

    print("Model error distribution saved:", ERROR_DIST_OUT)
    print("Error distribution rows:", len(error_dist))

    print("\nSignal distribution:")
    print(company["investment_signal"].value_counts().to_string())

    print("\nForecast distribution:")
    print(company["forecast_signal"].value_counts().to_string())

    print("\nSector summary preview:")
    print(
        sector[
            [
                "sector",
                "company_count",
                "avg_forecast_30d_upside_pct",
                "avg_annualized_volatility",
                "positive_forecast_count",
                "negative_forecast_count",
            ]
        ].head(10).to_string(index=False)
    )


if __name__ == "__main__":
    main()
