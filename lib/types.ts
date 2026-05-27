export interface CompanySummary {
  symbol: string
  company_name: string
  sector: string
  industry: string
  first_date: string
  latest_date: string
  trading_days: number
  latest_price: number
  forecast_30d_date: string
  forecast_30d_price: number
  forecast_30d_upside_pct: number
  best_model_name: string
  best_model_mae: number
  best_model_rmse: number
  best_model_mape: number
  model_reliability: string
  total_return_pct: number
  avg_daily_return_pct: number
  annualized_volatility_pct: number
  sector_median_volatility_pct: number
  volatility_vs_sector_pct: number
  risk_level: string
  sector_relative_risk: string
  revenue: number | null
  net_income: number | null
  ebitda: number | null
  eps: number | null
  profit_margin_pct: number | null
  sector_median_profit_margin_pct: number | null
  profit_margin_vs_sector_pct: number | null
  ebitda_margin_pct: number | null
  sector_median_ebitda_margin_pct: number | null
  ebitda_margin_vs_sector_pct: number | null
  forecast_signal: string
  fundamental_label: string
  final_signal: string
  dashboard_forecast_method: string
  review_reason: string | null
  forecast_naive_30d: number | null
  forecast_moving_average_30d_30d: number | null
  forecast_drift_30d: number | null
  forecast_recent_linear_trend_252d_30d: number | null
  latest_close: number | null
  forecast_lower_band_30d: number | null
  forecast_upper_band_30d: number | null
}

export interface SectorSummary {
  sector: string
  number_of_companies: number
  avg_forecast_30d_upside_pct: number
  avg_model_mape: number
  avg_annualized_volatility_pct: number
  avg_profit_margin_pct: number
  avg_ebitda_margin_pct: number
  potential_opportunity_count: number
  high_volatility_speculative_count: number
  weak_negative_count: number
  stable_watchlist_count: number
  needs_further_review_count: number
}

export interface ActualVsPredicted {
  symbol: string
  company_name: string
  sector: string
  industry: string
  date: string
  actual_price: number
  predicted_naive: number | null
  predicted_moving_average_30d: number | null
  predicted_drift: number | null
  predicted_recent_linear_trend_252d: number | null
}

export interface FutureForecast {
  symbol: string
  company_name: string
  sector: string
  industry: string
  forecast_date: string
  forecast_horizon: number
  latest_close: number
  forecast_naive: number | null
  forecast_moving_average_30d: number | null
  forecast_drift: number | null
  forecast_recent_linear_trend_252d: number | null
  forecast_recent_momentum_10d: number | null
  forecast_adaptive_blended_momentum: number | null
  forecast_lower_band: number | null
  forecast_upper_band: number | null
  forecast_xgboost_direct: number | null
  predicted_log_return_xgboost: number | null
  forecast_xgboost_direct_upside_pct: number | null
  forecast_weighted_ensemble: number | null
  forecast_weighted_ensemble_upside_pct: number | null
  weighted_ensemble_method: string | null
}

export interface KPIs {
  companies_analyzed: number
  avg_forecast_30d_upside_pct: number
  avg_model_mape: number
  avg_annualized_volatility_pct: number
  avg_profit_margin_pct: number
  potential_opportunities: number
  high_volatility_speculative: number
  stable_watchlist: number
  needs_further_review: number
}

export type FinalSignal =
  | 'Potential Opportunity'
  | 'High Volatility Speculative'
  | 'Weak Fundamentals / Negative Forecast'
  | 'Stable Watchlist'
  | 'Needs Further Review'

export type RiskLevel = 'Lower Risk' | 'Moderate Risk' | 'High Risk' | 'Unknown Risk'

export type ModelReliability =
  | 'Strong Reliability'
  | 'Acceptable Reliability'
  | 'High Error'
  | 'Very High Error'
  | 'Unknown Reliability'

export interface ModelErrorBand {
  model_error_band: string
  model_error_band_order: number
  company_count: number
}
