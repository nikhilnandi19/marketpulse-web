import { PARTIAL_COVERAGE } from './config'
import { drawdownFromWealth } from './drawdown'
import { normalizeHoldings } from './portfolio'
import { SCENARIOS, type Scenario } from './scenarios'
import type { Dataset, Holding } from './types'

export interface ScenarioHolding {
  symbol: string
  /** Weight after dropping holdings with no data and renormalizing. */
  weight: number
  /** Holding's return from the start close to the end close. */
  ret: number
  /** weight * ret. These add up exactly to the portfolio return. */
  contribution: number
}

export interface ScenarioResult {
  id: string
  name: string
  start: string
  end: string
  status: 'full' | 'partial' | 'unavailable'
  /** Share of the original portfolio weight that had price data on both dates. */
  coverage: number
  /** Why a scenario is unavailable. */
  reason?: string
  portfolioReturn?: number
  benchmarkReturn?: number
  worstDay?: { value: number; date: string }
  maxDrawdown?: number
  holdings: ScenarioHolding[]
  /** The three biggest losses by contribution (only those below zero). */
  topLosers: ScenarioHolding[]
  excluded: string[]
  /** Days inside the window where a holding had no price and its last price was carried. */
  carriedDays: number
}

function unavailable(s: Scenario, reason: string, excluded: string[] = []): ScenarioResult {
  return { id: s.id, name: s.name, start: s.start, end: s.end, status: 'unavailable', coverage: 0, reason, holdings: [], topLosers: [], excluded, carriedDays: 0 }
}

/**
 * Replay a historical window. Start-of-window weights, buy and hold, no rebalancing.
 * Holdings with no price on the start or end date are left out and the rest renormalized;
 * `coverage` says how much of the original weight remained.
 * `weights` must sum to 1 and line up with `symbols`.
 */
export function scenarioReplay(ds: Dataset, symbols: string[], weights: number[], s: Scenario): ScenarioResult {
  if (ds.dates.length === 0 || s.start < ds.dates[0]) {
    return unavailable(s, 'Price history does not reach back this far.')
  }
  const si = ds.dates.indexOf(s.start)
  const ei = ds.dates.indexOf(s.end)
  if (si < 0 || ei < 0 || ei <= si) return unavailable(s, 'Scenario dates are not in the price calendar.')
  const b0 = ds.benchmark[si]
  const b1 = ds.benchmark[ei]
  if (b0 == null || b1 == null) return unavailable(s, 'Benchmark has no price on a scenario date.')

  const used: number[] = []
  const excluded: string[] = []
  let coverage = 0
  symbols.forEach((sym, i) => {
    const p = ds.series[sym]
    if (p && p[si] != null && p[ei] != null) {
      used.push(i)
      coverage += weights[i]
    } else excluded.push(sym)
  })
  if (used.length === 0 || !(coverage > 0)) {
    return unavailable(s, 'None of the holdings have prices on both scenario dates.', excluded)
  }

  const holdings: ScenarioHolding[] = used.map(i => {
    const p = ds.series[symbols[i]]
    const w = weights[i] / coverage
    const ret = (p[ei] as number) / (p[si] as number) - 1
    return { symbol: symbols[i], weight: w, ret, contribution: w * ret }
  })
  const portfolioReturn = holdings.reduce((a, h) => a + h.contribution, 0)

  // Daily buy-and-hold value inside the window. A missing price carries the last one.
  const last = used.map(i => ds.series[symbols[i]][si] as number)
  let carriedDays = 0
  const value: number[] = [1]
  const days: string[] = [s.start]
  for (let t = si + 1; t <= ei; t++) {
    let v = 0
    used.forEach((i, k) => {
      const p = ds.series[symbols[i]][t]
      if (p == null) carriedDays++
      else last[k] = p
      v += (weights[i] / coverage) * (last[k] / (ds.series[symbols[i]][si] as number))
    })
    value.push(v)
    days.push(ds.dates[t])
  }
  let worst = { value: Infinity, date: '' }
  for (let t = 1; t < value.length; t++) {
    const r = value[t] / value[t - 1] - 1
    if (r < worst.value) worst = { value: r, date: days[t] }
  }

  return {
    id: s.id,
    name: s.name,
    start: s.start,
    end: s.end,
    status: coverage < PARTIAL_COVERAGE ? 'partial' : 'full',
    coverage,
    portfolioReturn,
    benchmarkReturn: b1 / b0 - 1,
    worstDay: worst,
    maxDrawdown: drawdownFromWealth(value).maxDrawdown,
    holdings,
    topLosers: [...holdings].filter(h => h.contribution < 0).sort((a, b) => a.contribution - b.contribution).slice(0, 3),
    excluded,
    carriedDays,
  }
}

export interface MarketShock {
  portfolioBeta: number
  /** beta_p * shock. An approximation that assumes betas hold. */
  estimatedMove: number
  perHolding: { symbol: string; contribution: number }[]
}

/** Estimated portfolio move for a market move: beta_p * shock, with beta_p = sum w_i beta_i. */
export function marketShock(symbols: string[], weights: number[], betas: number[], shock: number): MarketShock {
  const perHolding = symbols.map((symbol, i) => ({ symbol, contribution: weights[i] * betas[i] * shock }))
  const portfolioBeta = weights.reduce((a, w, i) => a + w * betas[i], 0)
  return { portfolioBeta, estimatedMove: portfolioBeta * shock, perHolding }
}

export interface SectorShock {
  affectedWeight: number
  /** Portfolio move if only this sector moves by `shock` and everything else is flat. */
  impact: number
  perHolding: { symbol: string; contribution: number }[]
}

export function sectorShock(symbols: string[], weights: number[], sectorOf: Record<string, string>, sector: string, shock: number): SectorShock {
  const perHolding: { symbol: string; contribution: number }[] = []
  let affectedWeight = 0
  symbols.forEach((symbol, i) => {
    if ((sectorOf[symbol] || 'Unknown') === sector) {
      affectedWeight += weights[i]
      perHolding.push({ symbol, contribution: weights[i] * shock })
    }
  })
  return { affectedWeight, impact: affectedWeight * shock, perHolding }
}

/**
 * Market move that would take the portfolio down by `targetLoss` (e.g. -0.2), assuming beta holds.
 * Null if beta is not positive, because no market fall then produces that loss.
 */
export function reverseStress(targetLoss: number, portfolioBeta: number): number | null {
  return portfolioBeta > 0 ? targetLoss / portfolioBeta : null
}

/**
 * Replay every configured scenario for the entered holdings. Uses the entered weights
 * (scaled to 100%) including holdings that have no price history, so `coverage` reflects
 * how much of what was entered actually had data. Empty if the holdings are invalid.
 */
export function runScenarios(ds: Dataset, holdings: Holding[]): ScenarioResult[] {
  const norm = normalizeHoldings(holdings)
  if (norm.issues.length > 0) return []
  return SCENARIOS.map(s => scenarioReplay(ds, norm.symbols, norm.weights, s))
}
