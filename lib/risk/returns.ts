import { MIN_COVERAGE, MIN_OBSERVATIONS } from './config'
import type { Dataset, PriceFile, ReturnPanel } from './types'

/**
 * Turn exported price files into a calendar-aligned dataset.
 * Nothing is filled in: a missing day stays null.
 */
export function buildDataset(dates: string[], benchmark: PriceFile, files: PriceFile[]): Dataset {
  const align = (f: PriceFile): (number | null)[] => {
    const out: (number | null)[] = new Array(dates.length).fill(null)
    for (let i = 0; i < f.prices.length; i++) {
      const idx = f.start + i
      if (idx < dates.length) out[idx] = f.prices[i]
    }
    return out
  }
  const series: Record<string, (number | null)[]> = {}
  for (const f of files) series[f.symbol] = align(f)
  return { dates, benchmark: align(benchmark), series }
}

/**
 * Daily simple returns r_t = P_t / P_(t-1) - 1, aligned to the same index as prices.
 *
 * Gap rule: if exactly one day is missing, the next day's return is measured from
 * the last good price (so it covers two days). If two or more days in a row are
 * missing, the first return after the gap is left null rather than guessed.
 * A missing day itself always has a null return.
 */
export function simpleReturns(prices: (number | null)[]): (number | null)[] {
  const out: (number | null)[] = new Array(prices.length).fill(null)
  let lastIdx = -1
  for (let t = 0; t < prices.length; t++) {
    const p = prices[t]
    if (p == null) continue
    if (lastIdx >= 0 && t - lastIdx <= 2) {
      out[t] = p / (prices[lastIdx] as number) - 1
    }
    lastIdx = t
  }
  return out
}

export interface PanelOptions {
  /** Window length in trading days (number of return rows requested). */
  windowDays: number
  /** Last calendar index to include. Defaults to the last date. */
  endIdx?: number
  minObservations?: number
  minCoverage?: number
}

/**
 * Build the aligned return panel for a window.
 *
 * 1. Take the last `windowDays` calendar dates (returns on those dates).
 * 2. A holding with no data, fewer than `minObservations` returns, or returns on
 *    less than `minCoverage` of the window is excluded and reported.
 * 3. A date is kept only if every remaining holding AND the benchmark has a
 *    return that day. Other dates are dropped and listed.
 */
export function buildReturnPanel(ds: Dataset, symbols: string[], opts: PanelOptions): ReturnPanel {
  const minObs = opts.minObservations ?? MIN_OBSERVATIONS
  const minCov = opts.minCoverage ?? MIN_COVERAGE
  const endIdx = opts.endIdx ?? ds.dates.length - 1
  const startIdx = Math.max(1, endIdx - opts.windowDays + 1)
  const windowLen = endIdx - startIdx + 1

  const benchRet = simpleReturns(ds.benchmark)
  const retBySym: Record<string, (number | null)[]> = {}
  const excluded: ReturnPanel['excluded'] = []
  const kept: string[] = []

  for (const sym of symbols) {
    const prices = ds.series[sym]
    if (!prices) {
      excluded.push({ symbol: sym, days: 0, reason: 'no_data' })
      continue
    }
    const r = simpleReturns(prices)
    let days = 0
    for (let t = startIdx; t <= endIdx; t++) if (r[t] != null && benchRet[t] != null) days++
    if (days === 0) {
      excluded.push({ symbol: sym, days: 0, reason: 'no_data' })
    } else if (days < minObs || days < minCov * windowLen) {
      excluded.push({ symbol: sym, days, reason: 'short_history' })
    } else {
      retBySym[sym] = r
      kept.push(sym)
    }
  }

  const dates: string[] = []
  const droppedDates: string[] = []
  const cols: number[] = []
  for (let t = startIdx; t <= endIdx; t++) {
    const ok = benchRet[t] != null && kept.every(s => retBySym[s][t] != null)
    if (ok) cols.push(t)
    else droppedDates.push(ds.dates[t])
  }
  for (const t of cols) dates.push(ds.dates[t])

  return {
    symbols: kept,
    dates,
    baseDate: ds.dates[startIdx - 1],
    returns: kept.map(s => cols.map(t => retBySym[s][t] as number)),
    bench: cols.map(t => benchRet[t] as number),
    droppedDates,
    excluded,
    windowDays: windowLen,
  }
}
