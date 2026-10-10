import type { AnalysisOptions, GrowthPaths, Holding, HoldingIssue, Metrics, PriceFile, ReturnPanel } from '@/lib/risk'

export type ToWorker =
  | { type: 'base'; dates: string[]; benchmark: PriceFile }
  | { type: 'files'; files: PriceFile[] }
  | { type: 'analyze'; id: number; holdings: Holding[]; opts: AnalysisOptions }

export interface AnalysisPayload {
  issues: HoldingIssue[]
  wasNormalized: boolean
  insufficient: { reason: string } | null
  excluded: ReturnPanel['excluded']
  droppedDates: number
  windowDays: number
  metrics: Metrics | null
  growth: GrowthPaths | null
  computeMs: number
}

export type FromWorker =
  | { type: 'result'; id: number; payload: AnalysisPayload }
  | { type: 'error'; id: number; message: string }
