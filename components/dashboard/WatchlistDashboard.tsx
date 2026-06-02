'use client'

import { useMemo, useState } from 'react'
import { GitBranch, Bot, Bookmark, BookmarkX, ArrowRight, Share2, Trash2 } from 'lucide-react'
import type { CompanySummary } from '@/lib/types'
import { formatCurrency, formatPercent, getSignalColor, getRiskColor } from '@/lib/formatters'

interface Props {
  companies: CompanySummary[]
  watchedSymbols: string[]
  onToggleWatchlist: (symbol: string) => void
  onViewForecast: (c: CompanySummary) => void
  onViewAI: (c: CompanySummary) => void
  onNavigateToExplorer: () => void
}

// ── Graphite Obsidian tokens ────────────────────────────────────────────────
const S = {
  surface:        'rgba(32, 31, 38, 0.65)',
  surfaceSolid:   '#201f26',
  surfaceDim:     'rgba(20, 19, 26, 0.75)',
  border:         'rgba(255,255,255,0.10)',
  borderTop:      'rgba(255,255,255,0.20)',
  divider:        'rgba(255,255,255,0.05)',
  primary:        '#c6c0ff',
  bronze:         '#CD7F32',
  positive:       '#b0fbca',
  negative:       '#ffb4ab',
  warning:        '#fabc42',
  outline:        '#928f9f',
  textPrimary:    '#e5e1eb',
  textSecondary:  '#c8c4d5',
  textMuted:      '#928f9f',
  mono:           'JetBrains Mono, monospace',
  body:           'Inter, sans-serif',
}

function glass(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background:           S.surface,
    backdropFilter:       'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border:               `1px solid ${S.border}`,
    borderTop:            `1px solid ${S.borderTop}`,
    borderLeft:           `1px solid ${S.borderTop}`,
    boxShadow:            '0 40px 60px -15px rgba(0,0,0,0.5)',
    borderRadius:         16,
    ...extra,
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────
const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
const pctColor = (v: number | null | undefined) => v == null ? S.textMuted : v >= 0 ? S.positive : S.negative

const riskBucket = (r: string) => {
  const v = (r ?? '').trim().toLowerCase()
  if (v === 'low risk' || v === 'lower risk')       return 'low'
  if (v === 'medium risk' || v === 'moderate risk') return 'mod'
  if (v === 'high risk')                            return 'high'
  return 'unknown'
}

const signalShort: Record<string, string> = {
  'Potential Opportunity':                 'OPPORTUNITY',
  'Stable Watchlist':                      'STABLE',
  'High Volatility Speculative':           'HIGH VOL',
  'Needs Further Review':                  'REVIEW',
  'Weak Fundamentals / Negative Forecast': 'RISK WARN',
}

const SECTOR_COLORS = [S.primary, S.bronze, S.warning, S.positive, S.outline]

// ── Risk badge ───────────────────────────────────────────────────────────────
function RiskBadge({ level }: { level: string }) {
  const bucket = riskBucket(level)
  const { color, label } = {
    low:     { color: S.positive, label: 'LOW RISK' },
    mod:     { color: S.warning,  label: 'MEDIUM RISK' },
    high:    { color: S.negative, label: 'HIGH RISK' },
    unknown: { color: S.outline,  label: 'UNKNOWN' },
  }[bucket]
  return (
    <span style={{
      fontSize: 10, fontFamily: S.mono, fontWeight: 700, letterSpacing: '0.06em',
      color, background: `${color}15`, border: `1px solid ${color}35`,
      padding: '3px 8px', borderRadius: 9999, whiteSpace: 'nowrap' as const,
    }}>
      {label}
    </span>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function WatchlistDashboard({
  companies, watchedSymbols, onToggleWatchlist, onViewForecast, onViewAI, onNavigateToExplorer,
}: Props) {
  const [showAll, setShowAll] = useState(false)

  const watched = useMemo(
    () => companies.filter(c => watchedSymbols.includes(c.symbol)),
    [companies, watchedSymbols],
  )

  const kpis = useMemo(() => {
    if (!watched.length) return null
    const avgUp  = avg(watched.map(c => c.forecast_30d_upside_pct))
    const avgVol = avg(watched.map(c => c.annualized_volatility_pct))
    const best   = watched.reduce((a, b) => b.forecast_30d_upside_pct > a.forecast_30d_upside_pct ? b : a)
    const mostVol= watched.reduce((a, b) => b.annualized_volatility_pct > a.annualized_volatility_pct ? b : a)
    const pos = watched.filter(c => c.forecast_signal === 'Positive Forecast').length
    const neu = watched.filter(c => c.forecast_signal === 'Neutral Forecast').length
    const neg = watched.filter(c => c.forecast_signal === 'Negative Forecast').length
    const low = watched.filter(c => riskBucket(c.risk_level) === 'low').length
    const mod = watched.filter(c => riskBucket(c.risk_level) === 'mod').length
    const high= watched.filter(c => riskBucket(c.risk_level) === 'high').length
    const unk = watched.filter(c => riskBucket(c.risk_level) === 'unknown').length
    return { avgUp, avgVol, best, mostVol, pos, neu, neg, low, mod, high, unk }
  }, [watched])

  const sectorBreakdown = useMemo(() => {
    const counts: Record<string, number> = {}
    watched.forEach(c => { const s = c.sector || 'Unknown'; counts[s] = (counts[s] ?? 0) + 1 })
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .map(([sector, count]) => ({ sector, count, pct: watched.length ? (count / watched.length) * 100 : 0 }))
  }, [watched])

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!watched.length) {
    return (
      <div style={{ fontFamily: S.body, position: 'relative' }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-12%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,128,249,0.12) 0%, transparent 65%)', filter: 'blur(60px)' }} />
          <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(205,127,50,0.08) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 11, fontFamily: S.mono, color: S.textMuted, letterSpacing: '0.10em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Personal · Local Storage</div>
            <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 700, color: S.textPrimary, letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>My Watchlist</h1>
          </div>
          <div style={{ ...glass({ padding: '64px 32px', textAlign: 'center' as const, maxWidth: 520, margin: '0 auto' }) }}>
            <Bookmark size={40} style={{ color: S.textMuted, marginBottom: 20 }} />
            <div style={{ fontSize: 18, fontWeight: 600, color: S.textPrimary, marginBottom: 12 }}>No companies in your watchlist yet</div>
            <p style={{ fontSize: 14, color: S.textMuted, lineHeight: 1.65, marginBottom: 28 }}>
              Go to Explorer and click the bookmark icon next to any company to add it here. Your watchlist is saved locally in this browser.
            </p>
            <button onClick={onNavigateToExplorer}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: S.primary, background: `${S.primary}12`, border: `1px solid ${S.primary}30`, padding: '10px 22px', borderRadius: 9999, cursor: 'pointer', fontFamily: S.body }}>
              Open Explorer <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Populated state ──────────────────────────────────────────────────────
  const TABLE_PREVIEW = 4
  const displayedRows = showAll ? watched : watched.slice(0, TABLE_PREVIEW)

  return (
    <div style={{ fontFamily: S.body, position: 'relative' }}>

      {/* ── Atmospheric orbs ─────────────────────────────────────────────── */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-15%', left: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,128,249,0.13) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(205,127,50,0.09) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 36 }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: S.mono, color: S.textMuted, letterSpacing: '0.10em', textTransform: 'uppercase' as const, marginBottom: 10 }}>
              Personal · Local Storage
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
              <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 700, color: S.textPrimary, letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
                My Watchlist
              </h1>
              <span style={{ fontSize: 13, fontWeight: 700, color: S.primary, background: `${S.primary}18`, border: `1px solid ${S.primary}35`, padding: '3px 11px', borderRadius: 9999, fontFamily: S.mono }}>
                {watched.length}
              </span>
            </div>
            <p style={{ fontSize: 14, color: S.textMuted, lineHeight: 1.6, margin: 0, maxWidth: 520 }}>
              Track selected companies and monitor their forecast, risk, and signal profile.
            </p>
          </div>
          <button onClick={onNavigateToExplorer}
            style={{ ...glass({ borderRadius: 9999, padding: '10px 22px' }), fontSize: 13, fontWeight: 700, color: S.textPrimary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '0.05em', whiteSpace: 'nowrap' as const }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${S.primary}50` }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = S.border }}>
            ADD MORE <ArrowRight size={14} />
          </button>
        </div>

        {/* ── KPI row ──────────────────────────────────────────────────────── */}
        {kpis && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 20 }}>
            {/* Simple KPI cards */}
            {[
              { label: 'In Watchlist',    value: watched.length.toString(),                                         color: S.textPrimary },
              { label: 'Avg 30D Upside',  value: kpis.avgUp >= 0 ? `+${kpis.avgUp.toFixed(1)}%` : `${kpis.avgUp.toFixed(1)}%`, color: pctColor(kpis.avgUp) },
              { label: 'Best Upside',     value: `${kpis.best.symbol}`,                                             color: S.positive, sub: `+${kpis.best.forecast_30d_upside_pct.toFixed(1)}%` },
              { label: 'Avg Volatility',  value: `${kpis.avgVol.toFixed(1)}%`,                                      color: S.warning },
            ].map(({ label, value, color, sub }) => (
              <div key={label} style={{ ...glass({ padding: '18px 20px' }) }}>
                <div style={{ fontSize: 10, fontFamily: S.mono, color: S.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 10 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
                {sub && <div style={{ fontSize: 13, fontWeight: 600, color: S.positive, marginTop: 4, fontFamily: S.mono }}>{sub}</div>}
              </div>
            ))}

            {/* Forecast Mix */}
            <div style={{ ...glass({ padding: '18px 20px' }) }}>
              <div style={{ fontSize: 10, fontFamily: S.mono, color: S.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Forecast Mix</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'POS', count: kpis.pos, color: S.positive },
                  { label: 'NEU', count: kpis.neu, color: S.outline  },
                  { label: 'NEG', count: kpis.neg, color: S.negative },
                ].map(({ label, count, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, fontFamily: S.mono, color, width: 26, letterSpacing: '0.05em' }}>{label}</span>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{ height: '100%', borderRadius: 2, background: color, width: watched.length ? `${(count / watched.length) * 100}%` : '0%', transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: S.mono, color, width: 14, textAlign: 'right' as const }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Risk Mix */}
            <div style={{ ...glass({ padding: '18px 20px' }) }}>
              <div style={{ fontSize: 10, fontFamily: S.mono, color: S.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 10 }}>Risk Mix</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'LOW',  count: kpis.low,  color: S.positive },
                  { label: 'MOD',  count: kpis.mod,  color: S.warning  },
                  { label: 'HIGH', count: kpis.high, color: S.negative },
                  ...(kpis.unk > 0 ? [{ label: 'UNK', count: kpis.unk, color: S.outline }] : []),
                ].map(({ label, count, color }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, fontFamily: S.mono, color, width: 26, letterSpacing: '0.05em' }}>{label}</span>
                    <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                      <div style={{ height: '100%', borderRadius: 2, background: color, width: watched.length ? `${(count / watched.length) * 100}%` : '0%', transition: 'width 0.4s ease' }} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: S.mono, color, width: 14, textAlign: 'right' as const }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Sector exposure + Watchlist Summary ──────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

          {/* Sector Exposure */}
          <div style={{ ...glass({ padding: '24px 28px' }) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: S.primary }} />
              <span style={{ fontSize: 11, fontFamily: S.mono, color: S.textMuted, letterSpacing: '0.10em', textTransform: 'uppercase' as const }}>Sector Exposure</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sectorBreakdown.map(({ sector, count, pct }, i) => (
                <div key={sector} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 12, fontFamily: S.body, color: S.textSecondary, width: 140, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                    {sector}
                  </span>
                  <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 9999 }}>
                    <div style={{ height: '100%', borderRadius: 9999, background: SECTOR_COLORS[i] ?? S.outline, width: `${pct}%`, transition: 'width 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize: 12, fontFamily: S.mono, color: S.textMuted, width: 16, textAlign: 'right' as const }}>{count}</span>
                  <span style={{ fontSize: 11, fontFamily: S.mono, color: S.textMuted, width: 34, textAlign: 'right' as const }}>{pct.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Watchlist Summary */}
          <div style={{ ...glass({ padding: '24px 28px' }), display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: S.bronze }} />
              <span style={{ fontSize: 11, fontFamily: S.mono, color: S.textMuted, letterSpacing: '0.10em', textTransform: 'uppercase' as const }}>Watchlist Summary</span>
            </div>
            {kpis ? (
              <>
                <p style={{ fontSize: 15, color: S.textSecondary, fontFamily: S.body, lineHeight: 1.75, flex: 1, margin: 0, fontStyle: 'italic' }}>
                  "Your{' '}
                  <strong style={{ color: S.textPrimary, fontStyle: 'normal' }}>{watched.length}-stock watchlist</strong>
                  {' '}has an average 30-day forecast upside of{' '}
                  <strong style={{ color: pctColor(kpis.avgUp), fontStyle: 'normal' }}>
                    {kpis.avgUp >= 0 ? `+${kpis.avgUp.toFixed(1)}%` : `${kpis.avgUp.toFixed(1)}%`}
                  </strong>.{' '}
                  <strong style={{ color: S.textPrimary, fontStyle: 'normal' }}>{kpis.best.symbol}</strong>
                  {' '}has the strongest forecast ({' '}
                  <strong style={{ color: S.positive, fontStyle: 'normal' }}>+{kpis.best.forecast_30d_upside_pct.toFixed(1)}%</strong>
                  ), while{' '}
                  <strong style={{ color: S.textPrimary, fontStyle: 'normal' }}>{kpis.mostVol.symbol}</strong>
                  {' '}carries the highest volatility ({' '}
                  <strong style={{ color: S.warning, fontStyle: 'normal' }}>{kpis.mostVol.annualized_volatility_pct.toFixed(1)}%</strong>
                  ). The watchlist is most exposed to{' '}
                  <strong style={{ color: S.primary, textDecoration: 'underline', fontStyle: 'normal', cursor: 'default' }}>
                    {sectorBreakdown[0]?.sector ?? '—'}
                  </strong>."
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 20, paddingTop: 16, borderTop: `1px solid ${S.divider}` }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: S.primary, background: `${S.primary}18`, border: `1px solid ${S.primary}35`, padding: '2px 8px', borderRadius: 4, fontFamily: S.mono, letterSpacing: '0.06em' }}>AI</span>
                  <span style={{ fontSize: 10, fontFamily: S.mono, color: S.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Generated by MarketPulse Cognition Engine</span>
                </div>
              </>
            ) : (
              <p style={{ fontSize: 14, color: S.textMuted, fontFamily: S.body, lineHeight: 1.65 }}>Add companies to generate a summary.</p>
            )}
          </div>
        </div>

        {/* ── Watched Companies table ───────────────────────────────────────── */}
        <div style={{ ...glass({ overflow: 'hidden' }) }}>
          {/* Table header */}
          <div style={{ padding: '18px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary, letterSpacing: '-0.01em' }}>Watched Companies</span>
            <span style={{ fontSize: 11, fontFamily: S.mono, color: S.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
              {watched.length} {watched.length === 1 ? 'company' : 'companies'} tracking in real-time
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                  {['Symbol', 'Company', 'Price', '30D Upside', 'Risk Profile', 'Vol', 'Signal', 'Manage'].map((label, i) => (
                    <th key={label} style={{
                      padding: '11px 16px',
                      textAlign: (i >= 2 && i <= 5 ? 'right' : 'left') as 'right' | 'left',
                      fontSize: 10, fontFamily: S.mono, fontWeight: 600,
                      color: S.textMuted, letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const,
                      borderBottom: `1px solid ${S.border}`,
                      whiteSpace: 'nowrap' as const,
                    }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((c, i) => {
                  const up     = c.forecast_30d_upside_pct
                  const sc     = getSignalColor(c.final_signal)
                  const slabel = signalShort[c.final_signal] ?? c.final_signal
                  const isLast = i === displayedRows.length - 1
                  return (
                    <tr key={c.symbol}
                      style={{ borderBottom: isLast ? 'none' : `1px solid ${S.divider}`, transition: 'background 0.12s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.025)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>

                      {/* Symbol */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' as const }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: S.textPrimary, fontFamily: S.mono }}>{c.symbol}</div>
                        <div style={{ fontSize: 10, color: S.textMuted, fontFamily: S.mono, marginTop: 2, textTransform: 'uppercase' as const, letterSpacing: '0.04em' }}>{c.sector}</div>
                      </td>

                      {/* Company */}
                      <td style={{ padding: '14px 16px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        <span style={{ fontSize: 13, color: S.textSecondary, fontFamily: S.body }}>{c.company_name}</span>
                      </td>

                      {/* Price */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                        <span style={{ fontSize: 13, color: S.textPrimary, fontFamily: S.mono }}>{formatCurrency(c.latest_price)}</span>
                      </td>

                      {/* 30D Upside */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: pctColor(up), fontFamily: S.mono }}>
                          {formatPercent(up)}
                        </span>
                      </td>

                      {/* Risk Profile */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                        <RiskBadge level={c.risk_level} />
                      </td>

                      {/* Volatility */}
                      <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' as const }}>
                        <span style={{ fontSize: 12, color: S.textSecondary, fontFamily: S.mono }}>{c.annualized_volatility_pct.toFixed(1)}%</span>
                      </td>

                      {/* Signal */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' as const }}>
                        <span style={{
                          display: 'inline-block', fontSize: 9, fontFamily: S.mono, fontWeight: 700,
                          letterSpacing: '0.07em', color: sc, background: `${sc}14`,
                          border: `1px solid ${sc}30`, padding: '3px 7px', borderRadius: 4,
                          textTransform: 'uppercase' as const,
                        }}>
                          {slabel}
                        </span>
                      </td>

                      {/* Manage */}
                      <td style={{ padding: '14px 16px', whiteSpace: 'nowrap' as const }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <button onClick={() => onViewForecast(c)} title={`Forecast: ${c.symbol}`}
                            style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid ${S.border}`, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: S.primary, transition: 'border-color 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${S.primary}50` }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = S.border }}>
                            <Share2 size={11} />
                          </button>
                          <button onClick={() => onToggleWatchlist(c.symbol)} title={`Remove ${c.symbol}`}
                            style={{ width: 28, height: 28, borderRadius: 6, border: `1px solid rgba(255,180,171,0.25)`, background: 'rgba(255,180,171,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: S.negative, transition: 'border-color 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${S.negative}60` }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,180,171,0.25)' }}>
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Show more / show less */}
          {watched.length > TABLE_PREVIEW && (
            <div style={{ padding: '16px 24px', borderTop: `1px solid ${S.border}`, textAlign: 'center' as const }}>
              <button onClick={() => setShowAll(v => !v)}
                style={{ fontSize: 12, fontFamily: S.mono, fontWeight: 600, color: S.textMuted, background: 'none', border: 'none', cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' as const, transition: 'color 0.15s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = S.textPrimary }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = S.textMuted }}>
                {showAll ? `Collapse Watchlist ↑` : `Show Full Watchlist (${watched.length}) ↓`}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
