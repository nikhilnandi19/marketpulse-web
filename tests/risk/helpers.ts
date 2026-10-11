import type { Dataset, ReturnPanel } from '@/lib/risk'

export function close(a: number, b: number, tol = 1e-8): boolean {
  return Math.abs(a - b) <= tol
}

export function maxAbsDiff(a: number[], b: number[]): number {
  if (a.length !== b.length) return Infinity
  let m = 0
  for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i]))
  return m
}

export function flat(m: number[][]): number[] {
  return m.reduce<number[]>((acc, r) => acc.concat(r), [])
}

/** Build a ReturnPanel straight from a return matrix (assets x days). */
export function panelFrom(returns: number[][], bench?: number[]): ReturnPanel {
  const T = returns[0].length
  return {
    symbols: returns.map((_, i) => `S${i}`),
    dates: Array.from({ length: T }, (_, t) => `d${t}`),
    baseDate: 'd-1',
    returns,
    bench: bench ?? new Array(T).fill(0).map((_, t) => returns[0][t] * 0.5 + 0.001 * Math.sin(t)),
    droppedDates: [],
    excluded: [],
    windowDays: T,
  }
}

/** Small synthetic dataset: dates d0..d{n-1}, prices given per symbol. */
export function datasetFrom(series: Record<string, (number | null)[]>, bench: (number | null)[]): Dataset {
  return { dates: bench.map((_, i) => `2020-01-${String(i + 1).padStart(2, '0')}`), benchmark: bench, series }
}
