import type {
  CompanySummary,
  SectorSummary,
  ActualVsPredicted,
  FutureForecast,
  KPIs,
  ModelErrorBand,
} from './types'

function parseNum(val: any): number | null {
  if (val === null || val === undefined || val === '' || val === 'null') return null
  const n = Number(val)
  return isNaN(n) ? null : n
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0]).map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = (values[i] ?? '').trim().replace(/^"|"$/g, '')
    })
    return row
  }).filter(row => Object.values(row).some(v => v !== ''))
}

async function fetchCSV<T>(path: string, transform: (row: any) => T): Promise<T[]> {
  try {
    const res = await fetch(path)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const rows = parseCSV(text)
    console.log(`Loaded ${rows.length} rows from ${path}`)
    return rows.map(transform)
  } catch (e) {
    console.warn(`Could not load ${path}:`, e)
    return []
  }
}

export async function loadCompanySummary(): Promise<CompanySummary[]> {
  const data = await fetchCSV<CompanySummary>(
    '/data/marketpulse_dashboard_company_summary.csv',
    (r) => ({
      symbol: r.symbol || '',
      company_name: r.company_name || r.symbol || '',
      sector: r.sector || 'Unknown',
      industry: r.industry || 'Unknown',
      first_date: r.first_date || '',
      latest_date: r.latest_date || '',
      trading_days: parseNum(r.trading_days) ?? 0,
      latest_price: parseNum(r.latest_price) ?? 0,
      forecast_30d_date: r.forecast_30d_date || '',
      forecast_30d_price: parseNum(r.forecast_30d_price) ?? 0,
      forecast_30d_upside_pct: parseNum(r.forecast_30d_upside_pct) ?? 0,
      best_model_name: r.best_model_name || '',
      best_model_mae: parseNum(r.best_model_mae) ?? 0,
      best_model_rmse: parseNum(r.best_model_rmse) ?? 0,
      best_model_mape: parseNum(r.best_model_mape) ?? 0,
      model_reliability: r.model_reliability || 'Unknown Reliability',
      total_return_pct: parseNum(r.total_return_pct) ?? 0,
      avg_daily_return_pct: parseNum(r.avg_daily_return_pct) ?? 0,
      annualized_volatility_pct: parseNum(r.annualized_volatility_pct) ?? 0,
      sector_median_volatility_pct: parseNum(r.sector_median_volatility_pct) ?? 0,
      volatility_vs_sector_pct: parseNum(r.volatility_vs_sector_pct) ?? 0,
      risk_level: r.risk_level || 'Unknown Risk',
      sector_relative_risk: r.sector_relative_risk || 'Unknown Sector Risk',
      revenue: parseNum(r.revenue),
      net_income: parseNum(r.net_income),
      ebitda: parseNum(r.ebitda),
      eps: parseNum(r.eps),
      profit_margin_pct: parseNum(r.profit_margin_pct),
      sector_median_profit_margin_pct: parseNum(r.sector_median_profit_margin_pct),
      profit_margin_vs_sector_pct: parseNum(r.profit_margin_vs_sector_pct),
      ebitda_margin_pct: parseNum(r.ebitda_margin_pct),
      sector_median_ebitda_margin_pct: parseNum(r.sector_median_ebitda_margin_pct),
      ebitda_margin_vs_sector_pct: parseNum(r.ebitda_margin_vs_sector_pct),
      forecast_signal: r.forecast_signal || 'No Forecast',
      fundamental_label: r.fundamental_label || 'Unknown Fundamentals',
      final_signal: r.final_signal || 'Needs Further Review',
      dashboard_forecast_method: r.dashboard_forecast_method || '',
      review_reason: r.review_reason || null,
      forecast_naive_30d: parseNum(r.forecast_naive_30d),
      forecast_moving_average_30d_30d: parseNum(r.forecast_moving_average_30d_30d),
      forecast_drift_30d: parseNum(r.forecast_drift_30d),
      forecast_recent_linear_trend_252d_30d: parseNum(r.forecast_recent_linear_trend_252d_30d),
      latest_close: parseNum(r.latest_close),
      forecast_lower_band_30d: parseNum(r.forecast_lower_band_30d),
      forecast_upper_band_30d: parseNum(r.forecast_upper_band_30d),
    })
  )
  return data.length > 0 ? data : getSampleCompanySummary()
}

export async function loadSectorSummary(): Promise<SectorSummary[]> {
  const data = await fetchCSV<SectorSummary>(
    '/data/marketpulse_dashboard_sector_summary.csv',
    (r) => ({
      sector: r.sector || 'Unknown',
      number_of_companies: parseNum(r.number_of_companies) ?? 0,
      avg_forecast_30d_upside_pct: parseNum(r.avg_forecast_30d_upside_pct) ?? 0,
      avg_model_mape: parseNum(r.avg_model_mape) ?? 0,
      avg_annualized_volatility_pct: parseNum(r.avg_annualized_volatility_pct) ?? 0,
      avg_profit_margin_pct: parseNum(r.avg_profit_margin_pct) ?? 0,
      avg_ebitda_margin_pct: parseNum(r.avg_ebitda_margin_pct) ?? 0,
      potential_opportunity_count: parseNum(r.potential_opportunity_count) ?? 0,
      high_volatility_speculative_count: parseNum(r.high_volatility_speculative_count) ?? 0,
      weak_negative_count: parseNum(r.weak_negative_count) ?? 0,
      stable_watchlist_count: parseNum(r.stable_watchlist_count) ?? 0,
      needs_further_review_count: parseNum(r.needs_further_review_count) ?? 0,
    })
  )
  return data.length > 0 ? data : getSampleSectorSummary()
}

export async function loadActualVsPredicted(): Promise<ActualVsPredicted[]> {
  return fetchCSV<ActualVsPredicted>(
    '/data/marketpulse_dashboard_actual_vs_predicted_wide.csv',
    (r) => ({
      symbol: r.symbol || '',
      company_name: r.company_name || '',
      sector: r.sector || '',
      industry: r.industry || '',
      date: r.date || '',
      actual_price: parseNum(r.actual_price) ?? 0,
      predicted_naive: parseNum(r.predicted_naive),
      predicted_moving_average_30d: parseNum(r.predicted_moving_average_30d),
      predicted_drift: parseNum(r.predicted_drift),
      predicted_recent_linear_trend_252d: parseNum(r.predicted_recent_linear_trend_252d),
    })
  )
}

export async function loadFutureForecast(): Promise<FutureForecast[]> {
  return fetchCSV<FutureForecast>(
    '/data/marketpulse_dashboard_future_forecast_wide.csv',
    (r) => ({
      symbol: r.symbol || '',
      company_name: r.company_name || '',
      sector: r.sector || '',
      industry: r.industry || '',
      forecast_date: r.forecast_date || '',
      forecast_horizon: parseNum(r.forecast_horizon) ?? 0,
      latest_close: parseNum(r.latest_close) ?? 0,
      forecast_naive: parseNum(r.forecast_naive),
      forecast_moving_average_30d: parseNum(r.forecast_moving_average_30d),
      forecast_drift: parseNum(r.forecast_drift),
      forecast_recent_linear_trend_252d: parseNum(r.forecast_recent_linear_trend_252d),
      forecast_recent_momentum_10d: parseNum(r.forecast_recent_momentum_10d),
      forecast_adaptive_blended_momentum: parseNum(r.forecast_adaptive_blended_momentum),
      forecast_lower_band: parseNum(r.forecast_lower_band),
      forecast_upper_band: parseNum(r.forecast_upper_band),
      forecast_xgboost_direct: parseNum(r.forecast_xgboost_direct),
      predicted_log_return_xgboost: parseNum(r.predicted_log_return_xgboost),
      forecast_xgboost_direct_upside_pct: parseNum(r.forecast_xgboost_direct_upside_pct),
      forecast_weighted_ensemble: parseNum(r.forecast_weighted_ensemble),
      forecast_weighted_ensemble_upside_pct: parseNum(r.forecast_weighted_ensemble_upside_pct),
      weighted_ensemble_method: r.weighted_ensemble_method ?? null,
    })
  )
}

export async function loadKPIs(): Promise<KPIs | null> {
  const data = await fetchCSV<KPIs>(
    '/data/marketpulse_dashboard_kpis.csv',
    (r) => ({
      companies_analyzed: parseNum(r.companies_analyzed) ?? 0,
      avg_forecast_30d_upside_pct: parseNum(r.avg_forecast_30d_upside_pct) ?? 0,
      avg_model_mape: parseNum(r.avg_model_mape) ?? 0,
      avg_annualized_volatility_pct: parseNum(r.avg_annualized_volatility_pct) ?? 0,
      avg_profit_margin_pct: parseNum(r.avg_profit_margin_pct) ?? 0,
      potential_opportunities: parseNum(r.potential_opportunities) ?? 0,
      high_volatility_speculative: parseNum(r.high_volatility_speculative) ?? 0,
      stable_watchlist: parseNum(r.stable_watchlist) ?? 0,
      needs_further_review: parseNum(r.needs_further_review) ?? 0,
    })
  )
  return data[0] ?? null
}

export async function loadModelErrorBands(): Promise<ModelErrorBand[]> {
  const data = await fetchCSV<ModelErrorBand>(
    '/data/marketpulse_dashboard_model_error_distribution.csv',
    (r) => ({
      model_error_band: r.model_error_band || '',
      model_error_band_order: parseNum(r.model_error_band_order) ?? 0,
      company_count: parseNum(r.company_count) ?? 0,
    })
  )
  return data.sort((a, b) => a.model_error_band_order - b.model_error_band_order)
}

// ─── Sample fallback data ─────────────────────────────────────────────────────

function getSampleCompanySummary(): CompanySummary[] {
  const signals = ['Stable Watchlist', 'Needs Further Review', 'Potential Opportunity', 'High Volatility Speculative', 'Weak Fundamentals / Negative Forecast']
  const sectors = ['Technology', 'Healthcare', 'Financial Services', 'Consumer Cyclical', 'Industrials', 'Energy', 'Communication Services', 'Basic Materials']
  const risks = ['Lower Risk', 'Moderate Risk', 'High Risk']
  const reliabilities = ['Strong Reliability', 'Acceptable Reliability', 'High Error']
  const tickers: [string, string][] = [
    ['AAPL','Apple Inc.'], ['MSFT','Microsoft Corp.'], ['NVDA','NVIDIA Corp.'], ['GOOG','Alphabet Inc.'],
    ['AMZN','Amazon.com Inc.'], ['META','Meta Platforms'], ['TSLA','Tesla Inc.'], ['JPM','JPMorgan Chase'],
    ['V','Visa Inc.'], ['JNJ','Johnson & Johnson'], ['UNH','UnitedHealth Group'], ['XOM','Exxon Mobil'],
    ['PG','Procter & Gamble'], ['MA','Mastercard'], ['HD','Home Depot'], ['CVX','Chevron Corp.'],
    ['ABBV','AbbVie Inc.'], ['MRK','Merck & Co.'], ['KO','Coca-Cola Co.'], ['PEP','PepsiCo Inc.'],
    ['AVGO','Broadcom Inc.'], ['COST','Costco Wholesale'], ['WMT','Walmart Inc.'], ['BAC','Bank of America'],
    ['CRM','Salesforce Inc.'], ['ACN','Accenture plc'], ['TMO','Thermo Fisher'], ['CSCO','Cisco Systems'],
    ['AMD','Advanced Micro Devices'], ['INTU','Intuit Inc.']
  ]
  return tickers.map(([symbol, company_name], i) => {
    const price = 50 + Math.random() * 450
    const upside = (Math.random() - 0.3) * 5
    const volatility = 15 + Math.random() * 50
    return {
      symbol, company_name,
      sector: sectors[i % sectors.length],
      industry: 'Sample Industry',
      first_date: '2020-01-02', latest_date: '2026-05-15',
      trading_days: 1500,
      latest_price: parseFloat(price.toFixed(2)),
      forecast_30d_date: '2026-06-15',
      forecast_30d_price: parseFloat((price * (1 + upside / 100)).toFixed(2)),
      forecast_30d_upside_pct: parseFloat(upside.toFixed(2)),
      best_model_name: 'drift',
      best_model_mae: parseFloat((price * 0.01).toFixed(2)),
      best_model_rmse: parseFloat((price * 0.015).toFixed(2)),
      best_model_mape: parseFloat((1 + Math.random() * 3).toFixed(2)),
      model_reliability: reliabilities[i % reliabilities.length],
      total_return_pct: parseFloat(((Math.random() - 0.3) * 200).toFixed(2)),
      avg_daily_return_pct: parseFloat(((Math.random() - 0.4) * 0.3).toFixed(4)),
      annualized_volatility_pct: parseFloat(volatility.toFixed(2)),
      sector_median_volatility_pct: 28,
      volatility_vs_sector_pct: parseFloat((volatility - 28).toFixed(2)),
      risk_level: risks[i % risks.length],
      sector_relative_risk: 'Near-Sector Volatility',
      revenue: Math.random() > 0.1 ? parseFloat((Math.random() * 200e9).toFixed(0)) : null,
      net_income: Math.random() > 0.1 ? parseFloat((Math.random() * 30e9).toFixed(0)) : null,
      ebitda: Math.random() > 0.1 ? parseFloat((Math.random() * 50e9).toFixed(0)) : null,
      eps: Math.random() > 0.1 ? parseFloat((Math.random() * 15).toFixed(2)) : null,
      profit_margin_pct: Math.random() > 0.15 ? parseFloat((5 + Math.random() * 30).toFixed(2)) : null,
      sector_median_profit_margin_pct: 14,
      profit_margin_vs_sector_pct: Math.random() > 0.15 ? parseFloat(((Math.random() - 0.4) * 15).toFixed(2)) : null,
      ebitda_margin_pct: Math.random() > 0.15 ? parseFloat((10 + Math.random() * 30).toFixed(2)) : null,
      sector_median_ebitda_margin_pct: 20,
      ebitda_margin_vs_sector_pct: Math.random() > 0.15 ? parseFloat(((Math.random() - 0.4) * 20).toFixed(2)) : null,
      forecast_signal: upside > 1 ? 'Positive Forecast' : upside < -1 ? 'Negative Forecast' : 'Neutral Forecast',
      fundamental_label: ['Above-Sector Profitability', 'Below-Sector Profitability', 'Mixed Fundamentals'][i % 3],
      final_signal: signals[i % signals.length],
      dashboard_forecast_method: 'drift_directional_forecast',
      review_reason: null,
      forecast_naive_30d: null,
      forecast_moving_average_30d_30d: null,
      forecast_drift_30d: null,
      forecast_recent_linear_trend_252d_30d: null,
      latest_close: null,
      forecast_lower_band_30d: null,
      forecast_upper_band_30d: null,
    }
  })
}

function getSampleSectorSummary(): SectorSummary[] {
  return [
    { sector: 'Technology', number_of_companies: 78, avg_forecast_30d_upside_pct: 0.45, avg_model_mape: 1.82, avg_annualized_volatility_pct: 38.2, avg_profit_margin_pct: 22.1, avg_ebitda_margin_pct: 28.4, potential_opportunity_count: 0, high_volatility_speculative_count: 0, weak_negative_count: 0, stable_watchlist_count: 65, needs_further_review_count: 13 },
    { sector: 'Healthcare', number_of_companies: 65, avg_forecast_30d_upside_pct: 0.31, avg_model_mape: 1.55, avg_annualized_volatility_pct: 28.6, avg_profit_margin_pct: 16.8, avg_ebitda_margin_pct: 22.3, potential_opportunity_count: 0, high_volatility_speculative_count: 0, weak_negative_count: 0, stable_watchlist_count: 58, needs_further_review_count: 7 },
    { sector: 'Financial Services', number_of_companies: 67, avg_forecast_30d_upside_pct: 0.28, avg_model_mape: 1.41, avg_annualized_volatility_pct: 25.4, avg_profit_margin_pct: 24.5, avg_ebitda_margin_pct: 31.2, potential_opportunity_count: 0, high_volatility_speculative_count: 0, weak_negative_count: 0, stable_watchlist_count: 62, needs_further_review_count: 5 },
    { sector: 'Consumer Cyclical', number_of_companies: 54, avg_forecast_30d_upside_pct: 0.19, avg_model_mape: 1.73, avg_annualized_volatility_pct: 34.1, avg_profit_margin_pct: 8.2, avg_ebitda_margin_pct: 14.6, potential_opportunity_count: 0, high_volatility_speculative_count: 0, weak_negative_count: 0, stable_watchlist_count: 46, needs_further_review_count: 8 },
    { sector: 'Industrials', number_of_companies: 67, avg_forecast_30d_upside_pct: 0.22, avg_model_mape: 1.38, avg_annualized_volatility_pct: 26.8, avg_profit_margin_pct: 11.4, avg_ebitda_margin_pct: 18.9, potential_opportunity_count: 0, high_volatility_speculative_count: 0, weak_negative_count: 0, stable_watchlist_count: 65, needs_further_review_count: 2 },
    { sector: 'Energy', number_of_companies: 23, avg_forecast_30d_upside_pct: 0.38, avg_model_mape: 1.92, avg_annualized_volatility_pct: 35.7, avg_profit_margin_pct: 9.8, avg_ebitda_margin_pct: 16.2, potential_opportunity_count: 0, high_volatility_speculative_count: 0, weak_negative_count: 0, stable_watchlist_count: 21, needs_further_review_count: 2 },
    { sector: 'Communication Services', number_of_companies: 22, avg_forecast_30d_upside_pct: 0.41, avg_model_mape: 1.61, avg_annualized_volatility_pct: 32.4, avg_profit_margin_pct: 14.3, avg_ebitda_margin_pct: 24.1, potential_opportunity_count: 0, high_volatility_speculative_count: 0, weak_negative_count: 0, stable_watchlist_count: 20, needs_further_review_count: 2 },
    { sector: 'Basic Materials', number_of_companies: 28, avg_forecast_30d_upside_pct: 0.15, avg_model_mape: 1.84, avg_annualized_volatility_pct: 29.3, avg_profit_margin_pct: 7.6, avg_ebitda_margin_pct: 12.8, potential_opportunity_count: 0, high_volatility_speculative_count: 0, weak_negative_count: 0, stable_watchlist_count: 26, needs_further_review_count: 2 },
  ]
}
