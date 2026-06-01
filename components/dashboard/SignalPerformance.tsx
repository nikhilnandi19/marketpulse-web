'use client'

import { useMemo, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Layers, Calendar, Clock, CheckCircle2, TrendingUp, BarChart2 } from 'lucide-react'
import type {
  SignalSnapshot,
  SignalPerformanceSummary,
  SignalPerformanceBySector,
  SignalPerformanceByRisk,
} from '@/lib/types'

interface Props {
  snapshots: SignalSnapshot[]
  summary:   SignalPerformanceSummary[]
  bySector:  SignalPerformanceBySector[]
  byRisk:    SignalPerformanceByRisk[]
}

// ─── Design tokens ─────────────────────────────────────────────────────────────
const D = {
  // Panel
  panelBg:     'rgba(10, 18, 28, 0.62)',
  panelBorder: 'rgba(255,255,255,0.10)',
  panelRadius: 16,
  // Text
  text:     '#e2e2e2',
  textSec:  '#ccc3d3',
  textMuted:'#8c909f',
  // Accents (kept consistent with rest of MarketPulse)
  primary:  '#d0bcff',   // lavender
  cyan:     '#00dce5',   // secondary-fixed-dim (Stitch)
  teal:     '#4edea3',   // positive
  orange:   '#fb923c',   // warning
  red:      '#f87171',   // negative
  // Semantic
  positive: '#10B981',
  negative: '#ef4444',
  warning:  '#f59e0b',
  // Type
  mono: 'JetBrains Mono, monospace',
  body: 'Inter, system-ui, sans-serif',
} as const

// Shared glass panel style — applied inline, not via CSS class
function glass(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background:          D.panelBg,
    backdropFilter:      'blur(20px)',
    WebkitBackdropFilter:'blur(20px)',
    border:              `1px solid ${D.panelBorder}`,
    borderRadius:        D.panelRadius,
    boxShadow:           'inset 0 0.5px 0 rgba(255,255,255,0.12), 0 32px 40px -10px rgba(0,0,0,0.45)',
    ...extra,
  }
}

// ─── Format helpers ─────────────────────────────────────────────────────────────
function fmtPctSigned(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}
function fmtHitRate(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—'
  return `${v.toFixed(1)}%`
}
function pctColor(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return D.textMuted
  return (v as number) >= 0 ? D.teal : D.red
}
function hitColor(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return D.textMuted
  return (v as number) >= 50 ? D.teal : D.red
}

// ─── Signal helpers ─────────────────────────────────────────────────────────────
function resolveSignal(row: SignalSnapshot): string {
  const ok = (s: string) => s && s !== 'nan' && s !== 'None' && s.trim() !== ''
  if (ok(row.final_signal))      return row.final_signal
  if (ok(row.investment_signal)) return row.investment_signal
  if (ok(row.forecast_signal))   return row.forecast_signal
  return '—'
}

// Glowing dot color per signal category
function signalDotColor(sig: string): string {
  if (sig.includes('Opportunity'))                             return D.positive
  if (sig.includes('Stable'))                                  return '#60a5fa'
  if (sig.includes('Speculative') || sig.includes('High Vol')) return D.warning
  if (sig.includes('Weak') || sig.includes('Negative'))        return D.negative
  if (sig.includes('Review'))                                  return D.textMuted
  return D.textMuted
}

// Short chip for the audit log
function sigChip(sig: string): { color: string; bg: string; label: string } {
  if (sig.includes('Opportunity'))                             return { color: D.teal,    bg: `${D.teal}18`,            label: 'OPPORTUNITY' }
  if (sig.includes('Stable'))                                  return { color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',  label: 'STABLE'      }
  if (sig.includes('Speculative') || sig.includes('High Vol')) return { color: D.orange,  bg: `${D.orange}18`,          label: 'HIGH VOL'    }
  if (sig.includes('Weak') || sig.includes('Negative'))        return { color: D.red,     bg: `${D.red}18`,             label: 'RISK WARN'   }
  if (sig.includes('Review'))                                  return { color: D.textMuted, bg: 'rgba(140,144,159,0.12)', label: 'REVIEW'    }
  return { color: D.textMuted, bg: 'rgba(140,144,159,0.12)', label: sig.slice(0, 10).toUpperCase() }
}

// Risk pill colour
function riskPillStyle(risk: string): { color: string; bg: string; border: string } {
  const v = (risk ?? '').toLowerCase()
  if (v.includes('high'))                        return { color: D.negative, bg: `${D.negative}12`, border: `${D.negative}35` }
  if (v.includes('mod') || v.includes('medium')) return { color: D.warning,  bg: `${D.warning}12`,  border: `${D.warning}35`  }
  if (v.includes('low'))                         return { color: D.positive, bg: `${D.positive}12`, border: `${D.positive}35` }
  return { color: D.textMuted, bg: 'rgba(140,144,159,0.10)', border: 'rgba(140,144,159,0.20)' }
}

// Sector bar colours — cycle through a palette
const BAR_COLORS = [
  D.primary, D.cyan, '#cccc47', '#f59e0b', '#60a5fa',
  D.teal, '#f472b6', '#a78bfa', '#34d399', D.orange,
]

// ─── Reusable table primitives ──────────────────────────────────────────────────
function Th({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) {
  return (
    <th style={{
      padding: '10px 20px',
      textAlign: center ? 'center' : right ? 'right' : 'left',
      fontSize: 10, fontFamily: D.mono, fontWeight: 500,
      color: D.textMuted, letterSpacing: '0.10em',
      textTransform: 'uppercase' as const,
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      whiteSpace: 'nowrap' as const,
      background: 'rgba(255,255,255,0.025)',
    }}>
      {children}
    </th>
  )
}

function Td({ children, right, center, mono }: {
  children: React.ReactNode; right?: boolean; center?: boolean; mono?: boolean
}) {
  return (
    <td style={{
      padding: '11px 20px',
      textAlign: center ? 'center' : right ? 'right' : 'left',
      fontSize: 13, color: D.textSec,
      fontFamily: mono ? D.mono : D.body,
      borderBottom: '1px solid rgba(255,255,255,0.04)',
      whiteSpace: 'nowrap' as const,
    }}>
      {children}
    </td>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function LabelCaps({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      display: 'block',
      fontSize: 10, fontFamily: D.mono, fontWeight: 500,
      color: color ?? D.textMuted,
      letterSpacing: '0.12em', textTransform: 'uppercase' as const,
    }}>
      {children}
    </span>
  )
}

function CardHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div style={{
      padding: '14px 24px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'rgba(255,255,255,0.025)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
    }}>
      <div style={{ fontSize: 17, fontWeight: 600, color: D.text, letterSpacing: '-0.02em', fontFamily: D.body }}>
        {title}
      </div>
      {right}
    </div>
  )
}

// Pending shows animated dot; partial/complete show static dot
function StatusBadge({ status }: { status: string }) {
  const key = (status ?? '').toLowerCase()
  const cfg: Record<string, { color: string; bg: string; border: string; pulse: boolean }> = {
    pending:  { color: D.warning,  bg: `${D.warning}14`,  border: `${D.warning}35`,  pulse: true  },
    partial:  { color: D.orange,   bg: `${D.orange}14`,   border: `${D.orange}35`,   pulse: false },
    complete: { color: D.positive, bg: `${D.positive}14`, border: `${D.positive}35`, pulse: false },
  }
  const c = cfg[key] ?? cfg.pending
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 10, fontFamily: D.mono, letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      color: c.color, background: c.bg, border: `1px solid ${c.border}`,
      padding: '3px 8px', borderRadius: 4,
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: '50%',
        background: c.color, flexShrink: 0,
        animation: c.pulse ? 'sp-pulse 1.6s ease-in-out infinite' : undefined,
      }} />
      {key}
    </span>
  )
}

function ResultCell({ ret, hit }: { ret: number | null; hit: number | null }) {
  if (ret == null) return <span style={{ color: D.textMuted, fontSize: 11, fontFamily: D.mono }}>—</span>
  const color = hit === 1 ? D.teal : hit === 0 ? D.red : D.textSec
  const icon  = hit === 1 ? '✓ '  : hit === 0 ? '✗ '  : ''
  return (
    <span style={{ color, fontSize: 11, fontFamily: D.mono }}>
      {icon}{ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
    </span>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────
export default function SignalPerformance({ snapshots, summary, bySector, byRisk }: Props) {
  const [logLimit, setLogLimit] = useState(50)

  // ── Aggregate KPIs ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!snapshots.length) return null
    const uniqueDates = new Set(snapshots.map(s => s.snapshot_date).filter(Boolean)).size
    const pending  = snapshots.filter(s => s.outcome_status === 'pending').length
    const partial  = snapshots.filter(s => s.outcome_status === 'partial').length
    const complete = snapshots.filter(s => s.outcome_status === 'complete').length
    const with30   = snapshots.filter(s => s.return_30d_pct != null)
    const withHit  = with30.filter(s => s.hit_30d === 1 || s.hit_30d === 0)
    const hitRate30 = withHit.length
      ? (withHit.filter(s => s.hit_30d === 1).length / withHit.length) * 100
      : null
    const avgRet30 = with30.length
      ? with30.reduce((a, s) => a + (s.return_30d_pct as number), 0) / with30.length
      : null
    return { uniqueDates, pending, partial, complete, hitRate30, avgRet30 }
  }, [snapshots])

  // ── Sorted signal log ───────────────────────────────────────────────────────
  const signalLog = useMemo(() => {
    return [...snapshots]
      .sort((a, b) => {
        const dc = (b.snapshot_date ?? '').localeCompare(a.snapshot_date ?? '')
        return dc !== 0 ? dc : (a.symbol ?? '').localeCompare(b.symbol ?? '')
      })
      .slice(0, logLimit)
  }, [snapshots, logLimit])

  const allPending = !!stats && stats.complete === 0 && stats.partial === 0

  // Max for sector bar scaling
  const maxSectorCount = useMemo(
    () => Math.max(...bySector.map(s => s.snapshot_count), 1),
    [bySector],
  )

  // ── KPI card definitions ────────────────────────────────────────────────────
  const kpiCards: { label: string; value: string; color: string; Icon: LucideIcon }[] = stats
    ? [
        { label: 'Total Snapshots', value: snapshots.length.toLocaleString(),            color: D.cyan,    Icon: Layers       },
        { label: 'Unique Dates',    value: stats.uniqueDates.toString(),                 color: D.text,    Icon: Calendar     },
        { label: 'Pending',         value: stats.pending.toLocaleString(),               color: D.warning, Icon: Clock        },
        { label: 'Complete 30D',    value: stats.complete.toLocaleString(),              color: stats.complete > 0 ? D.teal : D.textMuted, Icon: CheckCircle2 },
        { label: '30D Hit Rate',    value: stats.hitRate30 != null ? `${stats.hitRate30.toFixed(1)}%` : '—', color: hitColor(stats.hitRate30), Icon: TrendingUp },
        { label: 'Avg 30D Return',  value: stats.avgRet30  != null ? fmtPctSigned(stats.avgRet30) : '—',  color: pctColor(stats.avgRet30),  Icon: BarChart2   },
      ]
    : []

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!snapshots.length) {
    return (
      <div style={{ ...glass(), padding: 56, textAlign: 'center', marginTop: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 20 }}>📊</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: D.text, fontFamily: D.body, marginBottom: 10 }}>
          Signal tracking has not started yet
        </div>
        <div style={{ fontSize: 14, color: D.textMuted, fontFamily: D.body, lineHeight: 1.65 }}>
          It will begin after the next successful data pipeline run.
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: D.body, position: 'relative' }}>

      {/* ── Background blur orbs (glassmorphism depth) ─────────────────── */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-5%',  width: 600, height: 600, borderRadius: '50%', background: 'rgba(189,147,249,0.13)', filter: 'blur(140px)' }} />
        <div style={{ position: 'absolute', top: '30%',  right: '-8%', width: 500, height: 500, borderRadius: '50%', background: 'rgba(0,220,229,0.09)',   filter: 'blur(130px)' }} />
        <div style={{ position: 'absolute', bottom: '5%', left: '30%', width: 420, height: 420, borderRadius: '50%', background: 'rgba(189,147,249,0.07)', filter: 'blur(120px)' }} />
      </div>

      {/* ── Content (above orbs) ───────────────────────────────────────── */}
      <div style={{ position: 'relative', zIndex: 1 }}>

      {/* ── CSS: pulsing dot animation ─────────────────────────────────── */}
      <style>{`
        @keyframes sp-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.35; transform: scale(0.75); }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <LabelCaps color={D.primary}>Signal Accountability · Live Tracking</LabelCaps>
          <h1 style={{
            marginTop: 10,
            fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', fontWeight: 700,
            color: D.text, letterSpacing: '-0.03em', lineHeight: 1.1, fontFamily: D.body,
          }}>
            Signal Performance
          </h1>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 11, fontFamily: D.mono,
            color: D.warning, background: `${D.warning}12`, border: `1px solid ${D.warning}35`,
            padding: '5px 14px', borderRadius: 999, letterSpacing: '0.04em',
          }}>
            ⚠ Educational model evaluation only
          </span>
          {allPending && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 11, fontFamily: D.mono,
              color: D.textMuted, background: 'rgba(140,144,159,0.08)', border: '1px solid rgba(140,144,159,0.18)',
              padding: '5px 14px', borderRadius: 999, letterSpacing: '0.04em',
            }}>
              ⓘ Newer signals may show as pending
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      {kpiCards.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(158px, 1fr))',
          gap: 16, marginBottom: 24,
        }}>
          {kpiCards.map(({ label, value, color, Icon }) => (
            <div key={label} style={{ ...glass(), padding: '18px 20px' }}>
              <LabelCaps>{label}</LabelCaps>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14 }}>
                <div style={{
                  fontSize: 28, fontWeight: 700, fontFamily: D.mono,
                  color, lineHeight: 1, letterSpacing: '-0.02em',
                }}>
                  {value}
                </div>
                <Icon size={20} style={{ color: `${color}55`, marginBottom: 2, flexShrink: 0 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Status banner: all pending ─────────────────────────────────── */}
      {allPending && (
        <div style={{
          ...glass(),
          borderLeft: `4px solid ${D.cyan}`,
          boxShadow: `inset 0 0.5px 0 rgba(255,255,255,0.12), 0 0 48px -12px rgba(0,220,229,0.12)`,
          padding: '20px 24px', marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 20,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
            background: `${D.cyan}14`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
          }}>⏳</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: D.text, fontFamily: D.body, marginBottom: 4 }}>
              Tracking has started
            </div>
            <div style={{ fontSize: 13, color: D.textMuted, lineHeight: 1.6, maxWidth: 560 }}>
              Performance results for newly captured snapshots will populate automatically as market data matures.
              Outcomes are evaluated after 5, 10, and 30 trading days have elapsed.
            </div>
          </div>
        </div>
      )}

      {/* Banner: some data but no 30D complete yet */}
      {!allPending && stats && stats.complete === 0 && (
        <div style={{
          ...glass(), padding: '14px 20px', marginBottom: 24,
          fontSize: 13, color: D.textMuted,
        }}>
          30-day outcomes are still pending. Results will appear once enough trading days have elapsed.
        </div>
      )}

      {/* ── Signal Category Performance ─────────────────────────────────── */}
      <div style={{ ...glass({ overflow: 'hidden' }), marginBottom: 24 }}>
        <CardHeader title="Signal Category Performance" />
        {summary.length === 0 ? (
          <div style={{ padding: 24, fontSize: 13, color: D.textMuted }}>No summary data available.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>Signal Category</Th>
                  <Th right>Snapshots</Th>
                  <Th right>Pending</Th>
                  <Th center>Part / Comp</Th>
                  <Th right>Avg Forecast</Th>
                  <Th right>5D Hit</Th>
                  <Th right>30D Hit</Th>
                </tr>
              </thead>
              <tbody>
                {summary.map(row => {
                  const dotColor = signalDotColor(row.signal_category)
                  return (
                    <tr key={row.signal_category}
                      style={{ cursor: 'default', transition: 'background 0.12s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                      <Td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {/* Glowing signal dot */}
                          <span style={{
                            width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                            background: dotColor,
                            boxShadow: `0 0 6px ${dotColor}90`,
                          }} />
                          <span style={{ color: D.text, fontWeight: 500, fontSize: 13 }}>
                            {row.signal_category || '—'}
                          </span>
                        </div>
                      </Td>
                      <Td right mono>{row.snapshot_count.toLocaleString()}</Td>
                      <Td right mono>
                        <span style={{ color: row.pending_count > 0 ? D.warning : D.textMuted }}>
                          {row.pending_count.toLocaleString()}
                        </span>
                      </Td>
                      <Td center mono>{row.partial_count} / {row.complete_count}</Td>
                      <Td right mono>
                        <span style={{ color: pctColor(row.avg_forecast_30d_upside_pct) }}>
                          {fmtPctSigned(row.avg_forecast_30d_upside_pct)}
                        </span>
                      </Td>
                      <Td right mono>
                        <span style={{ color: hitColor(row.hit_rate_5d_pct) }}>
                          {fmtHitRate(row.hit_rate_5d_pct)}
                        </span>
                      </Td>
                      <Td right mono>
                        <span style={{ color: hitColor(row.hit_rate_30d_pct) }}>
                          {fmtHitRate(row.hit_rate_30d_pct)}
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Sector + Risk ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24, marginBottom: 24 }}>

        {/* Sector Allocation — horizontal bars (real data from bySector prop) */}
        <div style={{ ...glass({ overflow: 'hidden' }) }}>
          <CardHeader title="Sector Allocation" />
          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 15 }}>
            {bySector.length === 0 ? (
              <div style={{ fontSize: 13, color: D.textMuted }}>No sector data available.</div>
            ) : (
              [...bySector]
                .sort((a, b) => b.snapshot_count - a.snapshot_count)
                .map((row, i) => {
                  const pct = Math.max((row.snapshot_count / maxSectorCount) * 100, 3)
                  const barColor = BAR_COLORS[i % BAR_COLORS.length]
                  return (
                    <div key={row.sector} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* Sector name */}
                      <div style={{
                        width: 120, flexShrink: 0,
                        fontSize: 12, color: D.textSec,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {row.sector || '—'}
                      </div>
                      {/* Progress bar */}
                      <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: barColor, borderRadius: 999,
                          transition: 'width 0.6s ease',
                        }} />
                      </div>
                      {/* Count */}
                      <div style={{ width: 80, flexShrink: 0, textAlign: 'right', display: 'flex', alignItems: 'baseline', gap: 4, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 13, fontFamily: D.mono, color: D.text, fontWeight: 600 }}>
                          {row.snapshot_count.toLocaleString()}
                        </span>
                        <span style={{ fontSize: 9, color: D.textMuted, fontFamily: D.mono }}>snaps</span>
                      </div>
                    </div>
                  )
                })
            )}
          </div>
        </div>

        {/* Risk Profile Distribution — pill badges (real data from byRisk prop) */}
        <div style={{ ...glass({ overflow: 'hidden' }) }}>
          <CardHeader title="Risk Profile Distribution" />
          {byRisk.length === 0 ? (
            <div style={{ padding: 24, fontSize: 13, color: D.textMuted }}>No risk data available.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <Th>Level</Th>
                    <Th right>Total</Th>
                    <Th right>Avg Forecast</Th>
                    <Th right>30D Performance</Th>
                  </tr>
                </thead>
                <tbody>
                  {byRisk.map(row => {
                    const pill = riskPillStyle(row.risk_level)
                    return (
                      <tr key={row.risk_level}
                        style={{ transition: 'background 0.12s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                        <Td>
                          <span style={{
                            display: 'inline-block',
                            fontSize: 10, fontFamily: D.mono, fontWeight: 700,
                            color: pill.color, background: pill.bg, border: `1px solid ${pill.border}`,
                            padding: '3px 10px', borderRadius: 999,
                            textTransform: 'uppercase' as const, letterSpacing: '0.06em',
                          }}>
                            {row.risk_level || '—'}
                          </span>
                        </Td>
                        <Td right mono>
                          <span style={{ color: D.text, fontWeight: 600 }}>{row.snapshot_count.toLocaleString()}</span>
                        </Td>
                        <Td right mono>
                          <span style={{ color: pctColor(row.avg_forecast_30d_upside_pct) }}>
                            {fmtPctSigned(row.avg_forecast_30d_upside_pct)}
                          </span>
                        </Td>
                        <Td right mono>
                          {row.avg_return_30d_pct != null ? (
                            <span style={{ color: pctColor(row.avg_return_30d_pct) }}>
                              {fmtPctSigned(row.avg_return_30d_pct)}
                            </span>
                          ) : (
                            <span style={{ color: D.textMuted }}>Pending</span>
                          )}
                        </Td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Signal Snapshot Audit History ──────────────────────────────── */}
      <div style={{ ...glass({ overflow: 'hidden' }) }}>
        <CardHeader
          title="Signal Snapshot Audit History"
          right={
            <span style={{ fontSize: 11, fontFamily: D.mono, color: D.textMuted }}>
              Showing {signalLog.length.toLocaleString()} of {snapshots.length.toLocaleString()}
            </span>
          }
        />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <Th>Timestamp</Th>
                <Th>Ticker</Th>
                <Th right>Price</Th>
                <Th right>Forecast</Th>
                <Th>Signal</Th>
                <Th>Risk</Th>
                <Th right>5D</Th>
                <Th right>30D</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {signalLog.map((row, i) => {
                const sig  = resolveSignal(row)
                const chip = sigChip(sig)
                return (
                  <tr key={`${row.snapshot_date}-${row.symbol}-${i}`}
                    style={{ transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                    <Td mono>
                      <span style={{ color: D.textMuted }}>{row.snapshot_date || '—'}</span>
                    </Td>
                    <Td>
                      <span style={{ fontFamily: D.mono, fontWeight: 700, fontSize: 13, color: D.text }}>
                        {row.symbol || '—'}
                      </span>
                    </Td>
                    <Td right mono>
                      {row.latest_close != null ? `$${row.latest_close.toFixed(2)}` : '—'}
                    </Td>
                    <Td right mono>
                      <span style={{ color: pctColor(row.forecast_30d_upside_pct) }}>
                        {fmtPctSigned(row.forecast_30d_upside_pct)}
                      </span>
                    </Td>
                    <Td>
                      {sig !== '—' ? (
                        <span style={{
                          fontSize: 10, fontFamily: D.mono,
                          color: chip.color, background: chip.bg,
                          border: `1px solid ${chip.color}35`,
                          padding: '2px 8px', borderRadius: 4,
                          textTransform: 'uppercase' as const, letterSpacing: '0.05em',
                        }}>
                          {chip.label}
                        </span>
                      ) : (
                        <span style={{ color: D.textMuted, fontSize: 12 }}>—</span>
                      )}
                    </Td>
                    <Td>
                      <span style={{ fontSize: 12, color: D.textMuted }}>{row.risk_level || '—'}</span>
                    </Td>
                    <Td right>
                      <ResultCell ret={row.return_5d_pct} hit={row.hit_5d} />
                    </Td>
                    <Td right>
                      <ResultCell ret={row.return_30d_pct} hit={row.hit_30d} />
                    </Td>
                    <Td>
                      <StatusBadge status={row.outcome_status} />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {snapshots.length > logLimit && (
          <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center' }}>
            <button
              onClick={() => setLogLimit(p => p + 50)}
              style={{
                fontSize: 12, fontFamily: D.mono, color: D.primary,
                background: `${D.primary}10`, border: `1px solid ${D.primary}28`,
                padding: '8px 28px', borderRadius: 8, cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${D.primary}18` }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${D.primary}10` }}>
              Load more ({(snapshots.length - logLimit).toLocaleString()} remaining)
            </button>
          </div>
        )}
      </div>

      </div>{/* end content */}
    </div>
  )
}
