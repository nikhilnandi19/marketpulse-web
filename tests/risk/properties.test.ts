import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  annualCovariance, beta, buyAndHoldPath, corrMatrix, covMatrix, diversificationRatio, drawdownFromReturns, expectedShortfall,
  historicalVaR, normalizeHoldings, portfolioReturns, riskContributions, scenarioReplay, std, tailContributions, wealthPath, type Scenario,
} from '@/lib/risk'

const ret = fc.double({ min: -0.1, max: 0.1, noNaN: true, noDefaultInfinity: true })

/** n assets x T days of returns, plus positive weights. */
const panel = fc
  .record({ n: fc.integer({ min: 2, max: 6 }), T: fc.integer({ min: 30, max: 60 }) })
  .chain(({ n, T }) =>
    fc.tuple(
      fc.array(fc.array(ret, { minLength: T, maxLength: T }), { minLength: n, maxLength: n }),
      fc.array(fc.double({ min: 0.01, max: 1, noNaN: true }), { minLength: n, maxLength: n }),
    ),
  )
  .map(([R, raw]) => {
    const s = raw.reduce((a, b) => a + b, 0)
    return { R, w: raw.map(x => x / s) }
  })

const opts = { numRuns: 150 }

describe('invariants', () => {
  it('risk contributions add up to portfolio volatility, and shares add up to 1', () => {
    fc.assert(
      fc.property(panel, ({ R, w }) => {
        const rc = riskContributions(annualCovariance(R), w)
        fc.pre(rc.vol > 1e-9)
        expect(Math.abs(rc.contribution.reduce((a, b) => a + b, 0) - rc.vol)).toBeLessThan(1e-9)
        expect(Math.abs(rc.percent.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-9)
      }),
      opts,
    )
  })

  it('portfolio volatility from the covariance matrix equals the std of the portfolio series', () => {
    fc.assert(
      fc.property(panel, ({ R, w }) => {
        const rc = riskContributions(annualCovariance(R), w)
        const direct = std(portfolioReturns(R, w)) * Math.sqrt(252)
        expect(Math.abs(rc.vol - direct)).toBeLessThan(1e-9)
      }),
      opts,
    )
  })

  it('tail contributions add up to expected shortfall', () => {
    fc.assert(
      fc.property(panel, fc.constantFrom(0.9, 0.95, 0.99), ({ R, w }, conf) => {
        const rp = portfolioReturns(R, w)
        const tc = tailContributions(R, w, rp, conf)
        expect(Math.abs(tc.contribution.reduce((a, b) => a + b, 0) - tc.es)).toBeLessThan(1e-12)
        expect(Math.abs(tc.es - expectedShortfall(rp, conf))).toBeLessThan(1e-12)
      }),
      opts,
    )
  })

  it('ES is at least VaR and max drawdown is at most zero', () => {
    fc.assert(
      fc.property(panel, fc.constantFrom(0.9, 0.95, 0.99), ({ R, w }, conf) => {
        const rp = portfolioReturns(R, w)
        expect(expectedShortfall(rp, conf)).toBeGreaterThanOrEqual(historicalVaR(rp, conf) - 1e-15)
        expect(drawdownFromReturns(rp).maxDrawdown).toBeLessThanOrEqual(0)
      }),
      opts,
    )
  })

  it('correlations lie in [-1, 1] and the covariance matrix is positive semi-definite', () => {
    fc.assert(
      fc.property(panel, fc.array(fc.double({ min: -1, max: 1, noNaN: true }), { minLength: 6, maxLength: 6 }), ({ R }, xs) => {
        for (const row of corrMatrix(R)) for (const c of row) if (!Number.isNaN(c)) expect(Math.abs(c)).toBeLessThanOrEqual(1)
        const S = covMatrix(R)
        const x = xs.slice(0, R.length)
        let q = 0
        for (let i = 0; i < x.length; i++) for (let j = 0; j < x.length; j++) q += x[i] * S[i][j] * x[j]
        expect(q).toBeGreaterThanOrEqual(-1e-12)
      }),
      opts,
    )
  })

  it('scaling all weights by a constant changes nothing', () => {
    fc.assert(
      fc.property(panel, fc.double({ min: 0.001, max: 1000, noNaN: true }), ({ R, w }, k) => {
        const syms = R.map((_, i) => `S${i}`)
        const a = normalizeHoldings(syms.map((symbol, i) => ({ symbol, weight: w[i] })))
        const b = normalizeHoldings(syms.map((symbol, i) => ({ symbol, weight: w[i] * k })))
        for (let i = 0; i < w.length; i++) expect(Math.abs(a.weights[i] - b.weights[i])).toBeLessThan(1e-12)
      }),
      opts,
    )
  })

  it('diversification ratio is at least 1 for long-only portfolios', () => {
    fc.assert(
      fc.property(panel, ({ R, w }) => {
        const sigma = annualCovariance(R)
        const vol = riskContributions(sigma, w).vol
        fc.pre(vol > 1e-9)
        const vols = R.map(r => std(r) * Math.sqrt(252))
        expect(diversificationRatio(w, vols, vol)).toBeGreaterThanOrEqual(1 - 1e-9)
      }),
      opts,
    )
  })

  it('portfolio beta equals the weighted sum of holding betas', () => {
    fc.assert(
      fc.property(panel, ({ R, w }) => {
        const m = R[0].map((x, t) => x * 0.7 + R[1][t] * 0.3 + 0.001 * Math.cos(t))
        fc.pre(std(m) > 1e-6)
        const bp = beta(portfolioReturns(R, w), m)
        const sum = w.reduce((a, wi, i) => a + wi * beta(R[i], m), 0)
        expect(Math.abs(bp - sum)).toBeLessThan(1e-9)
      }),
      opts,
    )
  })

  it('buy-and-hold with equal single asset matches the wealth path', () => {
    fc.assert(
      fc.property(fc.array(ret, { minLength: 5, maxLength: 40 }), r => {
        const bh = buyAndHoldPath([r], [1])
        const wp = wealthPath(r)
        for (let t = 0; t < wp.length; t++) expect(Math.abs(bh[t] - wp[t])).toBeLessThan(1e-12)
      }),
      opts,
    )
  })

  it('scenario contributions add up to the scenario return', () => {
    const price = fc.array(fc.double({ min: 1, max: 500, noNaN: true }), { minLength: 12, maxLength: 12 })
    fc.assert(
      fc.property(fc.array(price, { minLength: 2, maxLength: 5 }), price, (assets, bench) => {
        const dates = Array.from({ length: 12 }, (_, i) => `2020-02-${String(i + 1).padStart(2, '0')}`)
        const series: Record<string, number[]> = {}
        assets.forEach((p, i) => (series[`S${i}`] = p))
        const syms = Object.keys(series)
        const w = syms.map(() => 1 / syms.length)
        const sc: Scenario = { id: 'x', name: 'x', start: dates[1], end: dates[10], kind: 'drawdown', blurb: '' }
        const r = scenarioReplay({ dates, benchmark: bench, series }, syms, w, sc)
        const total = r.holdings.reduce((a, h) => a + h.contribution, 0)
        expect(Math.abs(total - r.portfolioReturn!)).toBeLessThan(1e-9)
      }),
      opts,
    )
  })
})
