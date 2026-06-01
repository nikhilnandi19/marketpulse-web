'use client'

import { useMemo, useState } from 'react'
import type {
  SignalSnapshot,
  SignalPerformanceSummary,
  SignalPerformanceBySector,
  SignalPerformanceByRisk,
} from '@/lib/types'

interface Props {
  snapshots: SignalSnapshot[]
  summary: SignalPerformanceSummary[]
  bySector: SignalPerformanceBySector[]
  byRisk: SignalPerformanceByRisk[]
}

// ─── Design tokens (matches rest of MarketPulse dashboard) ──────────────────
const D = {
  card:     '#1a1c1c',
  el:       '#1e2020',
  border:   'rgba(255,255,255,0.08)',
  borderL:  'rgba(255,255,255,0.05)',
  text:     '#e2e2e2',
  textSec:  '#c2c6d6',
  textMuted:'#8c909f',
  mono:     'JetBrains Mono, monospace',
  body:     'Inter, system-ui, sans-serif',
  purple:   '#d0bcff',
  blue:     '#adc6ff',
  teal:     '#4edea3',
  orange:   '#fb923c',
  red:      '#f87171',
} as const

// ─── Format helpers ──────────────────────────────────────────────────────────
function fmtPctSigned(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—'
  return `${v.toFixed(2)}%`
}

function pctColor(v: number | null | undefined): string {
  if (v == null || isNaN(v as number)) return D.textMuted
  return (v as number) >= 0 ? D.teal : D.red
}

// ─── Signal helpers ──────────────────────────────────────────────────────────
function resolveSignal(row: SignalSnapshot): string {
  const ok = (s: string) => s && s !== 'nan' && s !== 'None' && s.trim() !== ''
  if (ok(row.final_signal))      return row.final_signal
  if (ok(row.investment_signal)) return row.investment_signal
  if (ok(row.forecast_signal))   return row.forecast_signal
  return '—'
}

function signalChip(sig: string): { color: string; bg: string; label: string } {
  if (sig.includes('Opportunity'))                        return { color: D.teal,     bg: `${D.teal}18`,     label: 'OPPORTUNITY' }
  if (sig.includes('Stable'))                             return { color: D.blue,     bg: `${D.blue}18`,     label: 'STABLE' }
  if (sig.includes('Speculative') || sig.includes('High Vol')) return { color: D.orange, bg: `${D.orange}18`, label: 'HIGH VOL' }
  if (sig.includes('Weak') || sig.includes('Negative'))  return { color: D.red,      bg: `${D.red}18`,      label: 'RISK WARN' }
  if (sig.includes('Review'))                             return { color: D.textMuted, bg: 'rgba(140,144,159,0.12)', label: 'REVIEW' }
  if (sig.includes('Positive'))                           return { color: D.teal,     bg: `${D.teal}18`,     label: 'POSITIVE' }
  if (sig.includes('Neutral'))                            return { color: D.textSec,  bg: 'rgba(194,198,214,0.10)', label: 'NEUTRAL' }
  return { color: D.textMuted, bg: 'rgba(140,144,159,0.12)', label: sig.slice(0, 12).toUpperCase() }
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function ResultCell({ ret, hit }: { ret: number | null; hit: number | null }) {
  if (ret == null) {
    return <span style={{ color: D.textMuted, fontSize: 11, fontFamily: D.mono }}>Pending</span>
  }
  const isHit  = hit === 1
  const isMiss = hit === 0
  const color  = isHit ? D.teal : isMiss ? D.red : D.textSec
  const icon   = isHit ? '✓ ' : isMiss ? '✗ ' : ''
  return (
    <span style={{ color, fontSize: 11, fontFamily: D.mono }}>
      {icon}{ret >= 0 ? '+' : ''}{ret.toFixed(2)}%
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    pending:  [D.textMuted, 'rgba(140,144,159,0.10)'],
    partial:  [D.orange,    'rgba(251,146,60,0.10)'],
    complete: [D.teal,      'rgba(78,222,163,0.10)'],
  }
  const key = (status ?? '').toLowerCase()
  const [c, bg] = map[key] ?? map.pending
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 10, fontFamily: D.mono,
      color: c, background: bg,
      border: `1px solid ${c}40`,
      padding: '2px 7px', borderRadius: 3,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.06em',
    }}>
      {status ?? 'pending'}
    </span>
  )
}

function SectionLabel({ tag, title }: { tag: string; title: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, fontFamily: D.mono, color: D.textMuted,
        letterSpacing: '0.10em', textTransform: 'uppercase' as const,
        marginBottom: 8,
      }}>{tag}</div>
      <div style={{
        fontSize: 20, fontWeight: 700, color: D.text,
        fontFamily: D.body, letterSpacing: '-0.02em',
      }}>{title}</div>
    </div>
  )
}

// Shared table shell — horizontally scrollable
function TableShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: D.body, fontSize: 12 }}>
        {children}
      </table>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th style={{
      padding: '10px 14px',
      textAlign: right ? 'right' : 'left',
      fontSize: 10, fontFamily: D.mono, fontWeight: 400,
      color: D.textMuted, letterSpacing: '0.06em',
      textTransform: 'uppercase' as const,
      borderBottom: `1px solid ${D.border}`,
      whiteSpace: 'nowrap' as const,
      background: D.el,
    }}>
      {children}
    </th>
  )
}

function Td({
  children, right, mono,
}: {
  children: React.ReactNode; right?: boolean; mono?: boolean
}) {
  return (
    <td style={{
      padding: '10px 14px',
      textAlign: right ? 'right' : 'left',
      color: D.textSec,
      fontFamily: mono ? D.mono : D.body,
      borderBottom: `1px solid ${D.borderL}`,
      whiteSpace: 'nowrap' as const,
    }}>
      {children}
    </td>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function SignalPerformance({ snapshots, summary, bySector, byRisk }: Props) {
  const [logLimit, setLogLimit] = useState(50)

  // ── Aggregate KPIs from the raw snapshot rows ─────────────────────────────
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
      ? with30.reduce((acc, s) => acc + (s.return_30d_pct as number), 0) / with30.length
      : null

    return { uniqueDates, pending, partial, complete, hitRate30, avgRet30 }
  }, [snapshots])

  // ── Signal log — sorted desc date / asc symbol ────────────────────────────
  const signalLog = useMemo(() => {
    return [...snapshots]
      .sort((a, b) => {
        const dc = (b.snapshot_date ?? '').localeCompare(a.snapshot_date ?? '')
        return dc !== 0 ? dc : (a.symbol ?? '').localeCompare(b.symbol ?? '')
      })
      .slice(0, logLimit)
  }, [snapshots, logLimit])

  const allPending = !!stats && stats.complete === 0 && stats.partial === 0

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!snapshots.length) {
    return (
      <div style={{ padding: '80px 0', textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 20 }}>📊</div>
        <div style={{
          fontSize: 20, fontWeight: 600, color: D.text, fontFamily: D.body, marginBottom: 12,
        }}>
          Signal tracking has not started yet
        </div>
        <div style={{ fontSize: 14, color: D.textMuted, fontFamily: D.body, lineHeight: 1.65 }}>
          It will begin after the next successful data pipeline run.
        </div>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: D.body }}>

      {/* ── Section 1: Header ──────────────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start',
          justifyContent: 'space-between', flexWrap: 'wrap', gap: 16,
        }}>
          <div>
            <div style={{
              fontSize: 11, fontFamily: D.mono, color: D.textMuted,
              letterSpacing: '0.10em', textTransform: 'uppercase' as const, marginBottom: 10,
            }}>
              Signal Accountability · Live Tracking
            </div>
            <h1 style={{
              fontSize: 'clamp(1.6rem, 4vw, 2.2rem)', fontWeight: 700,
              color: D.text, letterSpacing: '-0.03em', lineHeight: 1.1,
              fontFamily: D.body, marginBottom: 12,
            }}>
              Signal Performance
            </h1>
            <p style={{ fontSize: 15, color: D.textMuted, lineHeight: 1.65, maxWidth: 620, marginBottom: 0 }}>
              Tracks whether MarketPulse's historical forecast signals were directionally correct
              after 5, 10, and 30 trading days.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
            <span style={{
              fontSize: 11, fontFamily: D.mono,
              color: D.orange, background: 'rgba(251,146,60,0.10)',
              border: `1px solid rgba(251,146,60,0.25)`,
              padding: '5px 12px', borderRadius: 4, letterSpacing: '0.06em',
            }}>
              Educational model evaluation only. Not investment advice.
            </span>
            {allPending && (
              <span style={{
                fontSize: 11, fontFamily: D.mono,
                color: D.textMuted, background: 'rgba(140,144,159,0.08)',
                border: `1px solid rgba(140,144,159,0.18)`,
                padding: '5px 12px', borderRadius: 4, letterSpacing: '0.06em',
              }}>
                Newer signals may show as pending until enough trading days have passed.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 2: KPI cards ──────────────────────────────────────────── */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
          gap: 16, marginBottom: 32,
        }}>
          {([
            {
              label: 'Total Snapshots',
              value: snapshots.length.toLocaleString(),
              color: D.text,
            },
            {
              label: 'Unique Dates',
              value: stats.uniqueDates.toString(),
              color: D.blue,
            },
            {
              label: 'Pending',
              value: stats.pending.toLocaleString(),
              color: D.textMuted,
            },
            {
              label: 'Complete 30D',
              value: stats.complete.toLocaleString(),
              color: stats.complete > 0 ? D.teal : D.textMuted,
            },
            {
              label: '30D Hit Rate',
              value: stats.hitRate30 != null ? `${stats.hitRate30.toFixed(1)}%` : '—',
              color: stats.hitRate30 != null
                ? (stats.hitRate30 >= 50 ? D.teal : D.red)
                : D.textMuted,
            },
            {
              label: 'Avg 30D Return',
              value: stats.avgRet30 != null ? fmtPctSigned(stats.avgRet30) : '—',
              color: stats.avgRet30 != null ? pctColor(stats.avgRet30) : D.textMuted,
            },
          ] as { label: string; value: string; color: string }[]).map(({ label, value, color }) => (
            <div key={label} style={{
              background: D.card, border: `1px solid ${D.border}`,
              borderRadius: 8, padding: '18px 20px',
            }}>
              <div style={{
                fontSize: 10, fontFamily: D.mono, color: D.textMuted,
                letterSpacing: '0.08em', textTransform: 'uppercase' as const, marginBottom: 10,
              }}>{label}</div>
              <div style={{
                fontSize: 26, fontWeight: 700, color,
                fontFamily: D.body, letterSpacing: '-0.02em', lineHeight: 1,
              }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Banner: all outcomes pending */}
      {allPending && (
        <div style={{
          background: D.el, border: `1px solid ${D.border}`,
          borderRadius: 8, padding: '20px 24px', marginBottom: 40,
          display: 'flex', alignItems: 'flex-start', gap: 16,
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>⏳</span>
          <div>
            <div style={{
              fontSize: 14, fontWeight: 600, color: D.text,
              fontFamily: D.body, marginBottom: 6,
            }}>
              Tracking has started — performance results will populate automatically
            </div>
            <div style={{ fontSize: 13, color: D.textMuted, fontFamily: D.body, lineHeight: 1.65 }}>
              Outcomes are evaluated after 5, 10, and 30 trading days have passed since each snapshot date.
              Partial results appear first, then full 30-day accuracy is computed automatically on each daily pipeline run.
            </div>
          </div>
        </div>
      )}

      {/* Banner: partial data only (30D still pending) */}
      {!allPending && stats && stats.complete === 0 && (
        <div style={{
          background: D.el, border: `1px solid ${D.border}`,
          borderRadius: 8, padding: '16px 20px', marginBottom: 40,
          fontSize: 13, color: D.textMuted, fontFamily: D.body,
        }}>
          30-day outcomes are pending. Results will appear after enough trading days have passed.
        </div>
      )}

      {/* ── Section 3: Signal category performance ──────────────────────── */}
      <div style={{
        background: D.card, border: `1px solid ${D.border}`,
        borderRadius: 8, overflow: 'hidden', marginBottom: 28,
      }}>
        <div style={{ padding: '24px 24px 0' }}>
          <SectionLabel tag="Performance by Signal" title="Signal Category Results" />
        </div>
        {summary.length === 0 ? (
          <div style={{ padding: '0 24px 24px', fontSize: 13, color: D.textMuted }}>No summary data available.</div>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Signal Category</Th>
                <Th right>Snapshots</Th>
                <Th right>Pending</Th>
                <Th right>Partial</Th>
                <Th right>Complete</Th>
                <Th right>Avg Forecast</Th>
                <Th right>Avg 5D Ret</Th>
                <Th right>5D Hit Rate</Th>
                <Th right>Avg 10D Ret</Th>
                <Th right>10D Hit Rate</Th>
                <Th right>Avg 30D Ret</Th>
                <Th right>30D Hit Rate</Th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row, i) => (
                <tr key={row.signal_category}
                  style={{ background: i % 2 === 0 ? D.card : D.el }}>
                  <Td>
                    <span style={{ color: D.text, fontWeight: 500 }}>
                      {row.signal_category || '—'}
                    </span>
                  </Td>
                  <Td right mono>{row.snapshot_count.toLocaleString()}</Td>
                  <Td right mono>{row.pending_count.toLocaleString()}</Td>
                  <Td right mono>{row.partial_count.toLocaleString()}</Td>
                  <Td right mono>{row.complete_count.toLocaleString()}</Td>
                  <Td right mono>
                    <span style={{ color: pctColor(row.avg_forecast_30d_upside_pct) }}>
                      {fmtPctSigned(row.avg_forecast_30d_upside_pct)}
                    </span>
                  </Td>
                  <Td right mono>
                    <span style={{ color: pctColor(row.avg_return_5d_pct) }}>
                      {fmtPctSigned(row.avg_return_5d_pct)}
                    </span>
                  </Td>
                  <Td right mono>{fmtPct(row.hit_rate_5d_pct)}</Td>
                  <Td right mono>
                    <span style={{ color: pctColor(row.avg_return_10d_pct) }}>
                      {fmtPctSigned(row.avg_return_10d_pct)}
                    </span>
                  </Td>
                  <Td right mono>{fmtPct(row.hit_rate_10d_pct)}</Td>
                  <Td right mono>
                    <span style={{ color: pctColor(row.avg_return_30d_pct) }}>
                      {fmtPctSigned(row.avg_return_30d_pct)}
                    </span>
                  </Td>
                  <Td right mono>{fmtPct(row.hit_rate_30d_pct)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </div>

      {/* ── Sections 4 + 5: Sector and Risk side-by-side ────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)',
        gap: 24, marginBottom: 28,
      }}>
        {/* Section 4 — Sector */}
        <div style={{
          background: D.card, border: `1px solid ${D.border}`,
          borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{ padding: '24px 24px 0' }}>
            <SectionLabel tag="Performance by Sector" title="Sector Results" />
          </div>
          {bySector.length === 0 ? (
            <div style={{ padding: '0 24px 24px', fontSize: 13, color: D.textMuted }}>No sector data available.</div>
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Sector</Th>
                  <Th right>Count</Th>
                  <Th right>Done</Th>
                  <Th right>Forecast</Th>
                  <Th right>Avg 5D</Th>
                  <Th right>Avg 10D</Th>
                  <Th right>Avg 30D</Th>
                  <Th right>30D Hit</Th>
                </tr>
              </thead>
              <tbody>
                {bySector.map((row, i) => (
                  <tr key={row.sector} style={{ background: i % 2 === 0 ? D.card : D.el }}>
                    <Td><span style={{ color: D.text }}>{row.sector || '—'}</span></Td>
                    <Td right mono>{row.snapshot_count.toLocaleString()}</Td>
                    <Td right mono>{row.complete_count.toLocaleString()}</Td>
                    <Td right mono>
                      <span style={{ color: pctColor(row.avg_forecast_30d_upside_pct) }}>
                        {fmtPctSigned(row.avg_forecast_30d_upside_pct)}
                      </span>
                    </Td>
                    <Td right mono>
                      <span style={{ color: pctColor(row.avg_return_5d_pct) }}>
                        {fmtPctSigned(row.avg_return_5d_pct)}
                      </span>
                    </Td>
                    <Td right mono>
                      <span style={{ color: pctColor(row.avg_return_10d_pct) }}>
                        {fmtPctSigned(row.avg_return_10d_pct)}
                      </span>
                    </Td>
                    <Td right mono>
                      <span style={{ color: pctColor(row.avg_return_30d_pct) }}>
                        {fmtPctSigned(row.avg_return_30d_pct)}
                      </span>
                    </Td>
                    <Td right mono>{fmtPct(row.hit_rate_30d_pct)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </div>

        {/* Section 5 — Risk */}
        <div style={{
          background: D.card, border: `1px solid ${D.border}`,
          borderRadius: 8, overflow: 'hidden',
        }}>
          <div style={{ padding: '24px 24px 0' }}>
            <SectionLabel tag="Performance by Risk" title="Risk Level Results" />
          </div>
          {byRisk.length === 0 ? (
            <div style={{ padding: '0 24px 24px', fontSize: 13, color: D.textMuted }}>No risk data available.</div>
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Risk Level</Th>
                  <Th right>Count</Th>
                  <Th right>Done</Th>
                  <Th right>Forecast</Th>
                  <Th right>Avg 5D</Th>
                  <Th right>Avg 10D</Th>
                  <Th right>Avg 30D</Th>
                  <Th right>30D Hit</Th>
                </tr>
              </thead>
              <tbody>
                {byRisk.map((row, i) => (
                  <tr key={row.risk_level} style={{ background: i % 2 === 0 ? D.card : D.el }}>
                    <Td><span style={{ color: D.text }}>{row.risk_level || '—'}</span></Td>
                    <Td right mono>{row.snapshot_count.toLocaleString()}</Td>
                    <Td right mono>{row.complete_count.toLocaleString()}</Td>
                    <Td right mono>
                      <span style={{ color: pctColor(row.avg_forecast_30d_upside_pct) }}>
                        {fmtPctSigned(row.avg_forecast_30d_upside_pct)}
                      </span>
                    </Td>
                    <Td right mono>
                      <span style={{ color: pctColor(row.avg_return_5d_pct) }}>
                        {fmtPctSigned(row.avg_return_5d_pct)}
                      </span>
                    </Td>
                    <Td right mono>
                      <span style={{ color: pctColor(row.avg_return_10d_pct) }}>
                        {fmtPctSigned(row.avg_return_10d_pct)}
                      </span>
                    </Td>
                    <Td right mono>
                      <span style={{ color: pctColor(row.avg_return_30d_pct) }}>
                        {fmtPctSigned(row.avg_return_30d_pct)}
                      </span>
                    </Td>
                    <Td right mono>{fmtPct(row.hit_rate_30d_pct)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </div>
      </div>

      {/* ── Section 6: Signal log ─────────────────────────────────────────── */}
      <div style={{
        background: D.card, border: `1px solid ${D.border}`,
        borderRadius: 8, overflow: 'hidden',
      }}>
        <div style={{
          padding: '24px 24px 0',
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'flex-end', flexWrap: 'wrap', gap: 12,
        }}>
          <SectionLabel tag="Signal Log · Most Recent" title="Signal Snapshot History" />
          <div style={{
            fontSize: 11, fontFamily: D.mono, color: D.textMuted,
            marginBottom: 20, whiteSpace: 'nowrap' as const,
          }}>
            Showing {signalLog.length.toLocaleString()} of {snapshots.length.toLocaleString()}
          </div>
        </div>

        <TableShell>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Symbol</Th>
              <Th>Company</Th>
              <Th>Sector</Th>
              <Th right>Forecast</Th>
              <Th>Signal</Th>
              <Th>Risk</Th>
              <Th right>5D Result</Th>
              <Th right>10D Result</Th>
              <Th right>30D Result</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {signalLog.map((row, i) => {
              const sig  = resolveSignal(row)
              const chip = signalChip(sig)
              return (
                <tr
                  key={`${row.snapshot_date}-${row.symbol}`}
                  style={{ background: i % 2 === 0 ? D.card : D.el }}
                >
                  <Td mono>{row.snapshot_date || '—'}</Td>
                  <Td>
                    <span style={{ fontFamily: D.mono, fontWeight: 600, color: D.text }}>
                      {row.symbol || '—'}
                    </span>
                  </Td>
                  <Td>
                    <span style={{
                      color: D.textSec,
                      maxWidth: 180, display: 'inline-block',
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap' as const,
                    }}>
                      {row.company_name || '—'}
                    </span>
                  </Td>
                  <Td>
                    <span style={{ color: D.textMuted, fontSize: 12 }}>{row.sector || '—'}</span>
                  </Td>
                  <Td right>
                    <span style={{ fontFamily: D.mono, color: pctColor(row.forecast_30d_upside_pct) }}>
                      {fmtPctSigned(row.forecast_30d_upside_pct)}
                    </span>
                  </Td>
                  <Td>
                    {sig !== '—' ? (
                      <span style={{
                        fontSize: 10, fontFamily: D.mono,
                        color: chip.color, background: chip.bg,
                        border: `1px solid ${chip.color}30`,
                        padding: '2px 7px', borderRadius: 3,
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.05em',
                      }}>
                        {chip.label}
                      </span>
                    ) : (
                      <span style={{ color: D.textMuted, fontSize: 12 }}>—</span>
                    )}
                  </Td>
                  <Td>
                    <span style={{ color: D.textMuted, fontSize: 12 }}>
                      {row.risk_level || '—'}
                    </span>
                  </Td>
                  <Td right>
                    <ResultCell ret={row.return_5d_pct} hit={row.hit_5d} />
                  </Td>
                  <Td right>
                    <ResultCell ret={row.return_10d_pct} hit={row.hit_10d} />
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
        </TableShell>

        {snapshots.length > logLimit && (
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${D.border}`,
            textAlign: 'center' as const,
          }}>
            <button
              onClick={() => setLogLimit(prev => prev + 50)}
              style={{
                fontSize: 12, color: D.blue, background: D.el,
                border: `1px solid rgba(173,198,255,0.20)`,
                padding: '8px 24px', borderRadius: 6,
                cursor: 'pointer', fontFamily: D.body,
              }}
            >
              Load more ({(snapshots.length - logLimit).toLocaleString()} remaining)
            </button>
          </div>
        )}
      </div>

    </div>
  )
}
