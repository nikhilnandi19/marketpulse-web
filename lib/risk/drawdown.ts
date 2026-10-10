import type { DrawdownResult, WorstPeriod } from './types'

/** Wealth path for a return series: W_0 = 1, W_t = W_(t-1) * (1 + r_t). Length T+1. */
export function wealthPath(r: number[]): number[] {
  const w = new Array<number>(r.length + 1)
  w[0] = 1
  for (let t = 0; t < r.length; t++) w[t + 1] = w[t] * (1 + r[t])
  return w
}

/**
 * Drawdown from a wealth path: how far below the running peak we are.
 * Index 0 is the starting point, so a loss from day one counts as a drawdown.
 * Ties for the deepest point go to the earliest one.
 */
export function drawdownFromWealth(wealth: number[]): DrawdownResult {
  const n = wealth.length
  const dd = new Array<number>(n)
  let peak = wealth[0]
  let peakIdx = 0
  let maxDd = 0
  let maxPeakIdx = 0
  let troughIdx = 0
  for (let t = 0; t < n; t++) {
    if (wealth[t] > peak) {
      peak = wealth[t]
      peakIdx = t
    }
    dd[t] = wealth[t] / peak - 1
    if (dd[t] < maxDd) {
      maxDd = dd[t]
      maxPeakIdx = peakIdx
      troughIdx = t
    }
  }
  let recoveryIdx: number | null = null
  if (maxDd < 0) {
    const peakValue = wealth[maxPeakIdx]
    for (let t = troughIdx + 1; t < n; t++) {
      if (wealth[t] >= peakValue) {
        recoveryIdx = t
        break
      }
    }
  }
  const daysUnderwater = maxDd < 0 ? (recoveryIdx ?? n - 1) - maxPeakIdx : 0
  return {
    wealth,
    drawdown: dd,
    maxDrawdown: maxDd,
    peakIdx: maxPeakIdx,
    troughIdx,
    recoveryIdx,
    daysUnderwater,
  }
}

export function drawdownFromReturns(r: number[]): DrawdownResult {
  return drawdownFromWealth(wealthPath(r))
}

/**
 * Buy-and-hold value path: money is split by the starting weights and then left alone,
 * so winners grow into a bigger share. V_t = sum_i w_i * prod(1 + r_i). Length T+1.
 */
export function buyAndHoldPath(returns: number[][], w: number[]): number[] {
  const T = returns.length ? returns[0].length : 0
  const growth = w.map(() => 1)
  const out = new Array<number>(T + 1)
  out[0] = w.reduce((a, b) => a + b, 0)
  for (let t = 0; t < T; t++) {
    let v = 0
    for (let i = 0; i < w.length; i++) {
      growth[i] *= 1 + returns[i][t]
      v += w[i] * growth[i]
    }
    out[t + 1] = v
  }
  return out
}

/**
 * Worst compounded return over any k consecutive days (k=1 is the worst day).
 * Returns null when there are fewer than k days.
 */
export function worstRolling(r: number[], k: number): WorstPeriod | null {
  if (r.length < k || k < 1) return null
  let best: WorstPeriod | null = null
  for (let end = k - 1; end < r.length; end++) {
    let g = 1
    for (let t = end - k + 1; t <= end; t++) g *= 1 + r[t]
    const v = g - 1
    if (best === null || v < best.value) best = { value: v, startIdx: end - k + 1, endIdx: end }
  }
  return best
}
