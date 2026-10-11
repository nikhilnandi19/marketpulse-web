import { MAX_HOLDINGS } from './config'
import { sum } from './stats'
import type { Holding, HoldingIssue } from './types'

export interface NormalizedHoldings {
  symbols: string[]
  /** Weights that sum to 1. */
  weights: number[]
  /** True when the entered weights did not already sum to 1 (shown as a "normalized" note). */
  wasNormalized: boolean
  issues: HoldingIssue[]
}

/**
 * Validate long-only holdings and scale weights to sum to 1.
 * Scaling every weight by the same constant changes nothing.
 * Returns issues instead of throwing; weights are empty if there are blocking issues.
 */
export function normalizeHoldings(holdings: Holding[]): NormalizedHoldings {
  const issues: HoldingIssue[] = []
  if (holdings.length === 0) issues.push({ code: 'empty', message: 'Add at least one stock.' })
  if (holdings.length > MAX_HOLDINGS) {
    issues.push({ code: 'too_many', message: `A portfolio can hold at most ${MAX_HOLDINGS} stocks.` })
  }
  const seen = new Set<string>()
  for (const h of holdings) {
    const sym = h.symbol.trim().toUpperCase()
    if (seen.has(sym)) issues.push({ symbol: sym, code: 'duplicate', message: `${sym} appears more than once.` })
    seen.add(sym)
    if (!Number.isFinite(h.weight) || h.weight < 0) {
      issues.push({ symbol: sym, code: 'bad_weight', message: `${sym} needs a weight of 0 or more.` })
    }
  }
  const total = sum(holdings.map(h => (Number.isFinite(h.weight) ? Math.max(0, h.weight) : 0)))
  if (issues.length === 0 && !(total > 0)) {
    issues.push({ code: 'zero_total', message: 'Weights must add up to more than zero.' })
  }
  if (issues.length > 0) return { symbols: [], weights: [], wasNormalized: false, issues }
  return {
    symbols: holdings.map(h => h.symbol.trim().toUpperCase()),
    weights: holdings.map(h => h.weight / total),
    wasNormalized: Math.abs(total - 1) > 1e-9,
    issues,
  }
}

export function equalWeights(n: number): number[] {
  return new Array(n).fill(1 / n)
}

/** Renormalize a subset of weights (used when holdings are dropped from a window). */
export function renormalize(weights: number[]): number[] {
  const total = sum(weights)
  return total > 0 ? weights.map(w => w / total) : weights.map(() => NaN)
}

/** Portfolio daily return r_p,t = sum_i w_i * r_i,t (constant weights, rebalanced daily). */
export function portfolioReturns(returns: number[][], w: number[]): number[] {
  const T = returns.length ? returns[0].length : 0
  const out = new Array<number>(T).fill(0)
  for (let i = 0; i < returns.length; i++) {
    const row = returns[i]
    const wi = w[i]
    for (let t = 0; t < T; t++) out[t] += wi * row[t]
  }
  return out
}

/** Inverse-volatility what-if weights: w_i proportional to 1 / sigma_i. */
export function inverseVolWeights(vols: number[]): number[] {
  const inv = vols.map(v => (v > 0 ? 1 / v : 0))
  return renormalize(inv)
}
