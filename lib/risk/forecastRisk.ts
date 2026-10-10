/**
 * Joins the dashboard's model forecasts with each holding's share of risk.
 * Forecasts and risk stay separate numbers. They are never blended into a score.
 */

export type Reliability = 'strong' | 'acceptable' | 'high_error' | 'unknown'

/** MAPE bands from the dashboard's own definitions: under 2% strong, 2 to 5% acceptable, above 5% high error. */
export function reliabilityBand(mapePct: number | null | undefined): Reliability {
  if (mapePct == null || !Number.isFinite(mapePct) || mapePct <= 0) return 'unknown'
  if (mapePct < 2) return 'strong'
  if (mapePct <= 5) return 'acceptable'
  return 'high_error'
}

export interface ForecastRiskInput {
  symbol: string
  /** Weight inside the risk numbers (sums to 1 across the inputs). */
  weight: number
  /** Share of portfolio volatility, as a fraction. */
  riskShare: number
  /** The model's 30-day forecast upside, in percent. */
  forecastUpsidePct: number
  /** The model's average error on its backtest, in percent. */
  mapePct: number
}

export type Quadrant = 'low_risk_up' | 'high_risk_up' | 'low_risk_down' | 'high_risk_down'

export interface ForecastRiskPoint extends ForecastRiskInput {
  reliability: Reliability
  quadrant: Quadrant
}

export interface ForecastRiskSummary {
  points: ForecastRiskPoint[]
  /** An equal share of risk. Points right of this carry more than their fair share. */
  equalShare: number
  /** sum w_i * forecast_i, in percent. */
  weightedUpsidePct: number
  /** sum w_i * mape_i, in percent. */
  weightedMapePct: number
}

export function forecastRiskSummary(rows: ForecastRiskInput[]): ForecastRiskSummary {
  const equalShare = rows.length ? 1 / rows.length : 0
  const points = rows.map(r => ({
    ...r,
    reliability: reliabilityBand(r.mapePct),
    quadrant: (r.riskShare > equalShare
      ? r.forecastUpsidePct >= 0 ? 'high_risk_up' : 'high_risk_down'
      : r.forecastUpsidePct >= 0 ? 'low_risk_up' : 'low_risk_down') as Quadrant,
  }))
  const wsum = rows.reduce((a, r) => a + r.weight, 0)
  const wavg = (f: (r: ForecastRiskInput) => number) => (wsum > 0 ? rows.reduce((a, r) => a + r.weight * f(r), 0) / wsum : NaN)
  return { points, equalShare, weightedUpsidePct: wavg(r => r.forecastUpsidePct), weightedMapePct: wavg(r => r.mapePct) }
}
