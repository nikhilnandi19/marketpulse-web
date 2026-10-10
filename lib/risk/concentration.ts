import { sum } from './stats'

/** Herfindahl index: sum of squared weights. 1 means a single holding. */
export function hhi(w: number[]): number {
  return sum(w.map(x => x * x))
}

/** How many equal-sized positions would give the same concentration: 1 / HHI. */
export function effectiveHoldings(w: number[]): number {
  const h = hhi(w)
  return h > 0 ? 1 / h : NaN
}

/** Combined weight of the n largest holdings. */
export function topWeight(w: number[], n: number): number {
  return sum([...w].sort((a, b) => b - a).slice(0, n))
}

/** Weight per sector, largest first. Symbols missing from the map count as "Unknown". */
export function sectorWeights(symbols: string[], w: number[], sectorOf: Record<string, string>): { sector: string; weight: number }[] {
  const acc: Record<string, number> = {}
  symbols.forEach((s, i) => {
    const sec = sectorOf[s] || 'Unknown'
    acc[sec] = (acc[sec] ?? 0) + w[i]
  })
  return Object.keys(acc).map(sector => ({ sector, weight: acc[sector] })).sort((a, b) => b.weight - a.weight)
}

/** (sum w_i sigma_i) / sigma_p. 1 when everything moves together; higher means diversification is helping. */
export function diversificationRatio(w: number[], assetVols: number[], portfolioVolatility: number): number {
  if (!(portfolioVolatility > 0)) return NaN
  return sum(w.map((x, i) => x * assetVols[i])) / portfolioVolatility
}

/**
 * Weighted average correlation between different holdings:
 * sum_(i!=j) w_i w_j rho_ij / sum_(i!=j) w_i w_j. NaN with one holding.
 * Pairs whose correlation is undefined (a flat price series) are skipped on both sides.
 */
export function avgPairwiseCorrelation(corr: number[][], w: number[]): number {
  let num = 0
  let den = 0
  for (let i = 0; i < w.length; i++) {
    for (let j = 0; j < w.length; j++) {
      if (i === j || Number.isNaN(corr[i][j])) continue
      num += w[i] * w[j] * corr[i][j]
      den += w[i] * w[j]
    }
  }
  return den > 0 ? num / den : NaN
}

export function mostCorrelatedPair(corr: number[][], symbols: string[]): { a: string; b: string; corr: number } | null {
  let best: { a: string; b: string; corr: number } | null = null
  for (let i = 0; i < symbols.length; i++) {
    for (let j = i + 1; j < symbols.length; j++) {
      const c = corr[i][j]
      if (!Number.isNaN(c) && (best === null || c > best.corr)) best = { a: symbols[i], b: symbols[j], corr: c }
    }
  }
  return best
}
