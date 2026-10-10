/// Runs the risk math off the main thread so editing a weight never blocks the page.
import { analyzeHoldings, buildDataset, growthPaths, type Dataset, type PriceFile } from '@/lib/risk'
import type { AnalysisPayload, FromWorker, ToWorker } from './riskMessages'

const ctx = self as unknown as {
  postMessage(msg: FromWorker): void
  onmessage: ((e: MessageEvent<ToWorker>) => void) | null
}

let dates: string[] = []
let benchmark: PriceFile | null = null
const files = new Map<string, PriceFile>()
let dataset: Dataset | null = null

ctx.onmessage = (e: MessageEvent<ToWorker>) => {
  const msg = e.data
  if (msg.type === 'base') {
    dates = msg.dates
    benchmark = msg.benchmark
    dataset = null
  } else if (msg.type === 'files') {
    for (const f of msg.files) files.set(f.symbol, f)
    dataset = null
  } else if (msg.type === 'analyze') {
    try {
      if (!benchmark) throw new Error('Benchmark not loaded yet.')
      if (!dataset) dataset = buildDataset(dates, benchmark, Array.from(files.values()))
      const t0 = performance.now()
      const res = analyzeHoldings(dataset, msg.holdings, msg.opts)
      const m = res.metrics
      const payload: AnalysisPayload = {
        issues: res.issues,
        wasNormalized: res.wasNormalized,
        insufficient: res.insufficient,
        excluded: res.panel?.excluded ?? [],
        droppedDates: res.panel?.droppedDates.length ?? 0,
        windowDays: res.panel?.windowDays ?? 0,
        metrics: m,
        growth: m && res.panel ? growthPaths(res.panel, m.holdings.map(h => h.weight)) : null,
        computeMs: performance.now() - t0,
      }
      ctx.postMessage({ type: 'result', id: msg.id, payload })
    } catch (err) {
      ctx.postMessage({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) })
    }
  }
}
