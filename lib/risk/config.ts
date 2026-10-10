/** Constants for the risk library. Change numbers here, not inside the math. */

export const TRADING_DAYS = 252

/** Lookback windows in trading days. */
export const WINDOWS = { '1Y': 252, '2Y': 504, '3Y': 756, '5Y': 1260 } as const
export type WindowKey = keyof typeof WINDOWS
export const DEFAULT_WINDOW: WindowKey = '2Y'

/** Fewer usable return days than this and the page says "not enough history". */
export const MIN_OBSERVATIONS = 120

/**
 * A holding must have returns on at least this share of the window's days.
 * Otherwise adding it would silently shrink everyone's window to its short
 * history, so it is left out and named in a notice instead.
 */
export const MIN_COVERAGE = 0.9

export const MAX_HOLDINGS = 30

/** Normal-distribution z scores, as given in the spec. */
export const Z_SCORES: Record<number, number> = { 0.95: 1.645, 0.99: 2.326 }

/** Below this many tail days the VaR/ES estimate is flagged as low confidence. */
export const MIN_TAIL_OBSERVATIONS = 10

/** A scenario is "partial" when less than this share of weight had price data. */
export const PARTIAL_COVERAGE = 0.8

/** Plain-language flag thresholds (used by the UI in a later phase). */
export const FLAGS = {
  singleHolding: 0.25,
  singleSector: 0.4,
  topThree: 0.6,
  avgCorrelation: 0.6,
  riskShareMultiple: 2,
  riskShareFloor: 0.2,
  volVsBenchmark: 1.5,
} as const
