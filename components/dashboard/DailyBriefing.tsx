'use client'

import { useMemo } from 'react'
import { TrendingUp, AlertTriangle, Bookmark, BookmarkPlus } from 'lucide-react'
import type { CompanySummary, SectorSummary, SignalSnapshot, SignalPerformanceSummary } from '@/lib/types'
import { formatPercent } from '@/lib/formatters'

interface Props {
  companies?: CompanySummary[]
  sectors?: SectorSummary[]
  signalSnapshots?: SignalSnapshot[]
  signalSummary?: SignalPerformanceSummary[]
  watchedSymbols?: string[]
  onNavigateToExplorer?: (sector?: string, signal?: string) => void
  onNavigateToWatchlist?: () => void
}

// Graphite Obsidian tokens — matches ExecutiveOverview
const S = {
  surface:        'rgba(32, 31, 38, 0.65)',
  surfaceDim:     'rgba(20, 20, 26, 0.7)',
  border:         'rgba(255,255,255,0.10)',
  borderTop:      'rgba(255,255,255,0.20)',
  divider:        'rgba(255,255,255,0.06)',
  primary:        '#c6c0ff',
  bronze:         '#CD7F32',
  positive:       '#b0fbca',
  negative:       '#ffb4ab',
  outline:        '#928f9f',
  textPrimary:    '#e5e1eb',
  textSecondary:  '#c8c4d5',
  textMuted:      '#928f9f',
}

function panelLabel(text: string, color: string) {
  return (
    <span style={{
      fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
      color, letterSpacing: '0.1em', textTransform: 'uppercase' as const,
      display: 'block', marginBottom: 20,
    }}>
      {text}
    </span>
  )
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

  const panelBorder: React.CSSProperties = { borderRight: `1px solid ${S.divider}`, borderBottom: `1px solid ${S.divider}` }
  const panelStyle: React.CSSProperties = { padding: '24px 28px', background: S.surfaceDim }

  return (
    <section style={{ marginBottom: 48 }}>

      {/* Glass card wrapper */}
      <div style={{
        background: S.surface,
        backdropFilter: 'blur(32px)',
        WebkitBackdropFilter: 'blur(32px)',
        border: `1px solid ${S.border}`,
        borderTop: `1px solid ${S.borderTop}`,
        borderLeft: `1px solid ${S.borderTop}`,
        boxShadow: '0 40px 60px -15px rgba(0,0,0,0.5)',
        borderRadius: 16,
        overflow: 'hidden',
      }}>

        {/* Header strip */}
        <div style={{
          padding: '14px 28px', borderBottom: `1px solid ${S.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: S.positive, boxShadow: `0 0 8px ${S.positive}` }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: S.textPrimary, letterSpacing: '-0.01em' }}>
              Today's MarketPulse Briefing
            </span>
          </div>
          <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: S.textMuted, letterSpacing: '0.05em' }}>
            {fmtDate(briefing.marketDate)}
          </span>
        </div>

        {/* 2 × 2 panel grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: S.divider, gap: 1 }}>

          {/* Panel 1 — Market Signal Summary */}
          <div style={{ ...panelStyle }}>
            {panelLabel('Market Signal Summary', S.outline)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { count: briefing.opportunity, label: 'Opportunity', color: S.positive, sig: 'Potential Opportunity' },
                { count: briefing.speculative,  label: 'High Vol',    color: S.bronze,   sig: 'High Volatility Speculative' },
                { count: briefing.stable,       label: 'Stable',      color: S.primary,  sig: 'Stable Watchlist' },
                { count: briefing.review,       label: 'Review',      color: S.outline,  sig: 'Needs Further Review' },
              ].map(({ count, label, color, sig }) => (
                <div key={label}
                  onClick={() => onNavigateToExplorer?.(undefined, sig)}
                  style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.04)', border: `1px solid rgba(255,255,255,0.07)`, borderRadius: 10, cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${color}40` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)' }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{count}</div>
                  <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: S.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Panel 2 — Top Alerts */}
          <div style={{ ...panelStyle }}>
            {panelLabel('Top Alerts', S.outline)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Top upside */}
              {briefing.topOpportunity ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: `${S.positive}0f`, border: `1px solid ${S.positive}25`, borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <TrendingUp size={14} style={{ color: S.positive }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: S.positive, fontFamily: 'JetBrains Mono, monospace' }}>
                        {briefing.topOpportunity.symbol}
                      </div>
                      <div style={{ fontSize: 11, color: S.textMuted }}>Predictive Opportunity</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: S.positive, fontFamily: 'JetBrains Mono, monospace' }}>
                      {formatPercent(briefing.topOpportunity.forecast_30d_upside_pct, 1)}
                    </div>
                    <div style={{ fontSize: 10, color: S.textMuted }}>Forecast Upside</div>
                  </div>
                </div>
              ) : null}

              {/* Highest volatility */}
              {briefing.highestVol ? (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', background: `${S.negative}0f`, border: `1px solid ${S.negative}25`, borderRadius: 10,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertTriangle size={14} style={{ color: S.negative }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: S.negative, fontFamily: 'JetBrains Mono, monospace' }}>
                        {briefing.highestVol.symbol}
                      </div>
                      <div style={{ fontSize: 11, color: S.textMuted }}>Volatility Peak</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: S.negative, fontFamily: 'JetBrains Mono, monospace' }}>
                      {Number.isFinite(briefing.highestVol.annualized_volatility_pct)
                        ? `${briefing.highestVol.annualized_volatility_pct.toFixed(1)}%`
                        : '—'}
                    </div>
                    <div style={{ fontSize: 10, color: S.textMuted }}>Risk Index</div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Panel 3 — Sector Tracker */}
          <div style={{ ...panelStyle }}>
            {panelLabel('Sector Tracker', S.outline)}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {briefing.topSectors.length > 0 ? briefing.topSectors.map((s, i) => {
                const upside = s.avg_forecast_30d_upside_pct
                const barPct = Math.min(100, Math.abs(upside) / maxSectorUpside * 100)
                const barColors = [S.primary, S.bronze, S.outline]
                const color = barColors[i] ?? S.outline
                return (
                  <div key={s.sector}
                    onClick={() => onNavigateToExplorer?.(s.sector, undefined)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
                    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 9999, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${barPct}%`, background: color, borderRadius: 9999, transition: 'width 0.6s ease' }} />
                    </div>
                    <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: S.textSecondary, width: 120, flexShrink: 0, textAlign: 'right' }}>
                      {s.sector.slice(0, 10)}{' '}
                      <span style={{ color: upside >= 0 ? S.positive : S.negative, fontWeight: 600 }}>
                        {upside >= 0 ? '+' : ''}{upside.toFixed(1)}%
                      </span>
                    </span>
                  </div>
                )
              }) : (
                <p style={{ fontSize: 12, color: S.textMuted, margin: 0 }}>
                  {briefing.totalSnapshots > 0
                    ? `Signal tracking: ${briefing.totalSnapshots} signals stored. ${briefing.pendingSnaps > 0 ? `${briefing.pendingSnaps} pending outcomes.` : 'All outcomes complete.'}`
                    : 'No sector data available.'}
                </p>
              )}
            </div>
          </div>

          {/* Panel 4 — Watchlist */}
          <div style={{ ...panelStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            {briefing.watchlistNote ? (
              <>
                {panelLabel('Watchlist', S.outline)}
                <Bookmark size={28} style={{ color: S.primary, marginBottom: 12 }} />
                <div style={{ fontSize: 28, fontWeight: 700, color: S.primary, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 6 }}>
                  {briefing.watchlistNote.count}
                </div>
                <p style={{ fontSize: 13, color: S.textSecondary, lineHeight: 1.5, marginBottom: 16 }}>
                  {briefing.watchlistNote.count === 1 ? 'stock' : 'stocks'} tracked
                  {briefing.watchlistNote.avgUpside !== null && (
                    <> · avg <span style={{ color: briefing.watchlistNote.avgUpside >= 0 ? S.positive : S.negative, fontWeight: 600 }}>
                      {formatPercent(briefing.watchlistNote.avgUpside, 1)}
                    </span> 30D upside</>
                  )}
                  {briefing.watchlistNote.leaderSymbol && (
                    <>, led by <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color: S.textPrimary }}>{briefing.watchlistNote.leaderSymbol}</span></>
                  )}
                </p>
                <button onClick={onNavigateToWatchlist}
                  style={{ border: `1px solid ${S.primary}`, background: 'none', color: S.primary, padding: '8px 20px', borderRadius: 9999, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${S.primary}18` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}>
                  View Watchlist →
                </button>
              </>
            ) : (
              <>
                <BookmarkPlus size={36} style={{ color: S.primary, marginBottom: 14, opacity: 0.8 }} />
                <h3 style={{ fontSize: 17, fontWeight: 600, color: S.textPrimary, letterSpacing: '-0.01em', marginBottom: 8 }}>Build Watchlist</h3>
                <p style={{ fontSize: 13, color: S.textMuted, lineHeight: 1.5, maxWidth: 200, marginBottom: 20 }}>
                  Monitor specific tickers with personalised briefing summaries.
                </p>
                <button onClick={onNavigateToWatchlist}
                  style={{ border: `1px solid ${S.primary}`, background: 'none', color: S.primary, padding: '8px 20px', borderRadius: 9999, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em', fontFamily: 'Inter, sans-serif', transition: 'background 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${S.primary}18` }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none' }}>
                  Configure Symbols
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer disclaimer */}
        <div style={{ padding: '9px 28px', borderTop: `1px solid ${S.border}`, background: 'rgba(255,255,255,0.02)' }}>
          <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: S.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Educational model summary only · Not investment advice
          </span>
        </div>
      </div>
    </section>
  )
}
