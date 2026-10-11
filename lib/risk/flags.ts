import { FLAGS } from './config'
import type { Metrics } from './analyze'

export interface RiskFlag {
  id: string
  /** Short factual headline. */
  title: string
  /** One line saying why it matters. Describes, never advises. */
  detail: string
  /** Symbols involved, so the UI can highlight them. */
  symbols: string[]
}

type FlagInput = Pick<Metrics, 'holdings' | 'sectors' | 'top3' | 'avgCorrelation' | 'annVol' | 'benchAnnVol' | 'mostCorrelated'>

const pct = (x: number, d = 0) => `${(x * 100).toFixed(d)}%`

/** Plain-language observations. Thresholds live in config.ts (FLAGS). No advice. */
export function computeFlags(m: FlagInput): RiskFlag[] {
  const out: RiskFlag[] = []

  for (const h of m.holdings) {
    if (h.weight > FLAGS.singleHolding) {
      out.push({
        id: `holding-${h.symbol}`,
        title: `${h.symbol} is ${pct(h.weight)} of the portfolio`,
        detail: `One stock above ${pct(FLAGS.singleHolding)} can dominate the results, good or bad.`,
        symbols: [h.symbol],
      })
    }
  }

  // A missing sector says nothing about concentration, so "Unknown" is never flagged.
  const topSector = m.sectors.find(x => x.sector !== 'Unknown')
  if (topSector && m.holdings.length > 1 && topSector.weight > FLAGS.singleSector) {
    out.push({
      id: `sector-${topSector.sector}`,
      title: `${topSector.sector} is ${pct(topSector.weight)} of the portfolio`,
      detail: `Stocks in the same sector tend to rise and fall together, so a sector above ${pct(FLAGS.singleSector)} reduces diversification.`,
      symbols: [],
    })
  }

  if (m.holdings.length > 3 && m.top3 > FLAGS.topThree) {
    const top = [...m.holdings].sort((a, b) => b.weight - a.weight).slice(0, 3)
    out.push({
      id: 'top-three',
      title: `The three largest holdings are ${pct(m.top3)} of the portfolio`,
      detail: `Above ${pct(FLAGS.topThree)} means most of the result depends on three stocks.`,
      symbols: top.map(h => h.symbol),
    })
  }

  if (Number.isFinite(m.avgCorrelation) && m.avgCorrelation > FLAGS.avgCorrelation) {
    out.push({
      id: 'avg-correlation',
      title: `Holdings move closely together (average correlation ${m.avgCorrelation.toFixed(2)})`,
      detail: `Above ${FLAGS.avgCorrelation} means the stocks behave a lot like one position.${m.mostCorrelated ? ` Closest pair: ${m.mostCorrelated.a} and ${m.mostCorrelated.b} (${m.mostCorrelated.corr.toFixed(2)}).` : ''}`,
      symbols: m.mostCorrelated ? [m.mostCorrelated.a, m.mostCorrelated.b] : [],
    })
  }

  for (const h of m.holdings) {
    if (Number.isFinite(h.riskPercent) && h.riskPercent > FLAGS.riskShareFloor && h.riskPercent > FLAGS.riskShareMultiple * h.weight) {
      out.push({
        id: `risk-share-${h.symbol}`,
        title: `${h.symbol} is ${pct(h.weight)} of the money but ${pct(h.riskPercent)} of the risk`,
        detail: `Its share of volatility is more than ${FLAGS.riskShareMultiple}x its weight, because it is volatile and moves with the rest of the portfolio.`,
        symbols: [h.symbol],
      })
    }
  }

  if (m.benchAnnVol > 0 && m.annVol > FLAGS.volVsBenchmark * m.benchAnnVol) {
    out.push({
      id: 'vol-vs-bench',
      title: `Volatility is ${(m.annVol / m.benchAnnVol).toFixed(1)}x SPY's`,
      detail: `Portfolio volatility above ${FLAGS.volVsBenchmark}x the benchmark's means a noticeably bumpier ride than the market.`,
      symbols: [],
    })
  }

  return out
}
