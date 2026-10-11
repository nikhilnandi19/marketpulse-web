import type { Metrics } from './analyze'
import type { ScenarioResult } from './stress'

type Cell = string | number | null | undefined

/** RFC 4180 style: quote cells containing commas, quotes or line breaks. */
export function toCsv(rows: Cell[][]): string {
  const esc = (c: Cell) => {
    if (c === null || c === undefined) return ''
    const s = typeof c === 'number' ? (Number.isFinite(c) ? String(c) : '') : c
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map(r => r.map(esc).join(',')).join('\r\n') + '\r\n'
}

const pct = (x: number) => (Number.isFinite(x) ? Number((x * 100).toFixed(4)) : null)
const num = (x: number, d = 4) => (Number.isFinite(x) ? Number(x.toFixed(d)) : null)

export interface CsvContext {
  windowLabel: string
  confidence: number
  size: number
  methodVersion: string
  pricesThrough: string
  scenarios: ScenarioResult[]
}

/** One file: summary metrics, per-holding table, stress replays. Percent values are in percent. */
export function metricsCsv(m: Metrics, ctx: CsvContext): string {
  const t = ctx.confidence === 0.99 ? m.tail99 : m.tail95
  const lvl = `${Math.round(ctx.confidence * 100)}%`
  const rows: Cell[][] = [
    ['MarketPulse portfolio risk export'],
    ['Educational and historical only. Not financial advice and not a forecast.'],
    ['Method version', ctx.methodVersion],
    ['Prices through', ctx.pricesThrough],
    ['Benchmark', 'SPY (adjusted close, total return)'],
    [],
    ['Metric', 'Value', 'Unit'],
    ['Window', ctx.windowLabel, ''],
    ['Window start', m.startDate, 'date'],
    ['Window end', m.endDate, 'date'],
    ['Trading days used', m.observations, 'days'],
    ['Days skipped (a stock had no price)', m.droppedDates, 'days'],
    ['Share of entered weight included', pct(m.weightCoverage), '%'],
    ['Portfolio size', ctx.size, 'USD'],
    ['Annualized volatility', pct(m.annVol), '%'],
    ['Benchmark annualized volatility', pct(m.benchAnnVol), '%'],
    ['Annualized return (historical, not a forecast)', pct(m.annReturn), '%'],
    ['Benchmark annualized return', pct(m.benchAnnReturn), '%'],
    ['Max drawdown', pct(m.maxDrawdown.maxDrawdown), '%'],
    ['Benchmark max drawdown', pct(m.benchMaxDrawdown), '%'],
    ['Beta vs SPY', num(m.beta), ''],
    ['R squared vs SPY', num(m.rSquared), ''],
    [`1-day historical VaR (${lvl})`, pct(t.var), '% loss'],
    [`1-day historical VaR (${lvl}) in dollars`, Number.isFinite(t.var) ? Number((t.var * ctx.size).toFixed(2)) : null, 'USD loss'],
    [`Expected shortfall (${lvl})`, pct(t.es), '% loss'],
    [`Expected shortfall (${lvl}) in dollars`, Number.isFinite(t.es) ? Number((t.es * ctx.size).toFixed(2)) : null, 'USD loss'],
    [`Normal-model VaR (${lvl}, comparison)`, pct(t.normalVar), '% loss'],
    [`Tail days used (${lvl})`, t.tailCount, 'days'],
    ['Effective holdings', num(m.effectiveHoldings, 2), ''],
    ['Top holding weight', pct(m.top1), '%'],
    ['Top three weight', pct(m.top3), '%'],
    ['Diversification ratio', num(m.diversificationRatio), ''],
    ['Average pairwise correlation', num(m.avgCorrelation), ''],
    [],
    ['Symbol', 'Weight %', 'Annualized volatility %', 'Beta', 'Share of volatility %', 'Share of bad-day losses %'],
    ...m.holdings.map(h => [h.symbol, pct(h.weight), pct(h.annVol), num(h.beta), pct(h.riskPercent), pct(h.tailPercent)]),
    [],
    ['Stress replay', 'Start', 'End', 'Status', 'Coverage %', 'Portfolio return %', 'SPY return %', 'Worst day %', 'Max drawdown %'],
    ...ctx.scenarios.map(s => [
      s.name, s.start, s.end, s.status, pct(s.coverage),
      s.portfolioReturn === undefined ? null : pct(s.portfolioReturn),
      s.benchmarkReturn === undefined ? null : pct(s.benchmarkReturn),
      s.worstDay ? pct(s.worstDay.value) : null,
      s.maxDrawdown === undefined ? null : pct(s.maxDrawdown),
    ]),
  ]
  return toCsv(rows)
}
