# scripts/02_generate_forecast_csvs.py

from pathlib import Path
from typing import Optional
import math
import time

import numpy as np
import pandas as pd

try:
    from sklearn.ensemble import HistGradientBoostingRegressor
    import joblib
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False


PRICE_PATH = Path("data/live/sp500_prices_live.csv")
COMPANY_PATH = Path("public/data/marketpulse_dashboard_company_summary.csv")
EXCLUDED_PATH = Path("config/excluded_symbols.csv")

OUTPUT_DIR = Path("data/live/generated")

FUTURE_FORECAST_PATH = OUTPUT_DIR / "marketpulse_dashboard_future_forecast_wide.csv"
BACKTEST_PATH = OUTPUT_DIR / "marketpulse_dashboard_actual_vs_predicted_wide.csv"
WEIGHTS_PATH = OUTPUT_DIR / "marketpulse_model_dynamic_weights.csv"

FORECAST_HORIZON_DAYS = 30
BACKTEST_DAYS = 90

XGBOOST_MODEL_PATH = Path("data/live/xgb_model.joblib")

# Features fed into the XGBoost model — derived purely from price history
XGB_FEATURE_COLS = [
    "ret_1d", "ret_5d", "ret_10d", "ret_21d", "ret_63d", "ret_252d",
    "vol_21d", "vol_63d",
    "ma_ratio_30d", "ma_ratio_90d",
    "rsi_14",
]


MODEL_CONFIGS = [
    {
        "model_name": "naive",
        "prediction_col": "predicted_naive",
        "forecast_col": "forecast_naive",
        "model_role": "stability anchor",
        "min_weight": 0.05,
        "max_weight": 0.25,
        "role_multiplier": 0.85,
    },
    {
        "model_name": "moving_average_30d",
        "prediction_col": "predicted_moving_average_30d",
        "forecast_col": "forecast_moving_average_30d",
        "model_role": "smoothing baseline",
        "min_weight": 0.03,
        "max_weight": 0.20,
        "role_multiplier": 0.95,
    },
    {
        "model_name": "drift",
        "prediction_col": "predicted_drift",
        "forecast_col": "forecast_drift",
        "model_role": "long-term baseline",
        "min_weight": 0.03,
        "max_weight": 0.20,
        "role_multiplier": 0.95,
    },
    {
        "model_name": "recent_linear_trend_252d",
        "prediction_col": "predicted_recent_linear_trend_252d",
        "forecast_col": "forecast_recent_linear_trend_252d",
        "model_role": "aggressive trend baseline",
        "min_weight": 0.00,
        "max_weight": 0.15,
        "role_multiplier": 0.80,
    },
    {
        "model_name": "recent_momentum_10d",
        "prediction_col": "predicted_recent_momentum_10d",
        "forecast_col": "forecast_recent_momentum_10d",
        "model_role": "short-term momentum model",
        "min_weight": 0.04,
        "max_weight": 0.50,
        "role_multiplier": 1.05,
    },
    {
        "model_name": "adaptive_blended_momentum",
        "prediction_col": "predicted_adaptive_blended_momentum",
        "forecast_col": "forecast_adaptive_blended_momentum",
        "model_role": "main directional model",
        "min_weight": 0.08,
        "max_weight": 0.70,
        "role_multiplier": 1.12,
    },
]


def clipped_daily_return(value: float, lower: float = -0.015, upper: float = 0.015) -> float:
    if pd.isna(value) or not np.isfinite(value):
        return 0.0

    return max(min(float(value), upper), lower)


def safe_log_return(current_price: float, old_price: float, days: int) -> float:
    if (
        current_price is None
        or old_price is None
        or pd.isna(current_price)
        or pd.isna(old_price)
        or current_price <= 0
        or old_price <= 0
        or days <= 0
    ):
        return np.nan

    return math.log(current_price / old_price) / days


def calculate_adaptive_daily_return(close_values: np.ndarray) -> float:
    latest_close = close_values[-1]

    lookbacks = {
        5: 0.15,
        10: 0.40,
        21: 0.25,
        63: 0.12,
        252: 0.08,
    }

    weighted_sum = 0.0
    available_weight_sum = 0.0

    for lookback_days, weight in lookbacks.items():
        if len(close_values) >= lookback_days + 1:
            old_close = close_values[-(lookback_days + 1)]
            daily_return = safe_log_return(latest_close, old_close, lookback_days)

            if not pd.isna(daily_return):
                weighted_sum += weight * daily_return
                available_weight_sum += weight

    if available_weight_sum == 0:
        return 0.0

    return clipped_daily_return(weighted_sum / available_weight_sum)


def calculate_recent_momentum_daily_return(close_values: np.ndarray) -> float:
    if len(close_values) < 11:
        return 0.0

    daily_return = safe_log_return(close_values[-1], close_values[-11], 10)

    return clipped_daily_return(daily_return)


def calculate_drift_daily_return(close_values: np.ndarray) -> float:
    if len(close_values) < 2:
        return 0.0

    first_close = close_values[0]
    latest_close = close_values[-1]

    if first_close <= 0 or latest_close <= 0:
        return 0.0

    return math.log(latest_close / first_close) / (len(close_values) - 1)


def calculate_linear_trend_forecast(close_values: np.ndarray, horizon: int) -> float:
    window = close_values[-252:]

    if len(window) < 2:
        return float(close_values[-1])

    x = np.arange(len(window))
    slope, intercept = np.polyfit(x, window, 1)

    forecast_value = slope * (len(window) - 1 + horizon) + intercept

    return max(float(forecast_value), 0.01)


def calculate_moving_average(close_values: np.ndarray, window: int = 30) -> float:
    recent_window = close_values[-window:]

    if len(recent_window) == 0:
        return float(close_values[-1])

    return float(np.mean(recent_window))


def compute_xgb_features(close_values: np.ndarray) -> Optional[dict]:
    """
    Build the XGBoost feature vector from a price-history array.
    Returns None if there is insufficient history (< 65 bars).
    """
    n = len(close_values)
    if n < 65:
        return None

    close = np.maximum(close_values, 1e-9).astype(float)
    log_ret = np.diff(np.log(close))
    latest = float(close[-1])

    def _log_ret_n(days: int) -> float:
        if n > days and close[-(days + 1)] > 0:
            return float(math.log(latest / float(close[-(days + 1)])) / days)
        return 0.0

    if n > 252:
        ret_252d = float(math.log(latest / float(close[-253])) / 252)
    else:
        ret_252d = float(math.log(latest / float(close[0])) / max(n - 1, 1))

    vol_21d = float(np.std(log_ret[-21:])) if len(log_ret) >= 21 else 0.02
    vol_63d = float(np.std(log_ret[-63:])) if len(log_ret) >= 63 else 0.02

    ma_30 = float(np.mean(close[-30:])) if n >= 30 else float(np.mean(close))
    ma_90 = float(np.mean(close[-90:])) if n >= 90 else float(np.mean(close))

    # RSI-14 normalised to [0, 1]
    if len(log_ret) >= 14:
        gains = np.mean(np.maximum(log_ret[-14:], 0.0))
        losses = np.mean(np.maximum(-log_ret[-14:], 0.0))
        rsi_14 = float(gains / (gains + losses)) if (gains + losses) > 0 else 0.5
    else:
        rsi_14 = 0.5

    return {
        "ret_1d":       _log_ret_n(1),
        "ret_5d":       _log_ret_n(5),
        "ret_10d":      _log_ret_n(10),
        "ret_21d":      _log_ret_n(21),
        "ret_63d":      _log_ret_n(63),
        "ret_252d":     ret_252d,
        "vol_21d":      vol_21d,
        "vol_63d":      vol_63d,
        "ma_ratio_30d": latest / ma_30 if ma_30 > 0 else 1.0,
        "ma_ratio_90d": latest / ma_90 if ma_90 > 0 else 1.0,
        "rsi_14":       rsi_14,
    }


def train_xgboost(prices: pd.DataFrame):
    """
    Train a single cross-sectional XGBoost model that predicts the
    30-trading-day forward log return for any S&P 500 stock.

    Training samples are drawn from every symbol (sampled every 5 days
    to keep volume manageable).  Labels are clipped at ±60 % to remove
    data artefacts.
    """
    rows: list[dict] = []

    for symbol, group in prices.groupby("symbol"):
        group = group.sort_values("date").reset_index(drop=True)
        close = group["close"].to_numpy(dtype=float)
        n = len(close)

        if n < 95:      # 65 history + 30 future minimum
            continue

        for i in range(64, n - 30, 5):     # step=5 to keep set manageable
            current_price = close[i]
            future_price  = close[i + 30]

            if current_price <= 0 or future_price <= 0:
                continue

            target = math.log(future_price / current_price)
            if abs(target) > 0.6:           # clip extreme / erroneous labels
                continue

            feats = compute_xgb_features(close[: i + 1])
            if feats is None:
                continue

            row = feats.copy()
            row["target"] = target
            rows.append(row)

    if len(rows) < 100:
        print("  Insufficient XGBoost training data — skipping.")
        return None

    df = pd.DataFrame(rows)
    X  = df[XGB_FEATURE_COLS].fillna(0.0).clip(-10.0, 10.0)
    y  = df["target"]

    print(f"  Training gradient-boosted model on {len(df):,} samples from {prices['symbol'].nunique()} symbols...")

    model = HistGradientBoostingRegressor(
        max_iter=400,
        max_depth=4,
        learning_rate=0.04,
        min_samples_leaf=10,
        l2_regularization=1.5,
        random_state=42,
    )
    model.fit(X, y)
    return model


def get_xgboost_forecasts(prices: pd.DataFrame) -> dict:
    """
    Returns {symbol: predicted_30d_log_return}.

    Loads a cached model if it was saved less than 23 hours ago;
    otherwise retrains and caches.  Falls back to an empty dict
    if XGBoost is unavailable or training fails.
    """
    if not XGBOOST_AVAILABLE:
        print("  XGBoost not installed — run: pip install xgboost joblib")
        return {}

    model = None

    if XGBOOST_MODEL_PATH.exists():
        age_hours = (time.time() - XGBOOST_MODEL_PATH.stat().st_mtime) / 3600
        if age_hours < 23:
            try:
                model = joblib.load(XGBOOST_MODEL_PATH)
                print(f"  Loaded cached XGBoost model ({age_hours:.1f} h old).")
            except Exception as e:
                print(f"  Cache load failed ({e}); retraining.")
                model = None

    if model is None:
        model = train_xgboost(prices)
        if model is None:
            return {}
        XGBOOST_MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(model, XGBOOST_MODEL_PATH)
        print(f"  XGBoost model cached at {XGBOOST_MODEL_PATH}")

    results: dict = {}

    for symbol, group in prices.groupby("symbol"):
        group = group.sort_values("date").reset_index(drop=True)
        close = group["close"].to_numpy(dtype=float)

        if len(close) < 65:
            continue

        feats = compute_xgb_features(close)
        if feats is None:
            continue

        X_pred = pd.DataFrame([feats])[XGB_FEATURE_COLS].fillna(0.0).clip(-10.0, 10.0)

        try:
            log_ret = float(model.predict(X_pred)[0])
            log_ret = float(np.clip(log_ret, -0.5, 0.5))   # safety clip
            results[symbol] = log_ret
        except Exception as e:
            print(f"  XGBoost inference failed for {symbol}: {e}")

    return results


def get_company_meta(companies: pd.DataFrame) -> dict:
    meta_cols = ["symbol"]

    for col in ["company_name", "sector", "industry"]:
        if col in companies.columns:
            meta_cols.append(col)

    clean = companies[meta_cols].copy()
    clean["symbol"] = clean["symbol"].astype(str).str.upper().str.strip()

    meta = {}

    for _, row in clean.iterrows():
        symbol = row["symbol"]

        meta[symbol] = {
            "company_name": row.get("company_name", symbol),
            "sector": row.get("sector", "Unknown"),
            "industry": row.get("industry", "Unknown"),
        }

    return meta


def load_data() -> tuple[pd.DataFrame, pd.DataFrame, set[str]]:
    if not PRICE_PATH.exists():
        raise FileNotFoundError(f"Missing live price file: {PRICE_PATH}")

    if not COMPANY_PATH.exists():
        raise FileNotFoundError(f"Missing company summary file: {COMPANY_PATH}")

    prices = pd.read_csv(PRICE_PATH)
    companies = pd.read_csv(COMPANY_PATH)

    prices["date"] = pd.to_datetime(prices["date"], errors="coerce")
    prices["symbol"] = prices["symbol"].astype(str).str.upper().str.strip()

    for col in ["open", "high", "low", "close", "volume"]:
        prices[col] = pd.to_numeric(prices[col], errors="coerce")

    prices = prices.dropna(subset=["date", "symbol", "close"])
    prices = prices.sort_values(["symbol", "date"]).reset_index(drop=True)

    companies["symbol"] = companies["symbol"].astype(str).str.upper().str.strip()

    excluded_symbols = set()

    if EXCLUDED_PATH.exists():
        excluded = pd.read_csv(EXCLUDED_PATH)
        excluded_symbols = set(excluded["symbol"].astype(str).str.upper().str.strip())

    prices = prices[~prices["symbol"].isin(excluded_symbols)].copy()
    companies = companies[~companies["symbol"].isin(excluded_symbols)].copy()

    return prices, companies, excluded_symbols


def build_backtest(prices: pd.DataFrame, company_meta: dict) -> pd.DataFrame:
    rows = []

    for symbol, group in prices.groupby("symbol"):
        group = group.sort_values("date").reset_index(drop=True)

        if len(group) < 40:
            continue

        close_values = group["close"].to_numpy(dtype=float)

        start_index = max(1, len(group) - BACKTEST_DAYS)

        for index in range(start_index, len(group)):
            actual_price = float(group.loc[index, "close"])
            actual_date = group.loc[index, "date"]

            prior_close_values = close_values[:index]

            if len(prior_close_values) == 0:
                continue

            latest_prior_close = float(prior_close_values[-1])

            forecast_naive = latest_prior_close
            forecast_moving_average_30d = calculate_moving_average(prior_close_values, 30)

            drift_daily_return = calculate_drift_daily_return(prior_close_values)
            forecast_drift = latest_prior_close * math.exp(clipped_daily_return(drift_daily_return))

            forecast_recent_linear_trend_252d = calculate_linear_trend_forecast(prior_close_values, 1)

            recent_momentum_daily_return = calculate_recent_momentum_daily_return(prior_close_values)
            forecast_recent_momentum_10d = latest_prior_close * math.exp(recent_momentum_daily_return)

            adaptive_daily_return = calculate_adaptive_daily_return(prior_close_values)
            forecast_adaptive_blended_momentum = latest_prior_close * math.exp(adaptive_daily_return)

            meta = company_meta.get(
                symbol,
                {
                    "company_name": symbol,
                    "sector": "Unknown",
                    "industry": "Unknown",
                },
            )

            rows.append(
                {
                    "symbol": symbol,
                    "company_name": meta["company_name"],
                    "sector": meta["sector"],
                    "industry": meta["industry"],
                    "date": actual_date.date(),
                    "actual_price": actual_price,
                    "predicted_naive": forecast_naive,
                    "predicted_moving_average_30d": forecast_moving_average_30d,
                    "predicted_drift": forecast_drift,
                    "predicted_recent_linear_trend_252d": forecast_recent_linear_trend_252d,
                    "predicted_recent_momentum_10d": forecast_recent_momentum_10d,
                    "predicted_adaptive_blended_momentum": forecast_adaptive_blended_momentum,
                }
            )

    return pd.DataFrame(rows)


def allocate_capped_weights(group: pd.DataFrame) -> pd.DataFrame:
    group = group.copy().reset_index(drop=True)

    final_weights = group["min_weight"].to_numpy(dtype=float).copy()
    max_weights = group["max_weight"].to_numpy(dtype=float)
    scores = group["raw_score"].to_numpy(dtype=float)

    remaining_weight = 1.0 - final_weights.sum()
    active = (max_weights - final_weights) > 1e-12

    while remaining_weight > 1e-12 and active.any():
        active_scores = scores[active]

        if active_scores.sum() <= 0:
            proposed_add = np.repeat(remaining_weight / active.sum(), active.sum())
        else:
            proposed_add = remaining_weight * active_scores / active_scores.sum()

        active_indices = np.where(active)[0]
        headroom = max_weights[active_indices] - final_weights[active_indices]

        over_cap = proposed_add > headroom + 1e-12

        if not over_cap.any():
            final_weights[active_indices] += proposed_add
            remaining_weight = 0.0
        else:
            capped_indices = active_indices[over_cap]
            final_weights[capped_indices] = max_weights[capped_indices]
            active[capped_indices] = False
            remaining_weight = 1.0 - final_weights.sum()

    diff = 1.0 - final_weights.sum()

    if abs(diff) > 1e-8:
        headroom = max_weights - final_weights

        if diff > 0:
            index = int(np.argmax(headroom))
            final_weights[index] += diff
        else:
            removable = final_weights - group["min_weight"].to_numpy(dtype=float)
            index = int(np.argmax(removable))
            final_weights[index] += diff

    group["final_weight"] = final_weights
    group["final_weight_pct"] = final_weights * 100

    return group


def build_dynamic_weights(backtest: pd.DataFrame) -> pd.DataFrame:
    metric_rows = []

    backtest = backtest.sort_values(["symbol", "date"]).copy()
    backtest["prev_actual_price"] = backtest.groupby("symbol")["actual_price"].shift(1)

    for symbol, group in backtest.groupby("symbol"):
        for config in MODEL_CONFIGS:
            prediction_col = config["prediction_col"]

            valid = group[
                group["actual_price"].notna()
                & group[prediction_col].notna()
                & (group["actual_price"] > 0)
            ].copy()

            if len(valid) == 0:
                recent_mape = 999.0
                directional_accuracy = 0.50
                observation_count = 0
            else:
                absolute_percentage_error = (
                    (valid[prediction_col] - valid["actual_price"]).abs()
                    / valid["actual_price"]
                    * 100
                )

                recent_mape = float(absolute_percentage_error.mean())
                observation_count = int(len(valid))

                valid_direction = valid[valid["prev_actual_price"].notna()].copy()

                if len(valid_direction) == 0:
                    directional_accuracy = 0.50
                else:
                    actual_direction = np.sign(
                        valid_direction["actual_price"] - valid_direction["prev_actual_price"]
                    )
                    predicted_direction = np.sign(
                        valid_direction[prediction_col] - valid_direction["prev_actual_price"]
                    )

                    directional_accuracy = float((actual_direction == predicted_direction).mean())

            metric_rows.append(
                {
                    "symbol": symbol,
                    "model_name": config["model_name"],
                    "prediction_col": config["prediction_col"],
                    "forecast_col": config["forecast_col"],
                    "model_role": config["model_role"],
                    "min_weight": config["min_weight"],
                    "max_weight": config["max_weight"],
                    "role_multiplier": config["role_multiplier"],
                    "recent_mape": recent_mape,
                    "directional_accuracy": directional_accuracy,
                    "observation_count": observation_count,
                }
            )

    metrics = pd.DataFrame(metric_rows)

    naive_mape = (
        metrics[metrics["model_name"] == "naive"][["symbol", "recent_mape"]]
        .rename(columns={"recent_mape": "naive_recent_mape"})
    )

    metrics = metrics.merge(naive_mape, on="symbol", how="left")

    def get_skill_multiplier(row: pd.Series) -> float:
        if row["model_name"] == "naive":
            return 0.85

        if pd.isna(row["naive_recent_mape"]) or row["naive_recent_mape"] <= 0:
            return 1.00

        ratio = row["recent_mape"] / row["naive_recent_mape"]

        if ratio < 0.95:
            return 1.25
        if ratio <= 1.05:
            return 1.10
        if ratio <= 1.20:
            return 0.95

        return 0.75

    metrics["skill_vs_naive_multiplier"] = metrics.apply(get_skill_multiplier, axis=1)
    metrics["direction_multiplier"] = 0.70 + (0.60 * metrics["directional_accuracy"])
    metrics["price_accuracy_score"] = 1 / (metrics["recent_mape"] + 0.25)

    metrics["raw_score"] = (
        metrics["price_accuracy_score"]
        * metrics["direction_multiplier"]
        * metrics["skill_vs_naive_multiplier"]
        * metrics["role_multiplier"]
    )

    # Avoid pandas-version-dependent groupby.apply behavior.
    # Some pandas versions exclude grouping columns from apply output, which can drop `symbol`.
    weight_frames = []

    for symbol, group in metrics.groupby("symbol", sort=False):
        group = group.copy()
        group["symbol"] = symbol

        allocated = allocate_capped_weights(group)
        allocated["symbol"] = symbol

        weight_frames.append(allocated)

    if not weight_frames:
        raise ValueError("No model weights were generated.")

    weights = pd.concat(weight_frames, ignore_index=True)

    if "symbol" not in weights.columns:
        raise ValueError("Dynamic weights table is missing required column: symbol")

    weights["recent_mape"] = weights["recent_mape"].round(6)
    weights["directional_accuracy"] = weights["directional_accuracy"].round(6)
    weights["raw_score"] = weights["raw_score"].round(10)
    weights["final_weight_pct"] = weights["final_weight_pct"].round(4)

    return weights


def _xgb_row(log_return_30d: Optional[float], latest_close: float, horizon: int, max_horizon: int) -> dict:
    """
    Produce the three XGBoost forecast columns for a given horizon.
    The 30-day log return is interpolated linearly in log-space across horizons.
    """
    if log_return_30d is None:
        return {
            "forecast_xgboost_direct": np.nan,
            "predicted_log_return_xgboost": np.nan,
            "forecast_xgboost_direct_upside_pct": np.nan,
        }
    log_ret_h = log_return_30d * horizon / max_horizon
    price_h   = latest_close * math.exp(log_ret_h)
    upside_h  = (price_h - latest_close) / latest_close * 100
    return {
        "forecast_xgboost_direct": price_h,
        "predicted_log_return_xgboost": log_ret_h,
        "forecast_xgboost_direct_upside_pct": upside_h,
    }


def build_future_forecast(prices: pd.DataFrame, weights: pd.DataFrame, company_meta: dict, xgboost_forecasts: Optional[dict] = None) -> pd.DataFrame:
    rows = []

    weights_by_symbol = {
        symbol: group.set_index("model_name")["final_weight"].to_dict()
        for symbol, group in weights.groupby("symbol")
    }

    for symbol, group in prices.groupby("symbol"):
        group = group.sort_values("date").reset_index(drop=True)

        if len(group) < 40:
            continue

        close_values = group["close"].to_numpy(dtype=float)

        latest_date = group.loc[len(group) - 1, "date"]
        latest_close = float(group.loc[len(group) - 1, "close"])

        forecast_dates = pd.bdate_range(
            start=latest_date + pd.offsets.BDay(1),
            periods=FORECAST_HORIZON_DAYS,
        )

        drift_daily_return = clipped_daily_return(calculate_drift_daily_return(close_values))
        recent_momentum_daily_return = calculate_recent_momentum_daily_return(close_values)
        adaptive_daily_return = calculate_adaptive_daily_return(close_values)

        moving_average_30d = calculate_moving_average(close_values, 30)

        daily_log_returns = np.diff(np.log(close_values[close_values > 0]))

        if len(daily_log_returns) >= 30:
            recent_volatility = float(np.std(daily_log_returns[-90:]))
        else:
            recent_volatility = 0.02

        model_weights = weights_by_symbol.get(symbol, {})

        weight_naive = model_weights.get("naive", 0.05)
        weight_moving_average_30d = model_weights.get("moving_average_30d", 0.03)
        weight_drift = model_weights.get("drift", 0.03)
        weight_recent_linear_trend_252d = model_weights.get("recent_linear_trend_252d", 0.00)
        weight_recent_momentum_10d = model_weights.get("recent_momentum_10d", 0.04)
        weight_adaptive_blended_momentum = model_weights.get("adaptive_blended_momentum", 0.08)

        total_weight = (
            weight_naive
            + weight_moving_average_30d
            + weight_drift
            + weight_recent_linear_trend_252d
            + weight_recent_momentum_10d
            + weight_adaptive_blended_momentum
        )

        if total_weight <= 0:
            total_weight = 1.0

        weight_naive /= total_weight
        weight_moving_average_30d /= total_weight
        weight_drift /= total_weight
        weight_recent_linear_trend_252d /= total_weight
        weight_recent_momentum_10d /= total_weight
        weight_adaptive_blended_momentum /= total_weight

        meta = company_meta.get(
            symbol,
            {
                "company_name": symbol,
                "sector": "Unknown",
                "industry": "Unknown",
            },
        )

        # XGBoost Direct: predicted 30-day log return for this symbol
        xgb_log_return_30d: Optional[float] = (xgboost_forecasts or {}).get(symbol)

        for horizon in range(1, FORECAST_HORIZON_DAYS + 1):
            damped_horizon = (1 - (0.94 ** horizon)) / (1 - 0.94)

            forecast_naive = latest_close
            forecast_moving_average_30d = moving_average_30d
            forecast_drift = latest_close * math.exp(drift_daily_return * horizon)
            forecast_recent_linear_trend_252d = calculate_linear_trend_forecast(close_values, horizon)
            forecast_recent_momentum_10d = latest_close * math.exp(recent_momentum_daily_return * horizon)
            forecast_adaptive_blended_momentum = latest_close * math.exp(
                adaptive_daily_return * damped_horizon
            )

            forecast_weighted_ensemble = (
                weight_naive * forecast_naive
                + weight_moving_average_30d * forecast_moving_average_30d
                + weight_drift * forecast_drift
                + weight_recent_linear_trend_252d * forecast_recent_linear_trend_252d
                + weight_recent_momentum_10d * forecast_recent_momentum_10d
                + weight_adaptive_blended_momentum * forecast_adaptive_blended_momentum
            )

            band_center = forecast_weighted_ensemble
            band_width = 1.28 * recent_volatility * math.sqrt(horizon)

            forecast_lower_band = band_center * math.exp(-band_width)
            forecast_upper_band = band_center * math.exp(band_width)

            rows.append(
                {
                    "symbol": symbol,
                    "company_name": meta["company_name"],
                    "sector": meta["sector"],
                    "industry": meta["industry"],
                    "forecast_horizon": horizon,
                    "forecast_date": forecast_dates[horizon - 1].date(),
                    "latest_date": latest_date.date(),
                    "latest_close": latest_close,
                    "forecast_naive": forecast_naive,
                    "forecast_moving_average_30d": forecast_moving_average_30d,
                    "forecast_drift": forecast_drift,
                    "forecast_recent_linear_trend_252d": forecast_recent_linear_trend_252d,
                    "forecast_recent_momentum_10d": forecast_recent_momentum_10d,
                    "forecast_adaptive_blended_momentum": forecast_adaptive_blended_momentum,
                    "forecast_lower_band": forecast_lower_band,
                    "forecast_upper_band": forecast_upper_band,

                    # XGBoost Direct: interpolate log return linearly across the horizon
                    # (log-space straight line from 0 → 30-day prediction)
                    **_xgb_row(xgb_log_return_30d, latest_close, horizon, FORECAST_HORIZON_DAYS),

                    "weight_naive": weight_naive,
                    "weight_moving_average_30d": weight_moving_average_30d,
                    "weight_drift": weight_drift,
                    "weight_recent_linear_trend_252d": weight_recent_linear_trend_252d,
                    "weight_recent_momentum_10d": weight_recent_momentum_10d,
                    "weight_adaptive_blended_momentum": weight_adaptive_blended_momentum,
                    "forecast_weighted_ensemble": forecast_weighted_ensemble,
                    "forecast_weighted_ensemble_upside_pct": (
                        (forecast_weighted_ensemble - latest_close) / latest_close * 100
                    ),
                    "weighted_ensemble_method": (
                        "Weighted Ensemble"
                        if xgb_log_return_30d is not None
                        else "Constrained dynamic ensemble excluding XGBoost"
                    ),
                }
            )

    return pd.DataFrame(rows)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    prices, companies, excluded_symbols = load_data()
    company_meta = get_company_meta(companies)

    print("Loaded live prices")
    print("Price rows:", len(prices))
    print("Price symbols:", prices["symbol"].nunique())
    print("Earliest live date:", prices["date"].min().date())
    print("Latest live date:", prices["date"].max().date())
    print("Excluded symbols:", sorted(excluded_symbols))

    print("\nBuilding 90-day backtest...")
    backtest = build_backtest(prices, company_meta)
    backtest.to_csv(BACKTEST_PATH, index=False)

    print("Backtest saved:", BACKTEST_PATH)
    print("Backtest rows:", len(backtest))
    print("Backtest symbols:", backtest["symbol"].nunique())

    print("\nBuilding constrained dynamic weights...")
    weights = build_dynamic_weights(backtest)
    weights.to_csv(WEIGHTS_PATH, index=False)

    print("Weights saved:", WEIGHTS_PATH)
    print("Weight rows:", len(weights))
    print("Weight symbols:", weights["symbol"].nunique())

    weight_check = weights.groupby("symbol")["final_weight"].sum()
    print("Min weight sum:", round(float(weight_check.min()), 6))
    print("Max weight sum:", round(float(weight_check.max()), 6))

    print("\nTraining / loading XGBoost model and computing 30-day forecasts...")
    xgboost_forecasts = get_xgboost_forecasts(prices)
    print(f"XGBoost forecasts ready for {len(xgboost_forecasts)} symbols.")

    print("\nBuilding 30-day future forecast...")
    future = build_future_forecast(prices, weights, company_meta, xgboost_forecasts)
    future.to_csv(FUTURE_FORECAST_PATH, index=False)

    print("Future forecast saved:", FUTURE_FORECAST_PATH)
    print("Future rows:", len(future))
    print("Future symbols:", future["symbol"].nunique())
    print("Min horizon:", future["forecast_horizon"].min())
    print("Max horizon:", future["forecast_horizon"].max())

    print("\nSample RL rows if available:")
    sample = future[
        (future["symbol"] == "RL")
        & (future["forecast_horizon"].isin([1, 5, 10, 20, 30]))
    ]

    if sample.empty:
        print("RL not found in live forecast.")
    else:
        print(
            sample[
                [
                    "symbol",
                    "forecast_horizon",
                    "latest_close",
                    "forecast_adaptive_blended_momentum",
                    "forecast_weighted_ensemble",
                    "forecast_weighted_ensemble_upside_pct",
                ]
            ].to_string(index=False)
        )


if __name__ == "__main__":
    main()
