import { buyAndHoldPath, drawdownFromWealth, wealthPath } from './drawdown'
import { portfolioReturns } from './portfolio'
import type { ReturnPanel } from './types'

export interface GrowthPaths {
  /** T+1 dates; the first is the base date the paths start from. */
  dates: string[]
  /** Value of 100 invested at the start, portfolio rebalanced to constant weights every day. */
  portfolio: number[]
  /** Same, but weights drift after the start (no rebalancing). */
  buyAndHold: number[]
  benchmark: number[]
  /** Drawdown (<= 0) of the constant-weight portfolio and of the benchmark. */
  portfolioDd: number[]
  benchmarkDd: number[]
}

/** Paths for the growth chart and the underwater chart. `w` must sum to 1. */
export function growthPaths(panel: ReturnPanel, w: number[]): GrowthPaths {
  const rp = portfolioReturns(panel.returns, w)
  const pw = wealthPath(rp)
  const bw = wealthPath(panel.bench)
  const scale = (x: number[]) => x.map(v => v * 100)
  return {
    dates: [panel.baseDate, ...panel.dates],
    portfolio: scale(pw),
    buyAndHold: scale(buyAndHoldPath(panel.returns, w)),
    benchmark: scale(bw),
    portfolioDd: drawdownFromWealth(pw).drawdown,
    benchmarkDd: drawdownFromWealth(bw).drawdown,
  }
}
