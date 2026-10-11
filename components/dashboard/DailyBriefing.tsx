'use client'

import { useMemo } from 'react'
import { TrendingUp, AlertTriangle, Bookmark, BookmarkPlus } from 'lucide-react'
import type { CompanySummary, SectorSummary, SignalSnapshot, SignalPerformanceSummary } from '@/lib/types'
import { formatPercent } from '@/lib/formatters'
import { LIST_NAME } from '@/lib/riskLab'

interface Props {
  companies?: CompanySummary[]
  sectors?: SectorSummary[]
  signalSnapshots?: SignalSnapshot[]
  signalSummary?: SignalPerformanceSummary[]
  watchedSymbols?: string[]
  onNavigateToExplorer?: (sector?: string, signal?: string) => void
  onNavigateToWatchlist?: () => void
}

// Colours come from the Learn tab palette. A signal keeps one colour everywhere on the Overview.
const C = {
  positive: '#4edea3',
  negative: '#F87171',
  amber: '#F59E0B',
  blue: '#adc6ff',
  lilac: '#d0bcff',
  grey: '#8c909f',
}

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#adc6ff]'
const PRESS = 'transition-[transform,background-color,box-shadow,color] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:transform-none'
const HOVER_ROW = '[@media(hover:hover)]:hover:bg-white/[0.06] [@media(hover:hover)]:hover:ring-white/[0.16]'
const MONO = "[font-family:'JetBrains_Mono',monospace]"
const cssVar = (hex: string) => ({ '--c': hex } as React.CSSProperties)

function PanelLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-5 text-xs font-medium text-[#8c909f]">{children}</h3>
}

/** Parse YYYY-MM-DD without UTC shift */
function fmtDate(d: string | null): string {
  if (!d) return 'Latest available data'
  try {
    const [y, m, day] = d.split('-').map(Number)
    return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch { return d }
}

export default function DailyBriefing({
  companies = [],
  sectors = [],
  signalSnapshots = [],
  signalSummary = [],
  watchedSymbols = [],
  onNavigateToExplorer,
  onNavigateToWatchlist,
}: Props) {

  const briefing = useMemo(() => {
    // Latest market date
    let marketDate: string | null = null
    if (companies.length > 0) {
      const dates = companies.map(c => c.latest_date).filter(Boolean)
      if (dates.length) marketDate = dates.reduce((a, b) => (a > b ? a : b))
    }
    if (!marketDate && signalSnapshots.length > 0) {
      const dates = signalSnapshots.map(s => s.snapshot_date).filter(Boolean)
      if (dates.length) marketDate = dates.reduce((a, b) => (a > b ? a : b))
    }

    // Signal counts
    const signalCounts: Record<string, number> = {}
    companies.forEach(c => {
      const sig = c.final_signal || c.forecast_signal || 'Unknown'
      signalCounts[sig] = (signalCounts[sig] || 0) + 1
    })
    const opportunity = signalCounts['Potential Opportunity'] ?? 0
    const stable      = signalCounts['Stable Watchlist'] ?? 0
    const review      = signalCounts['Needs Further Review'] ?? 0
    const speculative = signalCounts['High Volatility Speculative'] ?? 0

    // Top forecast upside
    const topOpportunity = companies
      .filter(c => Number.isFinite(c.forecast_30d_upside_pct))
      .reduce<CompanySummary | null>((best, c) => !best || c.forecast_30d_upside_pct > best.forecast_30d_upside_pct ? c : best, null)

    // Highest volatility
    const highestVol = companies
      .filter(c => Number.isFinite(c.annualized_volatility_pct))
      .reduce<CompanySummary | null>((best, c) => !best || c.annualized_volatility_pct > best.annualized_volatility_pct ? c : best, null)

    // Top 3 sectors by avg 30D upside
    const topSectors = [...sectors]
      .filter(s => Number.isFinite(s.avg_forecast_30d_upside_pct))
      .sort((a, b) => b.avg_forecast_30d_upside_pct - a.avg_forecast_30d_upside_pct)
      .slice(0, 3)

    // Signal tracker
    const totalSnapshots = signalSnapshots.length
    const pendingSnaps   = signalSnapshots.filter(s => (s.outcome_status ?? '').toLowerCase() === 'pending').length

    // Watchlist note
    const watched = companies.filter(c => watchedSymbols.includes(c.symbol))
    let watchlistNote: { count: number; avgUpside: number | null; leaderSymbol: string | null } | null = null
    if (watched.length > 0) {
      const validUp = watched.filter(c => Number.isFinite(c.forecast_30d_upside_pct))
      const avgUpside = validUp.length > 0 ? validUp.reduce((s, c) => s + c.forecast_30d_upside_pct, 0) / validUp.length : null
      const leader = validUp.reduce<CompanySummary | null>((best, c) => !best || c.forecast_30d_upside_pct > best.forecast_30d_upside_pct ? c : best, null)
      watchlistNote = { count: watched.length, avgUpside, leaderSymbol: leader?.symbol ?? null }
    }

    return {
      marketDate, opportunity, stable, review, speculative,
      total: companies.length,
      topOpportunity, highestVol, topSectors,
      totalSnapshots, pendingSnaps, watchlistNote,
    }
  }, [companies, sectors, signalSnapshots, signalSummary, watchedSymbols])

  if (briefing.total === 0 && briefing.totalSnapshots === 0) return null

  // Normalize sector bar widths
  const maxSectorUpside = Math.max(...briefing.topSectors.map(s => Math.abs(s.avg_forecast_30d_upside_pct)), 0.01)

  const panel = 'bg-[#151718] px-7 py-6'
  const outlineBtn = `rounded-full px-5 py-2 text-xs font-semibold text-[#adc6ff] ring-1 ring-inset ring-[#adc6ff]/70 [@media(hover:hover)]:hover:bg-[#adc6ff]/10 ${PRESS} ${FOCUS}`

  return (
    <section aria-labelledby="ov-briefing" className="mb-12">
      <div className="overflow-hidden rounded-2xl bg-white/[0.025] ring-1 ring-inset ring-white/[0.08]">

        {/* Header strip */}
        <div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.02] px-7 py-3.5">
          <div className="flex items-center gap-2.5">
            <span aria-hidden className="size-2 rounded-full bg-[#4edea3]" />
            <h2 id="ov-briefing" className="text-sm font-semibold tracking-[-0.01em] text-[#e2e2e2]">Today&apos;s MarketPulse Briefing</h2>
          </div>
          <span className={`${MONO} text-[11px] tabular-nums text-[#8c909f]`}>{fmtDate(briefing.marketDate)}</span>
        </div>

        {/* 2 × 2 panel grid */}
        <div className="grid grid-cols-2 gap-px bg-white/[0.06]">

          {/* Panel 1: signal summary */}
          <div className={panel}>
            <PanelLabel>Market signal summary</PanelLabel>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { count: briefing.opportunity, label: 'Opportunity', color: C.positive, sig: 'Potential Opportunity' },
                { count: briefing.speculative, label: 'High vol',    color: C.amber,    sig: 'High Volatility Speculative' },
                { count: briefing.stable,      label: 'Stable',      color: C.blue,     sig: 'Stable Watchlist' },
                { count: briefing.review,      label: 'Review',      color: C.grey,     sig: 'Needs Further Review' },
              ].map(({ count, label, color, sig }) => (
                <button key={label} type="button" style={cssVar(color)} onClick={() => onNavigateToExplorer?.(undefined, sig)}
                  aria-label={`${count} companies, ${label}. Open in Explorer`}
                  className={`rounded-lg bg-white/[0.035] px-4 py-3.5 text-left ring-1 ring-inset ring-white/[0.07] ${HOVER_ROW} ${PRESS} ${FOCUS}`}>
                  <div className="text-3xl font-semibold leading-none tracking-[-0.02em] tabular-nums text-[color:var(--c)]">{count}</div>
                  <div className="mt-1.5 text-[11px] text-[#8c909f]">{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Panel 2: top alerts */}
          <div className={panel}>
            <PanelLabel>Top alerts</PanelLabel>
            <div className="flex flex-col gap-2.5">
              {briefing.topOpportunity ? (
                <div style={cssVar(C.positive)} className="flex items-center justify-between rounded-lg bg-[color:color-mix(in_srgb,var(--c)_6%,transparent)] px-4 py-3 ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--c)_18%,transparent)]">
                  <div className="flex items-center gap-2.5">
                    <TrendingUp size={14} strokeWidth={1.5} className="text-[color:var(--c)]" aria-hidden />
                    <div>
                      <div className={`${MONO} text-[15px] font-bold text-[color:var(--c)]`}>{briefing.topOpportunity.symbol}</div>
                      <div className="text-[11px] text-[#8c909f]">Predictive Opportunity</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`${MONO} text-[16px] font-bold tabular-nums text-[color:var(--c)]`}>{formatPercent(briefing.topOpportunity.forecast_30d_upside_pct, 1)}</div>
                    <div className="text-[10px] text-[#8c909f]">Forecast Upside</div>
                  </div>
                </div>
              ) : null}

              {briefing.highestVol ? (
                <div style={cssVar(C.negative)} className="flex items-center justify-between rounded-lg bg-[color:color-mix(in_srgb,var(--c)_6%,transparent)] px-4 py-3 ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--c)_18%,transparent)]">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle size={14} strokeWidth={1.5} className="text-[color:var(--c)]" aria-hidden />
                    <div>
                      <div className={`${MONO} text-[15px] font-bold text-[color:var(--c)]`}>{briefing.highestVol.symbol}</div>
                      <div className="text-[11px] text-[#8c909f]">Volatility Peak</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`${MONO} text-[16px] font-bold tabular-nums text-[color:var(--c)]`}>
                      {Number.isFinite(briefing.highestVol.annualized_volatility_pct)
                        ? `${briefing.highestVol.annualized_volatility_pct.toFixed(1)}%`
                        : 'n/a'}
                    </div>
                    <div className="text-[10px] text-[#8c909f]">Risk Index</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Panel 3: sector tracker */}
          <div className={panel}>
            <PanelLabel>Sector tracker</PanelLabel>
            <div className="flex flex-col gap-3.5">
              {briefing.topSectors.length > 0 ? briefing.topSectors.map((s, i) => {
                const upside = s.avg_forecast_30d_upside_pct
                const barPct = Math.min(100, Math.abs(upside) / maxSectorUpside * 100)
                const color = [C.blue, C.amber, C.grey][i] ?? C.grey
                return (
                  <button key={s.sector} type="button" style={cssVar(color)} onClick={() => onNavigateToExplorer?.(s.sector, undefined)}
                    aria-label={`${s.sector}, ${upside >= 0 ? '+' : ''}${upside.toFixed(1)} percent average forecast upside. Open in Explorer`}
                    className={`flex items-center gap-3.5 rounded-md py-1 text-left [@media(hover:hover)]:hover:bg-white/[0.04] ${PRESS} ${FOCUS}`}>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <span className="block h-full rounded-full bg-[color:var(--c)] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${barPct}%` }} />
                    </span>
                    <span className={`${MONO} w-[120px] shrink-0 text-right text-xs text-[#c2c6d6]`}>
                      {s.sector.slice(0, 10)}{' '}
                      <span className={`font-semibold tabular-nums ${upside >= 0 ? 'text-[#4edea3]' : 'text-[#F87171]'}`}>
                        {upside >= 0 ? '+' : ''}{upside.toFixed(1)}%
                      </span>
                    </span>
                  </button>
                )
              }) : (
                <p className="m-0 text-xs text-[#8c909f]">
                  {briefing.totalSnapshots > 0
                    ? `Signal tracking: ${briefing.totalSnapshots} signals stored. ${briefing.pendingSnaps > 0 ? `${briefing.pendingSnaps} pending outcomes.` : 'All outcomes complete.'}`
                    : 'No sector data available.'}
                </p>
              )}
            </div>
          </div>

          {/* Panel 4: saved list */}
          <div className={`${panel} flex flex-col items-center justify-center text-center`}>
            {briefing.watchlistNote ? (
              <>
                <PanelLabel>{LIST_NAME}</PanelLabel>
                <Bookmark size={26} strokeWidth={1.5} className="mb-3 text-[#adc6ff]" aria-hidden />
                <div className="mb-1.5 text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[#adc6ff]">{briefing.watchlistNote.count}</div>
                <p className="mb-4 text-[13px] leading-normal text-[#c2c6d6]">
                  {briefing.watchlistNote.count === 1 ? 'stock' : 'stocks'} tracked
                  {briefing.watchlistNote.avgUpside !== null && (
                    <> · avg <span className={`font-semibold tabular-nums ${briefing.watchlistNote.avgUpside >= 0 ? 'text-[#4edea3]' : 'text-[#F87171]'}`}>
                      {formatPercent(briefing.watchlistNote.avgUpside, 1)}
                    </span> 30D upside</>
                  )}
                  {briefing.watchlistNote.leaderSymbol && (
                    <>, led by <span className={`${MONO} font-bold text-[#e2e2e2]`}>{briefing.watchlistNote.leaderSymbol}</span></>
                  )}
                </p>
                <button type="button" onClick={onNavigateToWatchlist} className={outlineBtn}>View {LIST_NAME} →</button>
              </>
            ) : (
              <>
                <BookmarkPlus size={32} strokeWidth={1.5} className="mb-3.5 text-[#adc6ff]/80" aria-hidden />
                <h3 className="mb-2 text-[17px] font-semibold tracking-[-0.01em] text-[#e2e2e2]">Build {LIST_NAME === 'Portfolio' ? 'a Portfolio' : 'Watchlist'}</h3>
                <p className="mb-5 max-w-[200px] text-[13px] leading-normal text-[#8c909f]">Monitor specific tickers with personalised briefing summaries.</p>
                <button type="button" onClick={onNavigateToWatchlist} className={outlineBtn}>Configure Symbols</button>
              </>
            )}
          </div>
        </div>

        {/* Footer disclaimer */}
        <div className="border-t border-white/[0.08] bg-white/[0.02] px-7 py-2.5">
          <span className={`${MONO} text-[10px] text-[#8c909f]`}>Educational model summary only · Not investment advice</span>
        </div>
      </div>
    </section>
  )
}
