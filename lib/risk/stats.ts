/** Basic statistics. Conventions match numpy/pandas so results can be checked against them. */

export function sum(x: number[]): number {
  let s = 0
  for (let i = 0; i < x.length; i++) s += x[i]
  return s
}

export function mean(x: number[]): number {
  return x.length ? sum(x) / x.length : NaN
}

/** Sample variance (divide by n-1, like pandas std/var default). */
export function variance(x: number[]): number {
  const n = x.length
  if (n < 2) return NaN
  const m = mean(x)
  let s = 0
  for (let i = 0; i < n; i++) s += (x[i] - m) * (x[i] - m)
  return s / (n - 1)
}

export function std(x: number[]): number {
  return Math.sqrt(variance(x))
}

/**
 * Quantile with linear interpolation (numpy's default). For q in [0,1] the
 * position is (n-1)*q in the sorted data; we blend the two neighbours.
 */
export function quantile(x: number[], q: number): number {
  const n = x.length
  if (n === 0) return NaN
  const s = [...x].sort((a, b) => a - b)
  const pos = (n - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  if (lo === hi) return s[lo]
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

/** Sample covariance (n-1). */
export function cov(x: number[], y: number[]): number {
  const n = x.length
  if (n < 2 || y.length !== n) return NaN
  const mx = mean(x)
  const my = mean(y)
  let s = 0
  for (let i = 0; i < n; i++) s += (x[i] - mx) * (y[i] - my)
  return s / (n - 1)
}

/** Pearson correlation. NaN if either series has zero variance. */
export function corr(x: number[], y: number[]): number {
  const sx = std(x)
  const sy = std(y)
  if (!(sx > 0) || !(sy > 0)) return NaN
  const c = cov(x, y) / (sx * sy)
  // Floating-point rounding can push |c| a hair past 1.
  return Math.max(-1, Math.min(1, c))
}

/** Sample covariance matrix of rows (one row per asset). */
export function covMatrix(rows: number[][]): number[][] {
  const k = rows.length
  const out: number[][] = Array.from({ length: k }, () => new Array(k).fill(0))
  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      const c = cov(rows[i], rows[j])
      out[i][j] = c
      out[j][i] = c
    }
  }
  return out
}

export function corrMatrix(rows: number[][]): number[][] {
  const k = rows.length
  const out: number[][] = Array.from({ length: k }, () => new Array(k).fill(1))
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const c = corr(rows[i], rows[j])
      out[i][j] = c
      out[j][i] = c
    }
    if (!(std(rows[i]) > 0)) out[i][i] = NaN
  }
  return out
}

/** Beta of y against x: cov(y, x) / var(x), same ddof for both. */
export function beta(y: number[], x: number[]): number {
  const v = variance(x)
  return v > 0 ? cov(y, x) / v : NaN
}
