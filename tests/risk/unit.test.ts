import { describe, expect, it } from 'vitest'
import {
  analyzeHoldings, avgPairwiseCorrelation, buildReturnPanel, computeMetrics, corr, corrMatrix, annualCovariance,
  diversificationRatio, drawdownFromReturns, effectiveHoldings, expectedShortfall, historicalVaR, inverseVolWeights,
  marketShock, normalizeHoldings, portfolioReturns, quantile, reverseStress, riskContributions, scenarioReplay,
  sectorShock, simpleReturns, std, tailContributions, worstRolling, SCENARIOS, type Scenario,
} from '@/lib/risk'
import { datasetFrom, panelFrom } from './helpers'

const base = [0.01, -0.02, 0.015, 0.003, -0.007, 0.012, -0.011, 0.004]

describe('stats', () => {
  it('uses linear interpolation for quantiles, like numpy', () => {
    const x = Array.from({ length: 101 }, (_, i) => i) // 0..100
    expect(quantile(x, 0.05)).toBe(5) // position 5.0 exactly
    expect(quantile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.05)).toBeCloseTo(1.45, 12) // position 0.45
    expect(quantile([3, 1, 2], 0.5)).toBe(2)
  })
  it('uses n-1 for standard deviation', () => {
    expect(std([1, 2, 3, 4])).toBeCloseTo(Math.sqrt(5 / 3), 12)
  })
  it('returns NaN correlation for a flat series', () => {
    expect(corr([1, 1, 1, 1], [1, 2, 3, 4])).toBeNaN()
  })
})

describe('returns', () => {
  it('computes simple returns', () => {
    const r = simpleReturns([100, 110, 99])
    expect(r[0]).toBeNull()
    expect(r[1]).toBeCloseTo(0.1, 12)
    expect(r[2]).toBeCloseTo(-0.1, 12)
  })
  it('spans a single missing day but not a longer gap', () => {
    const one = simpleReturns([100, null, 110])
    expect(one[1]).toBeNull()
    expect(one[2]).toBeCloseTo(0.1, 12)
    const two = simpleReturns([100, null, null, 110, 121])
    expect(two[3]).toBeNull()
    expect(two[4]).toBeCloseTo(0.1, 12)
  })
  it('excludes a short-history holding and names it', () => {
    const n = 300
    const bench = Array.from({ length: n }, (_, i) => 100 * Math.pow(1.0005, i) * (1 + 0.01 * Math.sin(i)))
    const full = bench.map((p, i) => p * (1 + 0.005 * Math.cos(i)))
    const late = full.map((p, i) => (i < 200 ? null : p))
    const ds = datasetFrom({ FULL: full, LATE: late }, bench)
    const panel = buildReturnPanel(ds, ['FULL', 'LATE', 'MISSING'], { windowDays: 250 })
    expect(panel.symbols).toEqual(['FULL'])
    expect(panel.excluded).toEqual([
      { symbol: 'LATE', days: 99, reason: 'short_history' },
      { symbol: 'MISSING', days: 0, reason: 'no_data' },
    ])
  })
  it('drops dates where one holding has no return and reports them', () => {
    const n = 200
    const bench = Array.from({ length: n }, (_, i) => 100 + i + Math.sin(i))
    const a = bench.map(p => p * 1.1)
    const b: (number | null)[] = bench.map(p => p * 0.9)
    b[100] = null
    b[101] = null // two missing days: first return after the gap is null too
    const ds = datasetFrom({ A: a, B: b }, bench)
    const panel = buildReturnPanel(ds, ['A', 'B'], { windowDays: 150, minObservations: 100 })
    expect(panel.symbols).toEqual(['A', 'B'])
    expect(panel.droppedDates.length).toBe(3) // days 100, 101, 102
    expect(panel.dates.length + panel.droppedDates.length).toBe(150)
  })
})

describe('portfolio and weights', () => {
  it('normalizes weights and reports it', () => {
    const n = normalizeHoldings([{ symbol: 'a', weight: 30 }, { symbol: 'B', weight: 70 }])
    expect(n.symbols).toEqual(['A', 'B'])
    expect(n.weights).toEqual([0.3, 0.7])
    expect(n.wasNormalized).toBe(true)
    expect(normalizeHoldings([{ symbol: 'A', weight: 0.5 }, { symbol: 'B', weight: 0.5 }]).wasNormalized).toBe(false)
  })
  it('rejects duplicates, empty, negative, zero total and more than 30', () => {
    expect(normalizeHoldings([]).issues[0].code).toBe('empty')
    expect(normalizeHoldings([{ symbol: 'A', weight: 1 }, { symbol: 'a', weight: 1 }]).issues[0].code).toBe('duplicate')
    expect(normalizeHoldings([{ symbol: 'A', weight: -1 }]).issues[0].code).toBe('bad_weight')
    expect(normalizeHoldings([{ symbol: 'A', weight: 0 }, { symbol: 'B', weight: 0 }]).issues[0].code).toBe('zero_total')
    const many = Array.from({ length: 31 }, (_, i) => ({ symbol: `T${i}`, weight: 1 }))
    expect(normalizeHoldings(many).issues[0].code).toBe('too_many')
  })
  it('keeps a zero-weight holding in the list with zero weight', () => {
    const n = normalizeHoldings([{ symbol: 'A', weight: 1 }, { symbol: 'B', weight: 0 }])
    expect(n.weights).toEqual([1, 0])
  })
  it('weights inverse volatility', () => {
    const w = inverseVolWeights([0.1, 0.2])
    expect(w[0]).toBeCloseTo(2 / 3, 12)
    expect(w[1]).toBeCloseTo(1 / 3, 12)
  })
})

describe('two-asset closed forms', () => {
  const same = [base, base]
  const opposite = [base, base.map(x => -x)]
  const w = [0.5, 0.5]

  it('correlation +1: portfolio vol equals the average vol and the diversification ratio is 1', () => {
    const sigma = annualCovariance(same)
    const rc = riskContributions(sigma, w)
    const assetVol = Math.sqrt(sigma[0][0])
    expect(rc.vol).toBeCloseTo(assetVol, 12)
    expect(diversificationRatio(w, [assetVol, assetVol], rc.vol)).toBeCloseTo(1, 12)
    expect(rc.percent[0]).toBeCloseTo(0.5, 12)
  })
  it('correlation -1 with equal vol: portfolio vol is zero and shares are undefined, not invented', () => {
    const sigma = annualCovariance(opposite)
    const rc = riskContributions(sigma, w)
    expect(rc.vol).toBeCloseTo(0, 12)
    expect(portfolioReturns(opposite, w).every(x => Math.abs(x) < 1e-15)).toBe(true)
    if (rc.vol === 0) expect(rc.percent[0]).toBeNaN()
  })
  it('a zero-volatility asset has no correlation and contributes no risk', () => {
    const flat = [base, new Array(base.length).fill(0)]
    const sigma = annualCovariance(flat)
    const rc = riskContributions(sigma, [0.6, 0.4])
    expect(rc.contribution[1]).toBeCloseTo(0, 12)
    expect(rc.percent[0]).toBeCloseTo(1, 12)
    expect(avgPairwiseCorrelation(corrMatrix(flat), [0.6, 0.4])).toBeNaN()
  })
  it('a single holding at 100% has all the risk and no average correlation', () => {
    const rc = riskContributions(annualCovariance([base]), [1])
    expect(rc.percent[0]).toBeCloseTo(1, 12)
    expect(avgPairwiseCorrelation(corrMatrix([base]), [1])).toBeNaN()
    expect(effectiveHoldings([1])).toBe(1)
  })
})

describe('drawdown', () => {
  // Wealth path 1, 1.1, 0.99, 1.045, 1.2: peak at 1, trough at 2, recovered at 4.
  const prices = [1, 1.1, 0.99, 1.045, 1.2]
  const r = prices.slice(1).map((p, i) => p / prices[i] - 1)
  it('finds the peak, trough, recovery and days underwater', () => {
    const d = drawdownFromReturns(r)
    expect(d.maxDrawdown).toBeCloseTo(0.99 / 1.1 - 1, 12)
    expect(d.peakIdx).toBe(1)
    expect(d.troughIdx).toBe(2)
    expect(d.recoveryIdx).toBe(4)
    expect(d.daysUnderwater).toBe(3)
  })
  it('reports not recovered', () => {
    const d = drawdownFromReturns([0.1, -0.2, 0.05])
    expect(d.recoveryIdx).toBeNull()
    expect(d.daysUnderwater).toBe(2) // from the peak at index 1 to the last day
  })
  it('counts a fall from day one as a drawdown', () => {
    const d = drawdownFromReturns([-0.1, 0.05])
    expect(d.maxDrawdown).toBeCloseTo(-0.1, 12)
    expect(d.peakIdx).toBe(0)
  })
  it('is zero when wealth only rises', () => {
    const d = drawdownFromReturns([0.01, 0.02])
    expect(d.maxDrawdown).toBe(0)
    expect(d.daysUnderwater).toBe(0)
  })
  it('finds worst rolling periods', () => {
    const w = worstRolling([0.01, -0.05, -0.04, 0.02], 2)!
    expect(w.value).toBeCloseTo(0.95 * 0.96 - 1, 12)
    expect([w.startIdx, w.endIdx]).toEqual([1, 2])
    expect(worstRolling([0.1], 2)).toBeNull()
  })
})

describe('VaR and ES', () => {
  const r = [-0.10, -0.08, -0.06, -0.04, -0.02, 0, 0.01, 0.02, 0.03, 0.04] // 10 days
  it('reads the 5th percentile with interpolation and reports losses as positive', () => {
    // position (10-1)*0.05 = 0.45 between -0.10 and -0.08
    const q = -0.10 + 0.45 * 0.02
    expect(historicalVaR(r, 0.95)).toBeCloseTo(-q, 12)
  })
  it('averages the days at or below the cutoff for ES', () => {
    expect(expectedShortfall(r, 0.95)).toBeCloseTo(0.10, 12) // only the worst day is <= -0.091
    expect(expectedShortfall(r, 0.8)).toBeCloseTo(0.09, 12) // cutoff at -0.0764: -0.10 and -0.08
  })
  it('ES is at least VaR', () => {
    for (const c of [0.9, 0.95, 0.99]) expect(expectedShortfall(r, c)).toBeGreaterThanOrEqual(historicalVaR(r, c))
  })
})

describe('stress', () => {
  const dates = Array.from({ length: 10 }, (_, i) => `2020-01-${String(i + 1).padStart(2, '0')}`)
  const bench = [100, 101, 102, 99, 95, 90, 92, 94, 96, 98]
  const a = [10, 10.5, 11, 10, 9, 8, 8.5, 9, 9.5, 10]
  const b = [null, null, 20, 19, 18, 17, 17.5, 18, 18.5, 19]
  const ds = { dates, benchmark: bench, series: { A: a, B: b } }
  const sc: Scenario = { id: 't', name: 'test', start: '2020-01-03', end: '2020-01-06', kind: 'drawdown', blurb: '' }

  it('sums contributions to the portfolio return', () => {
    const r = scenarioReplay(ds, ['A', 'B'], [0.5, 0.5], sc)
    expect(r.status).toBe('full')
    const A = 8 / 11 - 1
    const B = 17 / 20 - 1
    expect(r.portfolioReturn).toBeCloseTo(0.5 * A + 0.5 * B, 12)
    expect(r.holdings.reduce((s, h) => s + h.contribution, 0)).toBeCloseTo(r.portfolioReturn!, 12)
    expect(r.benchmarkReturn).toBeCloseTo(90 / 102 - 1, 12)
    expect(r.topLosers[0].symbol).toBe('A')
  })
  it('drops holdings with no data at the start, renormalizes, and marks partial coverage', () => {
    const early: Scenario = { ...sc, start: '2020-01-01', end: '2020-01-06' }
    const r = scenarioReplay(ds, ['A', 'B'], [0.3, 0.7], early)
    expect(r.excluded).toEqual(['B'])
    expect(r.coverage).toBeCloseTo(0.3, 12)
    expect(r.status).toBe('partial')
    expect(r.holdings[0].weight).toBeCloseTo(1, 12)
  })
  it('hides a scenario that predates the data', () => {
    const r = scenarioReplay(ds, ['A'], [1], { ...sc, start: '2018-09-20' })
    expect(r.status).toBe('unavailable')
    expect(r.reason).toMatch(/reach back/)
  })
  it('applies market and sector shocks and the reverse stress', () => {
    const m = marketShock(['A', 'B'], [0.5, 0.5], [1.2, 0.8], -0.1)
    expect(m.portfolioBeta).toBeCloseTo(1, 12)
    expect(m.estimatedMove).toBeCloseTo(-0.1, 12)
    const s = sectorShock(['A', 'B'], [0.4, 0.6], { A: 'Tech', B: 'Energy' }, 'Tech', -0.2)
    expect(s.impact).toBeCloseTo(-0.08, 12)
    expect(reverseStress(-0.2, 1.25)).toBeCloseTo(-0.16, 12)
    expect(reverseStress(-0.2, 0)).toBeNull()
    expect(reverseStress(-0.2, -0.3)).toBeNull()
  })
  it('has the five configured scenarios', () => {
    expect(SCENARIOS.map(s => s.id)).toEqual(['q4_2018', 'covid_2020', 'bear_2022', 'tariff_2025', 'worst_day'])
  })
})

describe('analyzeHoldings', () => {
  it('returns issues instead of throwing on bad input', () => {
    const res = analyzeHoldings(datasetFrom({}, [1, 2, 3]), [])
    expect(res.metrics).toBeNull()
    expect(res.issues[0].code).toBe('empty')
  })
  it('says there is not enough history', () => {
    const bench = Array.from({ length: 60 }, (_, i) => 100 + i)
    const res = analyzeHoldings(datasetFrom({ A: bench.map(p => p * 2) }, bench), [{ symbol: 'A', weight: 1 }], { windowDays: 50 })
    expect(res.metrics).toBeNull()
    expect(res.insufficient).not.toBeNull()
  })
  it('computes tail contributions that add up to ES', () => {
    const R = [base, base.map((x, i) => x * 0.5 + 0.002 * (i % 3))]
    const w = [0.6, 0.4]
    const rp = portfolioReturns(R, w)
    const tc = tailContributions(R, w, rp, 0.8)
    expect(tc.contribution.reduce((a, b) => a + b, 0)).toBeCloseTo(tc.es, 12)
    const m = computeMetrics(panelFrom(R), w, 1)
    expect(m.holdings.reduce((a, h) => a + h.riskPercent, 0)).toBeCloseTo(1, 12)
  })
})
