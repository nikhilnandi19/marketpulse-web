import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import golden from './fixtures/golden.json'
import { checkScenario, SCENARIOS } from '@/lib/risk'

describe('scenario dates against the SPY series', () => {
  for (const s of SCENARIOS) {
    it(`${s.id}: configured dates are within one trading day of SPY's own peak and trough`, () => {
      const c = checkScenario(golden.calendar, golden.benchmark as (number | null)[], s)
      expect(c, JSON.stringify(c)).toMatchObject({ ok: true })
    })
  }
})

const riskDir = path.resolve(__dirname, '../../public/data/risk')
describe.skipIf(!fs.existsSync(path.join(riskDir, 'meta.json')))('exported artifacts', () => {
  const read = (f: string) => JSON.parse(fs.readFileSync(path.join(riskDir, f), 'utf8'))
  it('has a sorted, unique calendar that starts by 2018', () => {
    const cal: string[] = read('calendar.json')
    expect(cal[0] <= '2018-01-02').toBe(true)
    for (let i = 1; i < cal.length; i++) expect(cal[i] > cal[i - 1]).toBe(true)
  })
  it('has benchmark and ticker prices that are positive and fit the calendar', () => {
    const cal: string[] = read('calendar.json')
    const files = ['benchmark.json', ...fs.readdirSync(path.join(riskDir, 'prices')).slice(0, 40).map(f => `prices/${f}`)]
    for (const f of files) {
      const p = read(f)
      expect(p.start + p.prices.length).toBeLessThanOrEqual(cal.length)
      for (const v of p.prices) if (v !== null) expect(v).toBeGreaterThan(0)
    }
  })
})
