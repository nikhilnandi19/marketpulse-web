'use client'

import { useMemo } from 'react'
import { TrendingUp, AlertTriangle, BookmarkPlus } from 'lucide-react'
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

// Colours come from the Learn tab palette.
const C = {
  positive: '#4edea3',
  negative: '#F87171',
  amber: '#F59E0B',
  blue: '#adc6ff',
  lilac: '#d0bcff',
  grey: '#8c909f',
}

// Same glass recipe as the Learn tab: blur, a 1px inner ring, a lit top edge, a shadow tinted to the page colour.
const GLASS =
  'bg-white/[0.04] backdrop-blur-xl ring-1 ring-inset ring-white/[0.08] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_22px_44px_-28px_rgba(4,8,9,0.95)] ' +
  '[@media(prefers-reduced-transparency:reduce)]:bg-[#1e2020] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#adc6ff]'
const PRESS = 'transition-[transform,background-color,box-shadow,color] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:transform-none'
const MONO = "[font-family:'JetBrains_Mono',monospace]"
const cssVar = (hex: string) => ({ '--c': hex } as React.CSSProperties)

function PanelLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-sm font-medium text-[#8c909f]">{children}</h3>
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
      marketDate,
      total: companies.length,
      topOpportunity, highestVol, topSectors,
      totalSnapshots, pendingSnaps, watchlistNote,
    }
  }, [companies, sectors, signalSnapshots, signalSummary, watchedSymbols])

  if (briefing.total === 0 && briefing.totalSnapshots === 0) return null

  // Normalize sector bar widths
  const maxSectorUpside = Math.max(...briefing.topSectors.map(s => Math.abs(s.avg_forecast_30d_upside_pct)), 0.01)

  const linkBtn = `-ml-1 inline-flex min-h-10 items-center rounded-sm px-1 text-[15px] font-medium text-[#adc6ff] underline decoration-[#adc6ff]/40 underline-offset-4 [@media(hover:hover)]:hover:decoration-[#adc6ff] [@media(pointer:coarse)]:min-h-11 ${PRESS} ${FOCUS}`

  return (
    <section aria-labelledby="ov-briefing" className="mb-12 lg:mb-14">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="ov-briefing" className="text-2xl font-semibold tracking-[-0.03em] text-[#e2e2e2]">Today&apos;s MarketPulse Briefing</h2>
        <span className={`${MONO} text-xs tabular-nums text-[#8c909f]`}>{fmtDate(briefing.marketDate)}</span>
      </div>

      <div className={`rounded-2xl p-6 sm:p-7 ${GLASS}`}>
        <div className="grid gap-x-10 gap-y-9 lg:grid-cols-12">
          {/* Standouts */}
          <div className="min-w-0 lg:col-span-5">
            <PanelLabel>Today&apos;s standouts</PanelLabel>
            <ul className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {briefing.topOpportunity ? (
                <li style={cssVar(C.positive)} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color:color-mix(in_srgb,var(--c)_12%,transparent)] text-[color:var(--c)] ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--c)_22%,transparent)]">
                      <TrendingUp size={18} strokeWidth={1.5} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className={`${MONO} text-lg font-bold text-[#e2e2e2]`}>{briefing.topOpportunity.symbol}</div>
                      <div className="text-sm text-[#8c909f]">Highest 30-day forecast upside</div>
                    </div>
                  </div>
                  <div className={`${MONO} shrink-0 text-xl font-bold tabular-nums text-[color:var(--c)]`}>{formatPercent(briefing.topOpportunity.forecast_30d_upside_pct, 1)}</div>
                </li>
              ) : null}

              {briefing.highestVol ? (
                <li style={cssVar(C.amber)} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex min-w-0 items-center gap-3.5">
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[color:color-mix(in_srgb,var(--c)_12%,transparent)] text-[color:var(--c)] ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--c)_22%,transparent)]">
                      <AlertTriangle size={18} strokeWidth={1.5} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <div className={`${MONO} text-lg font-bold text-[#e2e2e2]`}>{briefing.highestVol.symbol}</div>
                      <div className="text-sm text-[#8c909f]">Highest annualized volatility</div>
                    </div>
                  </div>
                  <div className={`${MONO} shrink-0 text-xl font-bold tabular-nums text-[color:var(--c)]`}>
                    {Number.isFinite(briefing.highestVol.annualized_volatility_pct)
                      ? `${briefing.highestVol.annualized_volatility_pct.toFixed(1)}%`
                      : 'n/a'}
                  </div>
                </li>
              ) : null}
            </ul>
          </div>

          {/* Top sectors */}
          <div className="min-w-0 lg:col-span-4 lg:border-l lg:border-white/[0.08] lg:pl-10">
            <PanelLabel>Top sectors by 30-day forecast upside</PanelLabel>
            <div className="flex flex-col gap-1.5">
              {briefing.topSectors.length > 0 ? briefing.topSectors.map((s, i) => {
                const upside = s.avg_forecast_30d_upside_pct
                const barPct = Math.min(100, Math.abs(upside) / maxSectorUpside * 100)
                const color = [C.blue, C.lilac, C.positive][i] ?? C.grey
                return (
                  <button key={s.sector} type="button" style={cssVar(color)} onClick={() => onNavigateToExplorer?.(s.sector, undefined)}
                    aria-label={`${s.sector}, ${upside >= 0 ? '+' : ''}${upside.toFixed(1)} percent average forecast upside. Open in Explorer`}
                    className={`-mx-2 flex min-h-12 flex-col gap-2 rounded-lg px-2 py-2.5 text-left [@media(hover:hover)]:hover:bg-white/[0.05] ${PRESS} ${FOCUS}`}>
                    <span className="flex items-baseline justify-between gap-3 text-[15px]">
                      <span className="truncate text-[#e2e2e2]">{s.sector}</span>
                      <span className={`${MONO} shrink-0 font-semibold tabular-nums ${upside >= 0 ? 'text-[#4edea3]' : 'text-[#F87171]'}`}>{upside >= 0 ? '+' : ''}{upside.toFixed(1)}%</span>
                    </span>
                    <span className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
                      <span className="block h-full rounded-full bg-[color:var(--c)] transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${barPct}%` }} />
                    </span>
                  </button>
                )
              }) : (
                <p className="m-0 text-sm text-[#8c909f]">
                  {briefing.totalSnapshots > 0
                    ? `Signal tracking: ${briefing.totalSnapshots} signals stored. ${briefing.pendingSnaps > 0 ? `${briefing.pendingSnaps} pending outcomes.` : 'All outcomes complete.'}`
                    : 'No sector data available.'}
                </p>
              )}
            </div>
          </div>

          {/* Saved list */}
          <div className="min-w-0 lg:col-span-3 lg:border-l lg:border-white/[0.08] lg:pl-10">
            {briefing.watchlistNote ? (
              <>
                <PanelLabel>{LIST_NAME}</PanelLabel>
                <div className="mb-2 text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-[#adc6ff]">{briefing.watchlistNote.count}</div>
                <p className="mb-4 text-[15px] leading-normal text-[#c2c6d6]">
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
                <button type="button" onClick={onNavigateToWatchlist} className={linkBtn}>View {LIST_NAME} →</button>
              </>
            ) : (
              <>
                <h3 className="mb-2.5 flex items-center gap-3 text-xl font-semibold tracking-[-0.02em] text-[#e2e2e2]">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#adc6ff]/10 text-[#adc6ff] ring-1 ring-inset ring-[#adc6ff]/20">
                    <BookmarkPlus size={18} strokeWidth={1.5} aria-hidden />
                  </span>
                  Build {LIST_NAME === 'Portfolio' ? 'a Portfolio' : 'Watchlist'}
                </h3>
                <p className="mb-4 max-w-[30ch] text-[15px] leading-normal text-[#8c909f]">Save stocks to see their average forecast here and check how risky they are together.</p>
                <button type="button" onClick={onNavigateToWatchlist} className={linkBtn}>Add stocks →</button>
              </>
            )}
          </div>
        </div>

        <p className={`${MONO} mt-7 border-t border-white/[0.08] pt-4 text-xs text-[#8c909f]`}>Educational model summary only · Not investment advice</p>
      </div>
    </section>
  )
}
