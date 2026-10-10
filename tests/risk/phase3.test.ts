import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import { computeFlags, FLAGS, rollingAvgCorrelation, rollingVol, shadedPeriods } from '@/lib/risk'

const base = [0.01, -0.02, 0.015, 0.003, -0.007, 0.012, -0.011, 0.004, 0.006, -0.009]

describe('rolling', () => {
  it('rolling vol is NaN until a full window and then matches a direct calculation', () => {
    const v = rollingVol(base, 4)
    expect(v.slice(0, 3).every(Number.isNaN)).toBe(true)
    const w = base.slice(0, 4)
    const m = w.reduce((a, b) => a + b, 0) / 4
    const sd = Math.sqrt(w.reduce((a, b) => a + (b - m) ** 2, 0) / 3)
    expect(v[3]).toBeCloseTo(sd * Math.sqrt(252), 12)
  })
  it('identical assets have rolling correlation 1; opposite assets -1', () => {
    const same = rollingAvgCorrelation([base, base], [0.5, 0.5], 5)
    const opp = rollingAvgCorrelation([base, base.map(x => -x)], [0.5, 0.5], 5)
    same.slice(4).forEach(v => expect(v).toBeCloseTo(1, 10))
    opp.slice(4).forEach(v => expect(v).toBeCloseTo(-1, 10))
  })
  it('is NaN for a single holding and skips flat series instead of inventing a number', () => {
    expect(rollingAvgCorrelation([base], [1], 5).every(Number.isNaN)).toBe(true)
    const withFlat = rollingAvgCorrelation([base, new Array(base.length).fill(0)], [0.5, 0.5], 5)
    expect(withFlat.every(Number.isNaN)).toBe(true)
  })
  it('stays within [-1, 1]', () => {
    const ret = fc.double({ min: -0.1, max: 0.1, noNaN: true, noDefaultInfinity: true })
    fc.assert(
      fc.property(fc.array(fc.array(ret, { minLength: 40, maxLength: 40 }), { minLength: 2, maxLength: 5 }), rows => {
        const w = rows.map(() => 1 / rows.length)
        for (const v of rollingAvgCorrelation(rows, w, 20)) if (!Number.isNaN(v)) expect(Math.abs(v)).toBeLessThanOrEqual(1 + 1e-9)
      }),
      { numRuns: 100 },
    )
  })
})

describe('shadedPeriods', () => {
  it('finds stretches at or below the threshold', () => {
    const dd = [0, -0.05, -0.11, -0.2, -0.1, -0.02, 0, -0.12, -0.13]
    expect(shadedPeriods(dd, -0.1)).toEqual([{ start: 2, end: 4 }, { start: 7, end: 8 }])
    expect(shadedPeriods([0, -0.01], -0.1)).toEqual([])
  })
})

describe('flags', () => {
  const holding = (symbol: string, weight: number, riskPercent: number) => ({ symbol, weight, annVol: 0.3, beta: 1, riskPercent, tailPercent: riskPercent })
  const calm = {
    holdings: [holding('A', 0.25, 0.25), holding('B', 0.25, 0.25), holding('C', 0.25, 0.25), holding('D', 0.25, 0.25)],
    sectors: [{ sector: 'X', weight: 0.25 }],
    top3: 0.75,
    avgCorrelation: 0.3,
    annVol: 0.16,
    benchAnnVol: 0.16,
    mostCorrelated: { a: 'A', b: 'B', corr: 0.5 },
  }
  it('stays quiet at the thresholds (strictly above triggers)', () => {
    const ids = computeFlags({ ...calm, top3: 0.6 }).map(f => f.id)
    expect(ids).not.toContain('top-three')
    expect(ids).not.toContain('holding-A') // 0.25 is not above 0.25
  })
  it('flags a large holding, a risk share above twice the weight, high correlation and high volatility', () => {
    const f = computeFlags({
      ...calm,
      holdings: [holding('A', 0.3, 0.65), holding('B', 0.7, 0.35)],
      sectors: [{ sector: 'Tech', weight: 0.5 }],
      avgCorrelation: 0.7,
      annVol: 0.3,
    })
    const ids = f.map(x => x.id)
    expect(ids).toContain('holding-A')
    expect(ids).toContain('holding-B')
    expect(ids).toContain('risk-share-A')
    expect(ids).not.toContain('risk-share-B')
    expect(ids).toContain('sector-Tech')
    expect(ids).toContain('avg-correlation')
    expect(ids).toContain('vol-vs-bench')
  })
  it('does not flag risk share when the holding is small in absolute terms', () => {
    const f = computeFlags({ ...calm, holdings: [holding('A', 0.05, 0.15), holding('B', 0.95, 0.85)] })
    expect(f.map(x => x.id)).not.toContain('risk-share-A') // 15% is not above 20%
    expect(FLAGS.riskShareFloor).toBe(0.2)
  })
  it('never uses advice wording', () => {
    const f = computeFlags({ ...calm, holdings: [holding('A', 0.9, 0.9), holding('B', 0.1, 0.1)], avgCorrelation: 0.9, annVol: 0.5, sectors: [{ sector: 'T', weight: 0.9 }] })
    for (const x of f) expect(`${x.title} ${x.detail}`).not.toMatch(/should|consider|recommend|buy|sell|reduce your/i)
  })
})
