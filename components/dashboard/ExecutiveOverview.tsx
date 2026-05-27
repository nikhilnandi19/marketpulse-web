'use client'

import { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, AlertTriangle, Eye, Clock, BarChart2, Activity } from 'lucide-react'
import type { CompanySummary, SectorSummary, KPIs, ModelErrorBand } from '@/lib/types'
import { formatPercent, getSignalColor } from '@/lib/formatters'
import { loadModelErrorBands } from '@/lib/data'

interface Props {
  companies: CompanySummary[]
  sectors: SectorSummary[]
  kpis: KPIs | null
  onNavigateToExplorer?: (sector?: string, signal?: string) => void
}

const ALL = 'All'

// Stitch colors
const S = {
  bg: '#0A0A0B',
  surface: '#070d1f',
  surfaceContainer: '#191f31',
  surfaceHigh: '#23293c',
  border: '#1E293B',
  borderVariant: '#424754',
  primary: '#adc6ff',
  secondary: '#ddb7ff',
  positive: '#10B981',
  warning: '#F59E0B',
  negative: '#EF4444',
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
}

// Signal → Stitch style
const SIGNAL_STYLE: Record<string, { color: string; bg: string; border: string; barColor: string }> = {
  'Potential Opportunity':              { color: S.positive, bg: 'rgba(16,185,129,0.06)', border: S.border, barColor: S.positive },
  'High Volatility Speculative':        { color: S.warning,  bg: 'rgba(245,158,11,0.06)', border: S.border, barColor: S.warning  },
  'Stable Watchlist':                   { color: S.primary,  bg: 'rgba(173,198,255,0.06)', border: S.border, barColor: S.primary  },
  'Needs Further Review':               { color: S.textSecondary, bg: 'rgba(148,163,184,0.06)', border: S.border, barColor: S.textSecondary },
  'Weak Fundamentals / Negative Forecast': { color: S.negative, bg: 'rgba(239,68,68,0.06)', border: S.border, barColor: S.negative },
}

const MAPE_BAND_COLORS: Record<string, string> = {
  'Elite Reliability':        S.positive,
  'Very Strong Reliability':  S.secondary,
  'Strong Reliability':       S.secondary,
  'Moderate Reliability':     S.warning,
  'Higher Error':             S.negative,
}

export default function ExecutiveOverview({ companies, sectors, kpis, onNavigateToExplorer }: Props) {
  const [filterSector, setFilterSector] = useState(ALL)
  const [filterSignal, setFilterSignal] = useState(ALL)
  const [filterRisk, setFilterRisk] = useState(ALL)
  const [modelErrorBands, setModelErrorBands] = useState<ModelErrorBand[]>([])

  useEffect(() => { loadModelErrorBands().then(setModelErrorBands) }, [])

  const sectorOptions = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.sector))).sort()], [companies])
  const signalOptions = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.final_signal))).sort()], [companies])
  const riskOptions   = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.risk_level))).sort()], [companies])

  const filtered = useMemo(() => companies.filter(c =>
    (filterSector === ALL || c.sector === filterSector) &&
    (filterSignal === ALL || c.final_signal === filterSignal) &&
    (filterRisk   === ALL || c.risk_level   === filterRisk)
  ), [companies, filterSector, filterSignal, filterRisk])

  const hasFilters = filterSector !== ALL || filterSignal !== ALL || filterRisk !== ALL

  const k = useMemo(() => {
    if (!filtered.length) return null
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    return {
      companies: filtered.length,
      upside:    avg(filtered.map(c => c.forecast_30d_upside_pct)),
      mape:      avg(filtered.map(c => c.best_model_mape)),
      vol:       avg(filtered.map(c => c.annualized_volatility_pct)),
      margin:    avg(filtered.filter(c => c.profit_margin_pct != null).map(c => c.profit_margin_pct!)),
      opportunity: filtered.filter(c => c.final_signal === 'Potential Opportunity').length,
      speculative: filtered.filter(c => c.final_signal === 'High Volatility Speculative').length,
      watchlist:   filtered.filter(c => c.final_signal === 'Stable Watchlist').length,
      review:      filtered.filter(c => c.final_signal === 'Needs Further Review').length,
      weak:        filtered.filter(c => c.final_signal === 'Weak Fundamentals / Negative Forecast').length,
    }
  }, [filtered])

  const signalData = useMemo(() => {
    const counts: Record<string, number> = {}
    filtered.forEach(c => { counts[c.final_signal] = (counts[c.final_signal] || 0) + 1 })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filtered])

  const totalSignal = signalData.reduce((s, d) => s + d.count, 0)
  const maxMape = Math.max(...modelErrorBands.map(b => b.company_count), 1)

  const reliabilityIndex = useMemo(() => {
    if (!modelErrorBands.length) return null
    const total = modelErrorBands.reduce((s, b) => s + b.company_count, 0)
    const weighted = modelErrorBands.reduce((s, b) => {
      const w = { 'Elite Reliability': 100, 'Very Strong Reliability': 85, 'Strong Reliability': 70, 'Moderate Reliability': 45, 'Higher Error': 20 }
      return s + (w[b.model_error_band as keyof typeof w] ?? 0) * b.company_count
    }, 0)
    return (weighted / (total * 100) * 100).toFixed(1)
  }, [modelErrorBands])

  const filterStyle = {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 16px', border: `1px solid ${S.border}`,
    background: 'transparent', color: S.textPrimary,
    fontSize: 14, fontFamily: 'Inter, sans-serif', cursor: 'pointer',
    borderRadius: 8, transition: 'background 0.15s',
  }

  const cardStyle = {
    background: S.bg, border: `1px solid ${S.border}`,
  }

  return (
    <div style={{ fontFamily: 'Inter, Geist, sans-serif' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 48 }}>
        <h1 style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-0.02em', color: S.textPrimary, marginBottom: 16, lineHeight: 1.1, fontFamily: 'Geist, sans-serif' }}>
          Executive Overview
        </h1>
        <p style={{ fontSize: 16, color: S.textSecondary, maxWidth: 680, lineHeight: 1.6 }}>
          MarketPulse transforms S&P 500 price, risk, and forecast data into explainable market signals.
          Adaptive momentum forecasts and model reliability scores deliver institutional-grade screening clarity.
        </p>
      </section>

      {/* ── Command bar (filters) ─────────────────────────────────────────── */}
      <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 48, paddingBlock: 12, borderTop: `1px solid ${S.border}`, borderBottom: `1px solid ${S.border}` }}>
        {[
          { label: 'Sector', val: filterSector, set: setFilterSector, opts: sectorOptions },
          { label: 'Signal', val: filterSignal, set: setFilterSignal, opts: signalOptions },
          { label: 'Risk',   val: filterRisk,   set: setFilterRisk,   opts: riskOptions   },
        ].map(({ label, val, set, opts }) => (
          <div key={label} style={{ position: 'relative' }}>
            <select value={val} onChange={e => set(e.target.value)}
              style={{ ...filterStyle, paddingRight: 32, appearance: 'none' }}>
              {opts.map(o => (
                <option key={o} value={o} style={{ background: '#191f31' }}>
                  {o === ALL ? `${label}: All` : o}
                </option>
              ))}
            </select>
            <svg style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: S.textSecondary }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        ))}
        <div style={{ width: 1, height: 24, background: S.border, margin: '0 8px' }} />
        <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: S.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          {hasFilters ? `Filters Applied: ${[filterSector !== ALL && filterSector, filterSignal !== ALL && filterSignal, filterRisk !== ALL && filterRisk].filter(Boolean).join(', ')}` : 'Filters Applied: None'}
        </span>
        {hasFilters && (
          <button onClick={() => { setFilterSector(ALL); setFilterSignal(ALL); setFilterRisk(ALL) }}
            style={{ ...filterStyle, color: '#EF4444', borderColor: 'rgba(239,68,68,0.3)', fontSize: 12 }}>
            Clear
          </button>
        )}
      </section>

      {/* ── KPI metrics row ──────────────────────────────────────────────── */}
      {k && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, marginBottom: 48, border: `1px solid ${S.border}` }}>
          {[
            { label: 'Companies',       value: k.companies.toLocaleString(), sub: 'in filtered universe',   color: S.textPrimary },
            { label: 'Avg 30D Upside',  value: formatPercent(k.upside),     sub: 'adaptive momentum',      color: k.upside >= 0 ? S.positive : S.negative },
            { label: 'Avg Model MAPE',  value: `${k.mape.toFixed(2)}%`,     sub: 'best model error rate',  color: S.secondary  },
            { label: 'Avg Volatility',  value: `${k.vol.toFixed(1)}%`,      sub: 'annualized volatility',  color: S.textPrimary },
            { label: 'Avg Profit Margin', value: `${k.margin.toFixed(1)}%`, sub: 'net income / revenue',   color: S.textPrimary },
          ].map(({ label, value, sub, color }, i) => (
            <div key={label} style={{ ...cardStyle, padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 128, borderLeft: i > 0 ? `1px solid ${S.border}` : 'none' }}>
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: S.textSecondary, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {label}
              </span>
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, lineHeight: 1, color, fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em' }}>{value}</div>
                <div style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: S.textSecondary, marginTop: 4 }}>{sub}</div>
              </div>
            </div>
          ))}
        </section>
      )}

      {/* ── Signal segment cards ─────────────────────────────────────────── */}
      {k && (
        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 24, marginBottom: 48 }}>
          {[
            { label: 'Potential Opportunities', count: k.opportunity, key: 'Potential Opportunity',              Icon: TrendingUp, hoverBorder: S.positive,      color: S.positive      },
            { label: 'High Vol. Speculative',   count: k.speculative, key: 'High Volatility Speculative',        Icon: AlertTriangle, hoverBorder: S.warning,   color: S.warning       },
            { label: 'Stable Watchlist',        count: k.watchlist,   key: 'Stable Watchlist',                   Icon: Eye,          hoverBorder: S.primary,    color: S.primary       },
            { label: 'Needs Review',            count: k.review,      key: 'Needs Further Review',               Icon: Clock,        hoverBorder: S.textSecondary, color: S.textSecondary },
          ].map(({ label, count, key, Icon, hoverBorder, color }) => {
            const pct = k.companies > 0 ? Math.round((count / k.companies) * 100) : 0
            return (
              <div key={label}
                onClick={() => onNavigateToExplorer?.(undefined, key)}
                style={{ ...cardStyle, padding: 20, cursor: 'pointer', transition: 'border-color 0.2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = hoverBorder}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = S.border}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontSize: 15, fontWeight: 500, color: S.textPrimary, fontFamily: 'Geist, sans-serif' }}>{label}</span>
                  <Icon size={18} style={{ color }} />
                </div>
                <div style={{ fontSize: 36, fontWeight: 700, color, fontFamily: 'Geist, sans-serif', letterSpacing: '-0.02em', lineHeight: 1 }}>{count}</div>
                <div style={{ width: '100%', background: S.surfaceHigh, height: 2, marginTop: 16 }}>
                  <div style={{ background: color, height: 2, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            )
          })}
        </section>
      )}

      {/* ── Charts section ───────────────────────────────────────────────── */}
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

        {/* Chart 1: Company Count by Final Signal — horizontal bar (Stitch style) */}
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: S.textPrimary, fontFamily: 'Geist, sans-serif' }}>Company Count by Final Signal</h3>
            <BarChart2 size={16} style={{ color: S.textSecondary }} />
          </div>
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {signalData.map(({ name, count }) => {
              const style = SIGNAL_STYLE[name] ?? SIGNAL_STYLE['Needs Further Review']
              const widthPct = totalSignal > 0 ? (count / totalSignal) * 100 : 0
              const shortLabel: Record<string, string> = {
                'Potential Opportunity': 'Opportunity',
                'High Volatility Speculative': 'High Vol. Spec.',
                'Stable Watchlist': 'Stable Watch.',
                'Needs Further Review': 'Needs Review',
                'Weak Fundamentals / Negative Forecast': 'Weak / Negative',
              }
              return (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer' }}
                  onClick={() => onNavigateToExplorer?.(undefined, name)}>
                  <span style={{ width: 100, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: S.textSecondary, letterSpacing: '0.06em', textTransform: 'uppercase', flexShrink: 0 }}>
                    {shortLabel[name] ?? name}
                  </span>
                  <div style={{ flex: 1, background: S.surfaceContainer, height: 24, position: 'relative', borderRadius: 2 }}>
                    <div style={{ position: 'absolute', inset: 0, width: `${widthPct}%`, background: style.barColor, borderRadius: 2, transition: 'width 0.6s ease' }} />
                    <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: '#fff', fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
                      {count}
                    </span>
                  </div>
                </div>
              )
            })}
            <div style={{ marginTop: 8, paddingTop: 16, borderTop: `1px solid ${S.border}` }}>
              <p style={{ fontSize: 13, color: S.textSecondary, lineHeight: 1.5 }}>
                {k && k.opportunity > 0
                  ? `${k.opportunity} companies meet the Potential Opportunity criteria based on adaptive forecast, model reliability, and risk profile.`
                  : 'Adjust filters to explore signal distribution across the S&P 500 universe.'}
              </p>
            </div>
          </div>
        </div>

        {/* Chart 2: Model Error Distribution — Stitch vertical bars */}
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 500, color: S.textPrimary, fontFamily: 'Geist, sans-serif' }}>Model Error Distribution by MAPE Band</h3>
            <Activity size={16} style={{ color: S.textSecondary }} />
          </div>
          <div style={{ padding: 32 }}>
            {modelErrorBands.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={192}>
                  <BarChart
                    data={modelErrorBands.map(b => ({
                      name: { 'Elite Reliability': 'Elite', 'Very Strong Reliability': 'V. Strong', 'Strong Reliability': 'Strong', 'Moderate Reliability': 'Mod.', 'Higher Error': 'Higher' }[b.model_error_band] ?? b.model_error_band,
                      count: b.company_count,
                      color: MAPE_BAND_COLORS[b.model_error_band] ?? S.secondary,
                      full: b.model_error_band,
                    }))}
                    barSize={36}
                    margin={{ top: 16, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="name" tick={{ fill: S.textSecondary, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: S.textSecondary, fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div style={{ background: '#191f31', border: `1px solid ${S.border}`, borderRadius: 6, padding: '8px 12px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: S.textPrimary }}>
                          <div style={{ color: S.textSecondary, marginBottom: 2 }}>{payload[0].payload.full}</div>
                          <div style={{ color: payload[0].payload.color, fontWeight: 700 }}>{payload[0].value} companies</div>
                        </div>
                      )
                    }} />
                    <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                      {modelErrorBands.map((band, i) => (
                        <Cell key={i} fill={MAPE_BAND_COLORS[band.model_error_band] ?? S.secondary} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ paddingTop: 16, borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: S.textSecondary, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Reliability Index
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: S.secondary, fontWeight: 700 }}>
                    {reliabilityIndex}/100
                  </span>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 192, color: S.textSecondary, fontSize: 13 }}>Loading…</div>
            )}
          </div>
        </div>
      </section>

      {/* ── System integrity panel (Stitch) ──────────────────────────────── */}
      <section style={{ marginTop: 24, padding: 24, border: `1px solid ${S.border}`, background: S.surface, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ padding: 12, border: `1px solid ${S.border}`, background: S.bg, borderRadius: 8, flexShrink: 0 }}>
            <Activity size={28} style={{ color: S.secondary }} />
          </div>
          <div>
            <h4 style={{ fontSize: 16, fontWeight: 500, color: S.textPrimary, fontFamily: 'Geist, sans-serif', marginBottom: 4 }}>System Integrity Check</h4>
            <p style={{ fontSize: 13, color: S.textSecondary, lineHeight: 1.5 }}>
              Dashboard data sourced from Databricks pipeline.
              {filtered.length === companies.length
                ? ` All ${companies.length} S&P 500 companies loaded. CSV-based static deployment. Refresh for latest exported data.`
                : ` Showing ${filtered.length} of ${companies.length} companies based on active filters.`}
            </p>
          </div>
        </div>
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 4, overflow: 'hidden', height: 120, background: S.surfaceContainer, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Mini KPI preview matching Stitch screenshot */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0, width: '100%', height: '100%', opacity: 0.6, filter: 'grayscale(0.3)' }}>
            {k && [
              { v: k.companies.toString(), l: 'Co.' },
              { v: formatPercent(k.upside), l: 'Up%' },
              { v: `${k.mape.toFixed(1)}%`, l: 'MAPE' },
              { v: `${k.vol.toFixed(0)}%`, l: 'Vol' },
              { v: `${k.margin.toFixed(0)}%`, l: 'Mgn' },
            ].map(({ v, l }) => (
              <div key={l} style={{ borderRight: `1px solid ${S.border}`, padding: '12px 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4 }}>
                <span style={{ fontSize: 8, color: S.textSecondary, fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: S.textPrimary, fontFamily: 'Geist, sans-serif' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
