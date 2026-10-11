/** Shared types for the portfolio risk library. No React or DOM imports anywhere in lib/risk. */

/** One price file as exported by scripts/06_export_price_history.py. */
export interface PriceFile {
  symbol: string
  /** Index into the calendar where prices[0] sits. */
  start: number
  /** Adjusted closes, null for a missing day. */
  prices: (number | null)[]
}

/** Calendar plus adjusted closes aligned to it (null before listing or on gaps). */
export interface Dataset {
  dates: string[]
  benchmark: (number | null)[]
  series: Record<string, (number | null)[]>
}

export interface Holding {
  symbol: string
  /** Raw weight as entered (any positive scale, normalized later). */
  weight: number
}

export interface HoldingIssue {
  symbol?: string
  code: 'empty' | 'too_many' | 'duplicate' | 'bad_weight' | 'zero_total'
  message: string
}

/**
 * Aligned daily simple returns for the holdings that made it into the window.
 * returns[i][t] belongs to symbols[i] on dates[t]. Every cell is a finite number.
 */
export interface ReturnPanel {
  symbols: string[]
  /** Dates of the return rows. dates.length === T. */
  dates: string[]
  /** Date of the price the first return is measured from. */
  baseDate: string
  returns: number[][]
  bench: number[]
  /** Calendar dates inside the window dropped because some holding had no return. */
  droppedDates: string[]
  /** Holdings left out of the window, with the number of usable return days they had. */
  excluded: { symbol: string; days: number; reason: 'no_data' | 'short_history' }[]
  windowDays: number
}

export interface DrawdownResult {
  /** Wealth path, length T+1, starting at 1. */
  wealth: number[]
  /** Drawdown path, length T+1, each value <= 0. */
  drawdown: number[]
  maxDrawdown: number
  peakIdx: number
  troughIdx: number
  /** First index after the trough where wealth is back at the peak, or null. */
  recoveryIdx: number | null
  /** Trading days from the peak to recovery (or to the last day if not recovered). */
  daysUnderwater: number
}

export interface TailStats {
  confidence: number
  var: number
  es: number
  normalVar: number
  tailCount: number
}

export interface WorstPeriod {
  value: number
  startIdx: number
  endIdx: number
}
