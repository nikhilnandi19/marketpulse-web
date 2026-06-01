'use client'

/**
 * DailyBriefing — deterministic daily market summary.
 *
 * All text is generated from CSV data already loaded in the app.
 * No external APIs, no AI calls, no new data fetches.
 *
 * Sections:
 *   A. Latest market date
 *   B. Market-wide signal summary with clickable segment pills
 *   C. Top forecast upside company
 *   D. Highest annualised volatility company
 *   E. Leading sector by avg 30D upside
 *   F. Signal tracker status (from signalSnapshots)
 *   G. Watchlist note (personalised from localStorage symbols)
 */

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import {
  Calendar, TrendingUp, AlertTriangle, Layers, Radio, Bookmark, Globe,
} from 'lucide-react'
import type {
  CompanySummary, SectorSummary,
  SignalSnapshot, SignalPerformanceSummary,
} from '@/lib/types'
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

// Design tokens — matches ExecutiveOverview / Stitch theme exactly
const S = {
  bg:             '#0A0A0B',
  surface:        '#070d1f',
  border:         '#1E293B',
  primary:        '#adc6ff',
  secondary:      '#ddb7ff',
  positive:       '#10B981',
  warning:        '#F59E0B',
  negative:       '#EF4444',
  orange:         '#fb923c',
  textPrimary:    '#FFFFFF',
  textSecondary:  '#94A3B8',
  textBody:       '#c2c6d6',
}

/** Parse a YYYY-MM-DD string without UTC timezone shift. */
function fmtMarketDate(d: string | null): string {
  if (!d) return 'Latest available data'
  try {
    const parts = d.split('-').map(Number)
    if (parts.length < 3 || parts.some(Number.isNaN)) return d
    const [y, m, day] = parts
    return new Date(y, m - 1, day).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    })
  } catch {
    return d
  }
}

/** Sub-heading row for each briefing panel. */
function PanelLabel({ icon, text, color }: { icon: ReactNode; text: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      {icon}
      <span style={{
        fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
        color, letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        {text}
      </span>
    </div>
  )
}

/** Compact signal pill badge. */
function Pill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
      color, background: `${color}18`, border: `1px solid ${color}35`,
      padding: '3px 8px', borderRadius: 3, letterSpacing: '0.04em',
      whiteSpace: 'nowrap',
    }}>
      {label} {count}
    </span>
  )
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

    // ── A. Latest market date ─────────────────────────────────────────────────
    let marketDate: string | null = null
    if (companies.length > 0) {
      const dates = companies.map(c => c.latest_date).filter(Boolean)
      if (dates.length > 0) marketDate = dates.reduce((a, b) => (a > b ? a : b))
    }
    if (!marketDate && signalSnapshots.length > 0) {
      const dates = signalSnapshots.map(s => s.snapshot_date).filter(Boolean)
      if (dates.length > 0) marketDate = dates.reduce((a, b) => (a > b ? a : b))
    }

    // ── B. Signal breakdown ───────────────────────────────────────────────────
    const signalCounts: Record<string, number> = {}
    companies.forEach(c => {
      const sig = c.final_signal || c.forecast_signal || 'Unknown'
      signalCounts[sig] = (signalCounts[sig] || 0) + 1
    })
    const opportunity = signalCounts['Potential Opportunity'] ?? 0
    const stable      = signalCounts['Stable Watchlist'] ?? 0
    const review      = signalCounts['Needs Further Review'] ?? 0
    const weak        = signalCounts['Weak Fundamentals / Negative Forecast'] ?? 0
    const speculative = signalCounts['High Volatility Speculative'] ?? 0

    // ── C. Top forecast upside ────────────────────────────────────────────────
    const topOpportunity: CompanySummary | null = companies
      .filter(c => Number.isFinite(c.forecast_30d_upside_pct))
      .reduce<CompanySummary | null>(
        (best, c) => !best || c.forecast_30d_upside_pct > best.forecast_30d_upside_pct ? c : best,
        null,
      )

    // ── D. Highest annualised volatility ──────────────────────────────────────
    const highestVol: CompanySummary | null = companies
      .filter(c => Number.isFinite(c.annualized_volatility_pct))
      .reduce<CompanySummary | null>(
        (best, c) => !best || c.annualized_volatility_pct > best.annualized_volatility_pct ? c : best,
        null,
      )

    // ── E. Top sector by avg 30D upside ──────────────────────────────────────
    const topSector: SectorSummary | null = sectors
      .filter(s => Number.isFinite(s.avg_forecast_30d_upside_pct))
      .reduce<SectorSummary | null>(
        (best, s) => !best || s.avg_forecast_30d_upside_pct > best.avg_forecast_30d_upside_pct ? s : best,
        null,
      )

    // ── F. Signal tracker ─────────────────────────────────────────────────────
    const totalSnapshots = signalSnapshots.length
    const pendingSnaps   = signalSnapshots.filter(s => (s.outcome_status ?? '').toLowerCase() === 'pending').length
    const completeSnaps  = signalSnapshots.filter(s => (s.outcome_status ?? '').toLowerCase() === 'complete').length
    const has30dOutcomes = signalSnapshots.some(
      s => s.return_30d_pct !== null && Number.isFinite(s.return_30d_pct),
    )

    let hitRate30d: number | null = null
    if (has30dOutcomes && signalSummary.length > 0) {
      let weighted = 0, totalComplete = 0
      signalSummary.forEach(r => {
        const comp = r.complete_count ?? 0
        const rate = r.hit_rate_30d_pct
        if (comp > 0 && rate !== null && Number.isFinite(rate)) {
          weighted += rate * comp
          totalComplete += comp
        }
      })
      if (totalComplete > 0) hitRate30d = weighted / totalComplete
    }

    // ── G. Watchlist ──────────────────────────────────────────────────────────
    const watched = companies.filter(c => watchedSymbols.includes(c.symbol))
    let watchlistNote: {
      count: number
      avgUpside: number | null
      leaderSymbol: string | null
      topSectorName: string | null
    } | null = null

    if (watched.length > 0) {
      const validUp = watched.filter(c => Number.isFinite(c.forecast_30d_upside_pct))
      const avgUpside = validUp.length > 0
        ? validUp.reduce((sum, c) => sum + c.forecast_30d_upside_pct, 0) / validUp.length
        : null
      const leader = validUp.reduce<CompanySummary | null>(
        (best, c) => !best || c.forecast_30d_upside_pct > best.forecast_30d_upside_pct ? c : best,
        null,
      )
      const sectorCount: Record<string, number> = {}
      watched.forEach(c => { if (c.sector) sectorCount[c.sector] = (sectorCount[c.sector] || 0) + 1 })
      const topSectorEntry = Object.entries(sectorCount).sort((a, b) => b[1] - a[1])[0]
      watchlistNote = {
        count:         watched.length,
        avgUpside,
        leaderSymbol:  leader?.symbol ?? null,
        topSectorName: topSectorEntry?.[0] ?? null,
      }
    }

    return {
      marketDate,
      opportunity, stable, review, weak, speculative,
      total: companies.length,
      topOpportunity, highestVol, topSector,
      totalSnapshots, pendingSnaps, completeSnaps, has30dOutcomes, hitRate30d,
      watchlistNote,
    }
  }, [companies, sectors, signalSnapshots, signalSummary, watchedSymbols])

  // Hold off until at least company or snapshot data is present
  if (briefing.total === 0 && briefing.totalSnapshots === 0) return null

  // Shared inline button style (avoids repeating it everywhere)
  const linkBtn = (color: string): React.CSSProperties => ({
    color, background: 'none', border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: 13, padding: 0, fontFamily: 'inherit',
  })

  return (
    <section style={{ marginBottom: 48 }}>
      <div style={{ background: S.bg, border: `1px solid ${S.border}` }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', borderBottom: `1px solid ${S.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Radio size={14} style={{ color: S.positive }} />
            <span style={{
              fontSize: 14, fontWeight: 600, color: S.textPrimary,
              fontFamily: 'Geist, sans-serif', letterSpacing: '-0.01em',
            }}>
              Today's MarketPulse Briefing
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={11} style={{ color: S.textSecondary }} />
            <span style={{
              fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
              color: S.textSecondary, letterSpacing: '0.05em',
            }}>
              {fmtMarketDate(briefing.marketDate)}
            </span>
          </div>
        </div>

        {/* ── 2 × 2 insight grid ─────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>

          {/* Panel 1 — Market Signal ─────────────────────────────────────── */}
          <div style={{
            padding: '18px 24px',
            borderRight: `1px solid ${S.border}`,
            borderBottom: `1px solid ${S.border}`,
          }}>
            <PanelLabel
              icon={<Layers size={11} style={{ color: S.primary }} />}
              text="Market Signal"
              color={S.primary}
            />
            {briefing.total > 0 ? (
              <>
                <p style={{ fontSize: 13, color: S.textBody, lineHeight: 1.65, margin: '0 0 12px' }}>
                  MarketPulse flags{' '}
                  <button
                    onClick={() => onNavigateToExplorer?.(undefined, 'Potential Opportunity')}
                    style={linkBtn(S.positive)}>
                    {briefing.opportunity}{' '}
                    Potential Opportunit{briefing.opportunity === 1 ? 'y' : 'ies'}
                  </button>
                  {briefing.weak > 0 && (
                    <>
                      {' '}and{' '}
                      <button
                        onClick={() => onNavigateToExplorer?.(undefined, 'Weak Fundamentals / Negative Forecast')}
                        style={linkBtn(S.negative)}>
                        {briefing.weak} Weak / Negative Forecast
                      </button>
                    </>
                  )}
                  {' '}across {briefing.total} companies.
                </p>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <Pill label="Opportunity" count={briefing.opportunity} color={S.positive}    />
                  <Pill label="High Vol"    count={briefing.speculative} color={S.warning}     />
                  <Pill label="Stable"      count={briefing.stable}      color={S.primary}     />
                  <Pill label="Review"      count={briefing.review}      color={S.textSecondary}/>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: S.textSecondary }}>Loading signal data…</p>
            )}
          </div>

          {/* Panel 2 — Top Opportunity & Risk Alert ─────────────────────── */}
          <div style={{
            padding: '18px 24px',
            borderBottom: `1px solid ${S.border}`,
          }}>
            <PanelLabel
              icon={<TrendingUp size={11} style={{ color: S.positive }} />}
              text="Top Opportunity & Risk Alert"
              color={S.positive}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>

              {/* Top upside */}
              {briefing.topOpportunity ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: S.textPrimary,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {briefing.topOpportunity.symbol}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: S.positive,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {formatPercent(briefing.topOpportunity.forecast_30d_upside_pct, 1)}
                  </span>
                  <span style={{ fontSize: 11, color: S.textSecondary }}>
                    30D forecast · {briefing.topOpportunity.risk_level}
                  </span>
                  <span style={{ fontSize: 11, color: S.textSecondary, fontStyle: 'italic' }}>
                    {briefing.topOpportunity.company_name}
                  </span>
                </div>
              ) : (
                <span style={{ fontSize: 12, color: S.textSecondary }}>—</span>
              )}

              {/* Highest volatility */}
              {briefing.highestVol && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <AlertTriangle size={11} style={{ color: S.warning, flexShrink: 0 }} />
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: S.textPrimary,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {briefing.highestVol.symbol}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: S.warning,
                    fontFamily: 'JetBrains Mono, monospace',
                  }}>
                    {Number.isFinite(briefing.highestVol.annualized_volatility_pct)
                      ? `${briefing.highestVol.annualized_volatility_pct.toFixed(1)}% vol`
                      : '—'}
                  </span>
                  <span style={{ fontSize: 11, color: S.textSecondary }}>
                    {briefing.highestVol.final_signal}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Panel 3 — Sector & Signal Tracker ──────────────────────────── */}
          <div style={{
            padding: '18px 24px',
            borderRight: `1px solid ${S.border}`,
          }}>
            <PanelLabel
              icon={<Globe size={11} style={{ color: S.secondary }} />}
              text="Sector & Signal Tracker"
              color={S.secondary}
            />

            {briefing.topSector && (
              <p style={{ fontSize: 13, color: S.textBody, lineHeight: 1.65, margin: '0 0 10px' }}>
                <button
                  onClick={() => onNavigateToExplorer?.(briefing.topSector?.sector, undefined)}
                  style={linkBtn(S.secondary)}>
                  {briefing.topSector.sector}
                </button>
                {' '}leads with avg{' '}
                <span style={{
                  color: briefing.topSector.avg_forecast_30d_upside_pct >= 0 ? S.positive : S.negative,
                  fontWeight: 600,
                }}>
                  {formatPercent(briefing.topSector.avg_forecast_30d_upside_pct, 1)}
                </span>
                {' '}30D forecast upside.
              </p>
            )}

            {briefing.totalSnapshots > 0 && (
              <p style={{ fontSize: 12, color: S.textSecondary, lineHeight: 1.5, margin: 0 }}>
                {briefing.has30dOutcomes && briefing.hitRate30d !== null ? (
                  <>
                    30D outcomes available for {briefing.completeSnaps} signals —{' '}
                    <span style={{ color: S.positive, fontWeight: 600 }}>
                      {briefing.hitRate30d.toFixed(0)}% hit rate
                    </span>.
                  </>
                ) : (
                  <>
                    Signal tracking: {briefing.totalSnapshots} signals stored.{' '}
                    {briefing.pendingSnaps > 0
                      ? `${briefing.pendingSnaps} pending 5/10/30-day outcomes.`
                      : 'All outcomes complete.'}
                  </>
                )}
              </p>
            )}
          </div>

          {/* Panel 4 — Watchlist ─────────────────────────────────────────── */}
          <div style={{ padding: '18px 24px' }}>
            <PanelLabel
              icon={<Bookmark size={11} style={{ color: S.orange }} />}
              text="Watchlist"
              color={S.orange}
            />

            {briefing.watchlistNote ? (
              <p style={{ fontSize: 13, color: S.textBody, lineHeight: 1.65, margin: 0 }}>
                Your{' '}
                <button onClick={onNavigateToWatchlist} style={linkBtn(S.orange)}>
                  {briefing.watchlistNote.count}-stock watchlist
                </button>
                {' '}has{' '}
                {briefing.watchlistNote.avgUpside !== null ? (
                  <span style={{
                    color: briefing.watchlistNote.avgUpside >= 0 ? S.positive : S.negative,
                    fontWeight: 600,
                  }}>
                    {formatPercent(briefing.watchlistNote.avgUpside, 1)} avg 30D upside
                  </span>
                ) : (
                  <span>no forecast data</span>
                )}
                {briefing.watchlistNote.leaderSymbol && (
                  <>, led by{' '}
                    <span style={{
                      fontFamily: 'JetBrains Mono, monospace', fontWeight: 700,
                      color: S.textPrimary, fontSize: 12,
                    }}>
                      {briefing.watchlistNote.leaderSymbol}
                    </span>
                  </>
                )}.
                {briefing.watchlistNote.topSectorName && (
                  <> Most exposed to{' '}
                    <span style={{ fontWeight: 600, color: S.textBody }}>
                      {briefing.watchlistNote.topSectorName}
                    </span>.
                  </>
                )}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: S.textSecondary, lineHeight: 1.5, margin: 0 }}>
                <button
                  onClick={onNavigateToWatchlist}
                  style={{ ...linkBtn(S.primary), fontWeight: 500, textDecoration: 'underline' }}>
                  Add companies to your Watchlist
                </button>
                {' '}to get a personalised briefing here.
              </p>
            )}
          </div>
        </div>

        {/* ── Footer disclaimer ───────────────────────────────────────────── */}
        <div style={{
          padding: '8px 24px', borderTop: `1px solid ${S.border}`,
          background: S.surface,
        }}>
          <span style={{
            fontSize: 10, fontFamily: 'JetBrains Mono, monospace',
            color: S.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase',
          }}>
            Educational model summary only · Not investment advice
          </span>
        </div>
      </div>
    </section>
  )
}
