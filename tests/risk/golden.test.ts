import { describe, expect, it } from 'vitest'
import golden from './fixtures/golden.json'
import { analyzeHoldings, scenarioReplay, SCENARIOS, type Dataset } from '@/lib/risk'
import { flat, maxAbsDiff } from './helpers'

const TOL = 1e-8

const ds: Dataset = {
  dates: golden.calendar,
  benchmark: golden.benchmark as (number | null)[],
  series: golden.prices as Record<string, (number | null)[]>,
}

describe.each(golden.cases)('golden: $name', c => {
  const holdings = golden.tickers.map((symbol, i) => ({ symbol, weight: c.weights[i] }))
  const res = analyzeHoldings(ds, holdings, { windowDays: c.window })
  const m = res.metrics!

  it('builds the same window', () => {
    expect(res.metrics).not.toBeNull()
    expect(m.dates).toEqual(c.dates)
    expect(m.baseDate).toBe(c.base_date)
    expect(m.droppedDates).toBe(0)
  })

  it('matches pandas for volatility, return, beta and R squared', () => {
    expect(Math.abs(m.annVol - c.ann_vol)).toBeLessThan(TOL)
    expect(Math.abs(m.annReturn - c.ann_return)).toBeLessThan(TOL)
    expect(Math.abs(m.benchAnnVol - c.bench_ann_vol)).toBeLessThan(TOL)
    expect(Math.abs(m.benchAnnReturn - c.bench_ann_return)).toBeLessThan(TOL)
    expect(Math.abs(m.beta - c.beta)).toBeLessThan(TOL)
    expect(Math.abs(m.rSquared - c.r_squared)).toBeLessThan(TOL)
    expect(maxAbsDiff(m.portfolioReturns, c.port_returns)).toBeLessThan(TOL)
  })

  it('matches pandas for drawdown', () => {
    expect(Math.abs(m.maxDrawdown.maxDrawdown - c.drawdown.max_drawdown)).toBeLessThan(TOL)
    expect(m.maxDrawdown.peakIdx).toBe(c.drawdown.peak_idx)
    expect(m.maxDrawdown.troughIdx).toBe(c.drawdown.trough_idx)
    expect(m.maxDrawdown.recoveryIdx).toBe(c.drawdown.recovery_idx)
    expect(m.maxDrawdown.daysUnderwater).toBe(c.drawdown.days_underwater)
    expect(Math.abs(m.benchMaxDrawdown - c.bench_max_drawdown)).toBeLessThan(TOL)
  })

  it('matches numpy for VaR, ES and normal VaR', () => {
    for (const [mine, ref] of [[m.tail95, c.tail95], [m.tail99, c.tail99]] as const) {
      expect(Math.abs(mine.var - ref.var)).toBeLessThan(TOL)
      expect(Math.abs(mine.es - ref.es)).toBeLessThan(TOL)
      expect(Math.abs(mine.normalVar - ref.normal_var)).toBeLessThan(TOL)
      expect(mine.tailCount).toBe(ref.tail_count)
    }
  })

  it('matches pandas for worst 1, 5 and 20 day returns', () => {
    for (const [mine, ref] of [[m.worstDay, c.worst1], [m.worst5, c.worst5], [m.worst20, c.worst20]] as const) {
      expect(Math.abs(mine!.value - ref.value)).toBeLessThan(TOL)
      expect(mine!.startIdx).toBe(ref.start_idx)
      expect(mine!.endIdx).toBe(ref.end_idx)
    }
  })

  it('matches for concentration, correlation and diversification', () => {
    expect(Math.abs(m.hhi - c.hhi)).toBeLessThan(TOL)
    expect(Math.abs(m.effectiveHoldings - c.effective_holdings)).toBeLessThan(TOL)
    expect(Math.abs(m.top1 - c.top1)).toBeLessThan(TOL)
    expect(Math.abs(m.top3 - c.top3)).toBeLessThan(TOL)
    expect(Math.abs(m.diversificationRatio - c.div_ratio)).toBeLessThan(TOL)
    expect(Math.abs(m.avgCorrelation - c.avg_corr)).toBeLessThan(TOL)
    expect(maxAbsDiff(flat(m.corr), flat(c.corr))).toBeLessThan(TOL)
    expect(m.mostCorrelated!.a).toBe(c.most_corr_pair[0])
    expect(m.mostCorrelated!.b).toBe(c.most_corr_pair[1])
    expect(Math.abs(m.mostCorrelated!.corr - (c.most_corr_pair[2] as number))).toBeLessThan(TOL)
  })

  it('matches for per-holding volatility and beta', () => {
    expect(maxAbsDiff(m.holdings.map(h => h.annVol), c.asset_vol)).toBeLessThan(TOL)
    expect(maxAbsDiff(m.holdings.map(h => h.beta), c.asset_beta)).toBeLessThan(TOL)
  })

  it('matches pandas for rolling volatility and rolling average correlation', () => {
    const cmp = (mine: number[], ref: (number | null)[]) => {
      expect(mine.length).toBe(ref.length)
      mine.forEach((v, i) => {
        if (ref[i] === null) expect(v).toBeNaN()
        else expect(Math.abs(v - (ref[i] as number))).toBeLessThan(TOL)
      })
    }
    cmp(m.rolling.vol21, c.roll_vol21)
    cmp(m.rolling.vol63, c.roll_vol63)
    cmp(m.rolling.benchVol21, c.bench_roll_vol21)
    cmp(m.rolling.benchVol63, c.bench_roll_vol63)
    cmp(m.rolling.avgCorr60, c.roll_avg_corr60)
  })

  it('matches for risk contribution and tail contribution', () => {
    expect(Math.abs(m.riskContribution.vol - c.port_vol)).toBeLessThan(TOL)
    expect(Math.abs(m.annVol - c.port_vol)).toBeLessThan(TOL)
    expect(maxAbsDiff(m.riskContribution.marginal, c.mrc)).toBeLessThan(TOL)
    expect(maxAbsDiff(m.riskContribution.contribution, c.rc)).toBeLessThan(TOL)
    expect(maxAbsDiff(m.riskContribution.percent, c.rc_pct)).toBeLessThan(TOL)
    expect(Math.abs(m.tailContribution.es - c.tail_es)).toBeLessThan(TOL)
    expect(maxAbsDiff(m.tailContribution.contribution, c.tail_contrib)).toBeLessThan(TOL)
  })
})

describe('golden: stress scenarios', () => {
  const w = golden.scenario_weights
  for (const ref of golden.scenarios) {
    it(`${ref.id} matches pandas`, () => {
      const scenario = SCENARIOS.find(s => s.id === ref.id)!
      const r = scenarioReplay(ds, golden.tickers, w, scenario)
      expect(r.status).toBe('full')
      expect(r.coverage).toBeCloseTo(1, 12)
      expect(Math.abs(r.portfolioReturn! - ref.portfolio_return)).toBeLessThan(TOL)
      expect(Math.abs(r.benchmarkReturn! - ref.benchmark_return)).toBeLessThan(TOL)
      expect(maxAbsDiff(r.holdings.map(h => h.ret), ref.asset_returns)).toBeLessThan(TOL)
      expect(maxAbsDiff(r.holdings.map(h => h.contribution), ref.contributions)).toBeLessThan(TOL)
      expect(Math.abs(r.worstDay!.value - ref.worst_day)).toBeLessThan(TOL)
      expect(r.worstDay!.date).toBe(ref.worst_day_date)
      expect(Math.abs(r.maxDrawdown! - ref.max_drawdown)).toBeLessThan(TOL)
      const total = r.holdings.reduce((a, h) => a + h.contribution, 0)
      expect(Math.abs(total - r.portfolioReturn!)).toBeLessThan(1e-12)
    })
  }
})
