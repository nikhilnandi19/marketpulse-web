import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import golden from './fixtures/golden.json'
import {
  analyzeHoldings, decodeShare, encodeShare, forecastRiskSummary, isShareHash, metricsCsv, reliabilityBand, runScenarios, toCsv,
  MAX_HOLDINGS, type Dataset, type SharedPortfolio,
} from '@/lib/risk'

describe('share link', () => {
  const custom: SharedPortfolio = { holdings: [{ symbol: 'AAPL', weight: 30.5 }, { symbol: 'BRK.B', weight: 20 }, { symbol: 'MSFT', weight: 49.5 }], window: '3Y', confidence: 0.99, size: 250000 }
  it('round-trips custom weights, window, level and size exactly', () => {
    const d = decodeShare('#' + encodeShare(custom))
    expect(d.isShare).toBe(true)
    expect(d.problems).toEqual([])
    expect(d.value).toEqual(custom)
  })
  it('round-trips an equal-weight portfolio without inventing weights', () => {
    const eq: SharedPortfolio = { holdings: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }], window: '2Y', confidence: 0.95, size: 100000 }
    expect(decodeShare('#' + encodeShare(eq)).value).toEqual(eq)
  })
  it('round-trips any valid portfolio (property)', () => {
    const sym = fc.stringMatching(/^[A-Z]{1,5}$/)
    const weight = fc.integer({ min: 1, max: 100000 }).map(n => n / 100)
    fc.assert(
      fc.property(
        fc.uniqueArray(sym, { minLength: 1, maxLength: MAX_HOLDINGS }),
        fc.array(weight, { minLength: MAX_HOLDINGS, maxLength: MAX_HOLDINGS }),
        fc.constantFrom('1Y', '2Y', '3Y', '5Y') as fc.Arbitrary<SharedPortfolio['window']>,
        fc.constantFrom(0.95, 0.99) as fc.Arbitrary<0.95 | 0.99>,
        fc.integer({ min: 1, max: 1e9 }),
        (syms, ws, window, confidence, size) => {
          const holdings = syms.map((symbol, i) => ({ symbol, weight: ws[i] }))
          const p: SharedPortfolio = { holdings, window, confidence, size }
          expect(decodeShare('#' + encodeShare(p)).value).toEqual(p)
        },
      ),
      { numRuns: 100 },
    )
  })
  it('ignores hashes that are not share links', () => {
    expect(isShareHash('#about')).toBe(false)
    expect(decodeShare('').isShare).toBe(false)
    expect(decodeShare('#portfolio').isShare).toBe(false)
  })
  it('fails gracefully on malformed links', () => {
    for (const bad of ['#portfolio?', '#portfolio?h=', '#portfolio?h=%%%', '#portfolio?h=<script>alert(1)</script>', '#portfolio?h=AAPL~abc,MSFT~-5&w=9Z&c=7&s=-1', '#portfolio?h=' + 'A,'.repeat(5)]) {
      expect(() => decodeShare(bad)).not.toThrow()
    }
    const none = decodeShare('#portfolio?h=<script>alert(1)</script>')
    expect(none.value).toBeNull()
    expect(none.problems.length).toBeGreaterThan(0)
  })
  it('skips bad tickers, falls back for bad window, level, size and weights', () => {
    const d = decodeShare('#portfolio?h=AAPL~abc,MSFT,$$$&w=9Z&c=7&s=-1')
    expect(d.value).toEqual({ holdings: [{ symbol: 'AAPL' }, { symbol: 'MSFT' }], window: '2Y', confidence: 0.95, size: 100000 })
    expect(d.problems.length).toBeGreaterThan(0)
  })
  it('caps holdings and rejects zero-total weights', () => {
    const many = '#portfolio?h=' + Array.from({ length: 40 }, (_, i) => `T${i}`).join(',')
    expect(decodeShare(many).value!.holdings.length).toBe(MAX_HOLDINGS)
    expect(decodeShare('#portfolio?h=AAPL~0,MSFT~0').value).toBeNull()
  })
})

describe('csv', () => {
  it('quotes commas, quotes and line breaks and leaves NaN empty', () => {
    expect(toCsv([['a,b', 'say "hi"', 'x\ny', NaN, null, 3]])).toBe('"a,b","say ""hi""","x\ny",,,3\r\n')
  })
  it('exports a full report that parses back to the same key numbers', () => {
    const ds: Dataset = { dates: golden.calendar, benchmark: golden.benchmark as (number | null)[], series: golden.prices as Record<string, (number | null)[]> }
    const holdings = golden.tickers.map((symbol, i) => ({ symbol, weight: golden.cases[0].weights[i] }))
    const m = analyzeHoldings(ds, holdings, { windowDays: 504 }).metrics!
    const csv = metricsCsv(m, { windowLabel: '2 years', confidence: 0.95, size: 100000, methodVersion: '1.0.0', pricesThrough: '2026-10-09', scenarios: runScenarios(ds, holdings) })
    const lines = csv.trim().split('\r\n').map(l => l.split(','))
    const get = (label: string) => lines.find(l => l[0] === label)![1]
    expect(Number(get('Annualized volatility'))).toBeCloseTo(m.annVol * 100, 3)
    expect(Number(get('Max drawdown'))).toBeCloseTo(m.maxDrawdown.maxDrawdown * 100, 3)
    expect(Number(get('1-day historical VaR (95%) in dollars'))).toBeCloseTo(m.tail95.var * 100000, 1)
    expect(lines.filter(l => golden.tickers.includes(l[0])).length).toBe(golden.tickers.length)
    expect(lines.some(l => l[0] === 'COVID crash')).toBe(true)
    expect(csv).toContain('Not financial advice')
  })
})

describe('forecast versus risk', () => {
  it('bands model reliability with the dashboard thresholds', () => {
    expect(reliabilityBand(1.99)).toBe('strong')
    expect(reliabilityBand(2)).toBe('acceptable')
    expect(reliabilityBand(5)).toBe('acceptable')
    expect(reliabilityBand(5.01)).toBe('high_error')
    expect(reliabilityBand(NaN)).toBe('unknown')
    expect(reliabilityBand(0)).toBe('unknown')
  })
  it('puts holdings in quadrants against an equal share of risk and zero forecast', () => {
    const s = forecastRiskSummary([
      { symbol: 'A', weight: 0.5, riskShare: 0.7, forecastUpsidePct: 5, mapePct: 1.5 },
      { symbol: 'B', weight: 0.25, riskShare: 0.2, forecastUpsidePct: -3, mapePct: 3 },
      { symbol: 'C', weight: 0.25, riskShare: 0.1, forecastUpsidePct: 2, mapePct: 6 },
    ])
    expect(s.equalShare).toBeCloseTo(1 / 3, 12)
    expect(s.points.map(p => p.quadrant)).toEqual(['high_risk_up', 'low_risk_down', 'low_risk_up'])
    expect(s.weightedUpsidePct).toBeCloseTo(0.5 * 5 + 0.25 * -3 + 0.25 * 2, 12)
    expect(s.weightedMapePct).toBeCloseTo(0.5 * 1.5 + 0.25 * 3 + 0.25 * 6, 12)
  })
})
