import { TRADING_DAYS } from './config'

/**
 * Rolling annualized volatility: sample std (n-1) of the last `win` daily returns times
 * sqrt(252). The first win-1 entries are NaN because there is not a full window yet.
 */
export function rollingVol(r: number[], win: number): number[] {
  const out = new Array<number>(r.length).fill(NaN)
  for (let t = win - 1; t < r.length; t++) {
    let m = 0
    for (let k = t - win + 1; k <= t; k++) m += r[k]
    m /= win
    let s = 0
    for (let k = t - win + 1; k <= t; k++) s += (r[k] - m) * (r[k] - m)
    out[t] = Math.sqrt(s / (win - 1)) * Math.sqrt(TRADING_DAYS)
  }
  return out
}

/**
 * Weighted average pairwise correlation over a rolling window:
 * sum_(i!=j) w_i w_j rho_ij / sum_(i!=j) w_i w_j, with rho from the last `win` days.
 * Pairs with a flat window (undefined correlation) are skipped. NaN until a full window,
 * and NaN for a single holding.
 *
 * Uses sliding sums so each step costs O(n^2) instead of O(n^2 * win). Returns are
 * centered first so the sums do not lose precision.
 */
export function rollingAvgCorrelation(returns: number[][], w: number[], win: number): number[] {
  const n = returns.length
  const T = n ? returns[0].length : 0
  const out = new Array<number>(T).fill(NaN)
  if (n < 2 || T < win) return out

  const x = returns.map(row => {
    const m = row.reduce((a, b) => a + b, 0) / T
    return row.map(v => v - m)
  })
  const s = new Array<number>(n).fill(0)
  const q: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0))

  const add = (t: number, sign: 1 | -1) => {
    for (let i = 0; i < n; i++) {
      const xi = x[i][t]
      s[i] += sign * xi
      for (let j = i; j < n; j++) q[i][j] += sign * xi * x[j][t]
    }
  }
  for (let t = 0; t < win - 1; t++) add(t, 1)

  for (let t = win - 1; t < T; t++) {
    add(t, 1)
    if (t >= win) add(t - win, -1)
    let num = 0
    let den = 0
    for (let i = 0; i < n; i++) {
      const vi = (q[i][i] - (s[i] * s[i]) / win) / (win - 1)
      if (!(vi > 1e-14)) continue
      for (let j = i + 1; j < n; j++) {
        const vj = (q[j][j] - (s[j] * s[j]) / win) / (win - 1)
        if (!(vj > 1e-14)) continue
        const c = (q[i][j] - (s[i] * s[j]) / win) / (win - 1)
        const rho = Math.max(-1, Math.min(1, c / Math.sqrt(vi * vj)))
        num += 2 * w[i] * w[j] * rho
        den += 2 * w[i] * w[j]
      }
    }
    out[t] = den > 0 ? num / den : NaN
  }
  return out
}

/**
 * Stretches where a drawdown path is at or below `threshold` (e.g. -0.10 for "10% or more
 * below the high"). Returns inclusive index ranges into the path.
 */
export function shadedPeriods(drawdown: number[], threshold: number): { start: number; end: number }[] {
  const out: { start: number; end: number }[] = []
  let start = -1
  for (let t = 0; t < drawdown.length; t++) {
    const below = drawdown[t] <= threshold
    if (below && start < 0) start = t
    if (!below && start >= 0) {
      out.push({ start, end: t - 1 })
      start = -1
    }
  }
  if (start >= 0) out.push({ start, end: drawdown.length - 1 })
  return out
}
