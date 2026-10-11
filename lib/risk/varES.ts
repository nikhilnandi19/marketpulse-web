import { MIN_TAIL_OBSERVATIONS, Z_SCORES } from './config'
import { mean, quantile, std } from './stats'
import type { TailStats } from './types'

/** The cutoff return: the (1 - confidence) quantile, e.g. the 5th percentile for 95%. */
export function tailCutoff(r: number[], confidence: number): number {
  return quantile(r, 1 - confidence)
}

/** Indices of the "bad days": days with return at or below the cutoff. */
export function tailIndices(r: number[], confidence: number): number[] {
  const q = tailCutoff(r, confidence)
  const idx: number[] = []
  for (let t = 0; t < r.length; t++) if (r[t] <= q) idx.push(t)
  return idx
}

/** Historical 1-day VaR as a positive loss: VaR = -Q_(1-a)(r). */
export function historicalVaR(r: number[], confidence: number): number {
  return -tailCutoff(r, confidence)
}

/** Expected shortfall: average loss on the bad days, as a positive number. */
export function expectedShortfall(r: number[], confidence: number): number {
  const idx = tailIndices(r, confidence)
  return -mean(idx.map(t => r[t]))
}

/** Normal-model VaR for comparison: -(mu - z * sigma). */
export function normalVaR(r: number[], confidence: number): number {
  const z = Z_SCORES[confidence]
  if (z === undefined) throw new Error(`No z score for confidence ${confidence}`)
  return -(mean(r) - z * std(r))
}

export function tailStats(r: number[], confidence: number): TailStats {
  return {
    confidence,
    var: historicalVaR(r, confidence),
    es: expectedShortfall(r, confidence),
    normalVar: normalVaR(r, confidence),
    tailCount: tailIndices(r, confidence).length,
  }
}

export function isLowConfidence(tailCount: number): boolean {
  return tailCount < MIN_TAIL_OBSERVATIONS
}
