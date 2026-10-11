import { MIN_OBSERVATIONS, TRADING_DAYS, WINDOWS, type WindowKey } from './config'
import { annualCovariance, riskContributions, tailContributions, type RiskContribution, type TailContribution } from './contribution'
import { avgPairwiseCorrelation, diversificationRatio, effectiveHoldings, hhi, mostCorrelatedPair, sectorWeights, topWeight } from './concentration'
import { drawdownFromReturns, worstRolling } from './drawdown'
import { rollingAvgCorrelation, rollingVol } from './rolling'
import { normalizeHoldings, portfolioReturns, renormalize } from './portfolio'
import { buildReturnPanel } from './returns'
import { beta, corr, corrMatrix, std } from './stats'
import { tailStats } from './varES'
import type { Dataset, DrawdownResult, Holding, HoldingIssue, ReturnPanel, TailStats, WorstPeriod } from './types'

export interface HoldingMetrics {
  symbol: string
  /** Weight inside the window after dropped holdings are removed and the rest renormalized. */
  weight: number
  annVol: number
  beta: number
  riskPercent: number
  /** Share of expected shortfall from this holding (sums to 1). */
  tailPercent: number
}

export interface Metrics {
  symbols: string[]
  startDate: string
  endDate: string
  baseDate: string
  observations: number
  droppedDates: number
  /** Share of the entered weight that is inside the risk numbers. */
  weightCoverage: number
  annVol: number
  annReturn: number
  benchAnnVol: number
  benchAnnReturn: number
  maxDrawdown: DrawdownResult
  benchMaxDrawdown: number
  beta: number
  rSquared: number
  tail95: TailStats
  tail99: TailStats
  worstDay: (WorstPeriod & { startDate: string; endDate: string }) | null
  worst5: (WorstPeriod & { startDate: string; endDate: string }) | null
  worst20: (WorstPeriod & { startDate: string; endDate: string }) | null
  hhi: number
  effectiveHoldings: number
  top1: number
  top3: number
  sectors: { sector: string; weight: number }[]
  diversificationRatio: number
  avgCorrelation: number
  mostCorrelated: { a: string; b: string; corr: number } | null
  corr: number[][]
  riskContribution: RiskContribution
  tailContribution: TailContribution
  holdings: HoldingMetrics[]
  /** Rolling series aligned to `dates`; NaN until a full window exists. */
  rolling: { vol21: number[]; vol63: number[]; benchVol21: number[]; benchVol63: number[]; avgCorr60: number[] }
  /** Daily portfolio and benchmark returns for charts. */
  portfolioReturns: number[]
  benchReturns: number[]
  dates: string[]
}

export interface AnalysisOptions {
  windowDays?: number
  window?: WindowKey
  /** Confidence used for the tail contribution split. */
  confidence?: number
  sectorOf?: Record<string, string>
}

export interface AnalysisResult {
  issues: HoldingIssue[]
  wasNormalized: boolean
  panel: ReturnPanel | null
  /** Set when there is not enough usable history to report anything. */
  insufficient: { reason: string } | null
  metrics: Metrics | null
}

function annualize(r: number[]): number {
  let g = 1
  for (const x of r) g *= 1 + x
  return Math.pow(g, TRADING_DAYS / r.length) - 1
}

function withDates(w: WorstPeriod | null, dates: string[]): (WorstPeriod & { startDate: string; endDate: string }) | null {
  if (!w) return null
  return { ...w, startDate: dates[w.startIdx], endDate: dates[w.endIdx] }
}

/** Compute every portfolio metric from an aligned panel and normalized weights (sum to 1). */
export function computeMetrics(panel: ReturnPanel, w: number[], weightCoverage: number, opts: AnalysisOptions = {}): Metrics {
  const rp = portfolioReturns(panel.returns, w)
  const sigma = annualCovariance(panel.returns)
  const rc = riskContributions(sigma, w)
  const conf = opts.confidence ?? 0.95
  const tc = tailContributions(panel.returns, w, rp, conf)
  const corrM = corrMatrix(panel.returns)
  const assetVols = panel.returns.map(r => std(r) * Math.sqrt(TRADING_DAYS))
  const b = beta(rp, panel.bench)
  const c = corr(rp, panel.bench)
  const dd = drawdownFromReturns(rp)
  const sectorOf = opts.sectorOf ?? {}

  return {
    symbols: panel.symbols,
    startDate: panel.dates[0],
    endDate: panel.dates[panel.dates.length - 1],
    baseDate: panel.baseDate,
    observations: rp.length,
    droppedDates: panel.droppedDates.length,
    weightCoverage,
    annVol: std(rp) * Math.sqrt(TRADING_DAYS),
    annReturn: annualize(rp),
    benchAnnVol: std(panel.bench) * Math.sqrt(TRADING_DAYS),
    benchAnnReturn: annualize(panel.bench),
    maxDrawdown: dd,
    benchMaxDrawdown: drawdownFromReturns(panel.bench).maxDrawdown,
    beta: b,
    rSquared: c * c,
    tail95: tailStats(rp, 0.95),
    tail99: tailStats(rp, 0.99),
    worstDay: withDates(worstRolling(rp, 1), panel.dates),
    worst5: withDates(worstRolling(rp, 5), panel.dates),
    worst20: withDates(worstRolling(rp, 20), panel.dates),
    hhi: hhi(w),
    effectiveHoldings: effectiveHoldings(w),
    top1: topWeight(w, 1),
    top3: topWeight(w, 3),
    sectors: sectorWeights(panel.symbols, w, sectorOf),
    diversificationRatio: diversificationRatio(w, assetVols, rc.vol),
    avgCorrelation: avgPairwiseCorrelation(corrM, w),
    mostCorrelated: mostCorrelatedPair(corrM, panel.symbols),
    corr: corrM,
    riskContribution: rc,
    tailContribution: tc,
    holdings: panel.symbols.map((symbol, i) => ({
      symbol,
      weight: w[i],
      annVol: assetVols[i],
      beta: beta(panel.returns[i], panel.bench),
      riskPercent: rc.percent[i],
      tailPercent: tc.es > 0 ? tc.contribution[i] / tc.es : NaN,
    })),
    rolling: {
      vol21: rollingVol(rp, 21),
      vol63: rollingVol(rp, 63),
      benchVol21: rollingVol(panel.bench, 21),
      benchVol63: rollingVol(panel.bench, 63),
      avgCorr60: rollingAvgCorrelation(panel.returns, w, 60),
    },
    portfolioReturns: rp,
    benchReturns: panel.bench,
    dates: panel.dates,
  }
}

/** Full pipeline: validate holdings, build the window, drop short histories, compute metrics. */
export function analyzeHoldings(ds: Dataset, holdings: Holding[], opts: AnalysisOptions = {}): AnalysisResult {
  const norm = normalizeHoldings(holdings)
  if (norm.issues.length > 0) {
    return { issues: norm.issues, wasNormalized: false, panel: null, insufficient: { reason: norm.issues[0].message }, metrics: null }
  }
  const windowDays = opts.windowDays ?? WINDOWS[opts.window ?? '2Y']
  const panel = buildReturnPanel(ds, norm.symbols, { windowDays })
  if (panel.symbols.length === 0) {
    return { issues: [], wasNormalized: norm.wasNormalized, panel, insufficient: { reason: 'None of the holdings have enough price history for this window.' }, metrics: null }
  }
  if (panel.dates.length < MIN_OBSERVATIONS) {
    return { issues: [], wasNormalized: norm.wasNormalized, panel, insufficient: { reason: `Not enough history: ${panel.dates.length} usable days, ${MIN_OBSERVATIONS} needed.` }, metrics: null }
  }
  const keptIdx = panel.symbols.map(s => norm.symbols.indexOf(s))
  const keptRaw = keptIdx.map(i => norm.weights[i])
  const weightCoverage = keptRaw.reduce((a, b) => a + b, 0)
  const w = renormalize(keptRaw)
  return { issues: [], wasNormalized: norm.wasNormalized, panel, insufficient: null, metrics: computeMetrics(panel, w, weightCoverage, opts) }
}
