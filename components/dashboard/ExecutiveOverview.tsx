'use client'

import { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { TrendingUp, AlertTriangle, Eye, Clock, BarChart2, Activity, CheckCircle } from 'lucide-react'
import type {
  CompanySummary, SectorSummary, KPIs, ModelErrorBand,
  SignalSnapshot, SignalPerformanceSummary,
} from '@/lib/types'
import { formatPercent } from '@/lib/formatters'
import { loadModelErrorBands } from '@/lib/data'
import DailyBriefing from './DailyBriefing'

interface Props {
  companies: CompanySummary[]
  sectors: SectorSummary[]
  kpis: KPIs | null
  onNavigateToExplorer?: (sector?: string, signal?: string) => void
  watchedSymbols?: string[]
  signalSnapshots?: SignalSnapshot[]
  signalSummary?: SignalPerformanceSummary[]
  onNavigateToWatchlist?: () => void
}

const ALL = 'All'

// Graphite Obsidian design tokens
const S = {
  bg:             '#0F1115',
  surface:        'rgba(32, 31, 38, 0.65)',
  surfaceSolid:   '#201f26',
  border:         'rgba(255,255,255,0.10)',
  borderTop:      'rgba(255,255,255,0.20)',
  primary:        '#c6c0ff',
  bronze:         '#CD7F32',
  positive:       '#b0fbca',
  negative:       '#ffb4ab',
  outline:        '#928f9f',
  textPrimary:    '#e5e1eb',
  textSecondary:  '#c8c4d5',
  textMuted:      '#928f9f',
}

function glass(extra: React.CSSProperties = {}): React.CSSProperties {
  return {
    background:          S.surface,
    backdropFilter:      'blur(32px)',
    WebkitBackdropFilter:'blur(32px)',
    border:              `1px solid ${S.border}`,
    borderTop:           `1px solid ${S.borderTop}`,
    borderLeft:          `1px solid ${S.borderTop}`,
    boxShadow:           '0 40px 60px -15px rgba(0,0,0,0.5)',
    borderRadius:        16,
    ...extra,
  }
}

const SIGNAL_STYLE: Record<string, { barColor: string }> = {
  'Potential Opportunity':                   { barColor: S.positive },
  'High Volatility Speculative':             { barColor: S.bronze   },
  'Stable Watchlist':                        { barColor: S.primary  },
  'Needs Further Review':                    { barColor: S.negative },
  'Weak Fundamentals / Negative Forecast':   { barColor: S.outline  },
}

const MAPE_BAND_COLORS: Record<string, string> = {
  'Elite Reliability':       S.positive,
  'Very Strong Reliability': S.primary,
  'Strong Reliability':      S.primary,
  'Moderate Reliability':    S.bronze,
  'Higher Error':            S.negative,
}

export default function ExecutiveOverview({
  companies, sectors, kpis, onNavigateToExplorer,
  watchedSymbols, signalSnapshots, signalSummary, onNavigateToWatchlist,
}: Props) {
  const [filterSector, setFilterSector] = useState(ALL)
  const [filterSignal, setFilterSignal] = useState(ALL)
  const [filterRisk,   setFilterRisk]   = useState(ALL)
  const [modelErrorBands, setModelErrorBands] = useState<ModelErrorBand[]>([])

  useEffect(() => { loadModelErrorBands().then(setModelErrorBands) }, [])

  const sectorOptions = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.sector))).sort()], [companies])
  const signalOptions = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.final_signal))).sort()], [companies])
  const riskOptions   = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.risk_level))).sort()],   [companies])

  const filtered = useMemo(() => companies.filter(c =>
    (filterSector === ALL || c.sector      === filterSector) &&
    (filterSignal === ALL || c.final_signal === filterSignal) &&
    (filterRisk   === ALL || c.risk_level   === filterRisk)
  ), [companies, filterSector, filterSignal, filterRisk])

  const hasFilters = filterSector !== ALL || filterSignal !== ALL || filterRisk !== ALL

  const k = useMemo(() => {
    if (!filtered.length) return null
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0
    return {
      companies:   filtered.length,
      upside:      avg(filtered.map(c => c.forecast_30d_upside_pct)),
      mape:        avg(filtered.map(c => c.best_model_mape)),
      vol:         avg(filtered.map(c => c.annualized_volatility_pct)),
      margin:      avg(filtered.filter(c => c.profit_margin_pct != null).map(c => c.profit_margin_pct!)),
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
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
  }, [filtered])

  const totalSignal = signalData.reduce((s, d) => s + d.count, 0)

  const reliabilityIndex = useMemo(() => {
    if (!modelErrorBands.length) return null
    const total    = modelErrorBands.reduce((s, b) => s + b.company_count, 0)
    const weighted = modelErrorBands.reduce((s, b) => {
      const w = { 'Elite Reliability': 100, 'Very Strong Reliability': 85, 'Strong Reliability': 70, 'Moderate Reliability': 45, 'Higher Error': 20 }
      return s + (w[b.model_error_band as keyof typeof w] ?? 0) * b.company_count
    }, 0)
    return (weighted / (total * 100) * 100).toFixed(1)
  }, [modelErrorBands])

  const selectStyle: React.CSSProperties = {
    background: S.surfaceSolid, border: `1px solid ${S.border}`,
    borderRadius: 9999, padding: '8px 36px 8px 20px', appearance: 'none',
    cursor: 'pointer', fontSize: 12, fontWeight: 600, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: S.textPrimary, fontFamily: 'Inter, sans-serif',
  }

  const SIGNAL_CARDS = k ? [
    { label: 'Opportunities', desc: 'Stocks with adaptive forecast alpha and low variance signals.',    key: 'Potential Opportunity',            Icon: TrendingUp,  accent: S.positive, tag: 'PRIME',  count: k.opportunity },
    { label: 'Speculative',   desc: 'High momentum names with extreme volatility characteristics.',     key: 'High Volatility Speculative',      Icon: AlertTriangle,accent: S.bronze,  tag: 'ALERT',  count: k.speculative },
    { label: 'Stable Watch',  desc: 'Consistent performers with high model confidence scores.',         key: 'Stable Watchlist',                 Icon: Eye,          accent: S.primary, tag: 'SECURE', count: k.watchlist   },
    { label: 'Needs Review',  desc: 'Data points with anomalous patterns requiring manual verification.',key: 'Needs Further Review',            Icon: Clock,        accent: S.negative,tag: 'ACTION', count: k.review      },
  ] : []

  const SHORT_LABEL: Record<string, string> = {
    'Potential Opportunity': 'Opportunity', 'High Volatility Speculative': 'High Vol.',
    'Stable Watchlist': 'Stable Watch.', 'Needs Further Review': 'Needs Review',
    'Weak Fundamentals / Negative Forecast': 'Weak / Neg.',
  }

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', position: 'relative' }}>

      {/* ── Atmospheric orbs ─────────────────────────────────────────────── */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-12%', width: 800, height: 800, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,128,249,0.14) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-12%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(205,127,50,0.10) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 700, letterSpacing: '-0.02em', color: S.textPrimary, marginBottom: 16, lineHeight: 1.1 }}>
            Executive Overview
          </h1>
          <p style={{ fontSize: 18, color: S.textSecondary, maxWidth: 640, lineHeight: 1.65 }}>
            S&P 500 forecast data, risk scores, and model reliability in one place. Built on real backtested models, not black-box outputs.
          </p>
        </section>

        {/* ── Daily Briefing ───────────────────────────────────────────────── */}
        <DailyBriefing
          companies={companies}
          sectors={sectors}
          signalSnapshots={signalSnapshots}
          signalSummary={signalSummary}
          watchedSymbols={watchedSymbols}
          onNavigateToExplorer={onNavigateToExplorer}
          onNavigateToWatchlist={onNavigateToWatchlist}
        />

        {/* ── Filter row ───────────────────────────────────────────────────── */}
        <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          {[
            { label: 'Sector', val: filterSector, set: setFilterSector, opts: sectorOptions },
            { label: 'Signal', val: filterSignal, set: setFilterSignal, opts: signalOptions },
            { label: 'Risk',   val: filterRisk,   set: setFilterRisk,   opts: riskOptions   },
          ].map(({ label, val, set, opts }) => (
            <div key={label} style={{ position: 'relative' }}>
              <select value={val} onChange={e => set(e.target.value)} style={selectStyle}>
                {opts.map(o => (
                  <option key={o} value={o} style={{ background: S.surfaceSolid }}>
                    {o === ALL ? `${label}: All` : o}
                  </option>
                ))}
              </select>
              <svg style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: S.textMuted }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
            </div>
          ))}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: S.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {hasFilters ? 'Filters:' : 'Filters Applied: None'}
            </span>
            {hasFilters && (
              <>
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: S.textPrimary, letterSpacing: '0.05em' }}>
                  {[filterSector !== ALL && filterSector, filterSignal !== ALL && filterSignal, filterRisk !== ALL && filterRisk].filter(Boolean).join(', ')}
                </span>
                <button onClick={() => { setFilterSector(ALL); setFilterSignal(ALL); setFilterRisk(ALL) }}
                  style={{ background: 'none', border: `1px solid rgba(255,180,171,0.35)`, borderRadius: 9999, padding: '5px 14px', color: S.negative, fontSize: 11, letterSpacing: '0.08em', fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
                  CLEAR
                </button>
              </>
            )}
          </div>
        </section>

        {/* ── KPI row ──────────────────────────────────────────────────────── */}
        {k && (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16, marginBottom: 48 }}>
            {[
              { label: 'Companies',     value: k.companies.toLocaleString(), sub: 'Active in universe',  color: S.textPrimary, clickable: true },
              { label: 'Avg 30D Upside',value: formatPercent(k.upside),     sub: 'Model forecast mean', color: k.upside >= 0 ? S.positive : S.negative },
              { label: 'Model MAPE',    value: `${k.mape.toFixed(2)}%`,     sub: 'System error margin', color: S.primary  },
              { label: 'Volatility',    value: `${k.vol.toFixed(1)}%`,      sub: 'Aggregate index',     color: S.textPrimary },
              { label: 'Profit Margin', value: `${k.margin.toFixed(1)}%`,   sub: 'Mean sector yield',   color: S.textPrimary },
            ].map(({ label, value, sub, color, clickable }) => (
              <div key={label}
                onClick={clickable ? () => onNavigateToExplorer?.() : undefined}
                style={{ ...glass({ padding: 24 }), display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 130, cursor: clickable ? 'pointer' : 'default', transition: 'border-color 0.2s' }}
                onMouseEnter={clickable ? e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(198,192,255,0.35)' } : undefined}
                onMouseLeave={clickable ? e => { (e.currentTarget as HTMLElement).style.borderColor = S.border } : undefined}>
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: S.textMuted, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</span>
                <div>
                  <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color, letterSpacing: '-0.02em', marginBottom: 6 }}>{value}</div>
                  <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: clickable ? S.primary : S.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {clickable ? 'View all in Explorer →' : sub}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── Signal category cards ─────────────────────────────────────────── */}
        {k && SIGNAL_CARDS.length > 0 && (
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
            {SIGNAL_CARDS.map(({ label, desc, key, Icon, accent, tag, count }) => (
              <div key={label}
                onClick={() => onNavigateToExplorer?.(undefined, key)}
                style={{ ...glass({ padding: 24, borderLeft: `4px solid ${accent}` }), cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s' }}
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'translateY(-2px)'; el.style.boxShadow = `0 48px 64px -16px rgba(0,0,0,0.6), 0 0 0 1px ${accent}30` }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.transform = 'none'; el.style.boxShadow = '0 40px 60px -15px rgba(0,0,0,0.5)' }}>
                {/* Icon + tag */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                  <Icon size={20} style={{ color: accent }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: accent, background: `${accent}18`, padding: '3px 8px', borderRadius: 4, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '0.08em' }}>{tag}</span>
                </div>
                {/* Count */}
                <div style={{ fontSize: 36, fontWeight: 700, color: accent, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 10 }}>{count}</div>
                {/* Title */}
                <h4 style={{ fontSize: 17, fontWeight: 600, color: S.textPrimary, letterSpacing: '-0.01em', marginBottom: 6, lineHeight: 1.3 }}>{label}</h4>
                {/* Description */}
                <p style={{ fontSize: 12, color: S.textMuted, lineHeight: 1.55, margin: 0 }}>{desc}</p>
              </div>
            ))}
          </section>
        )}

        {/* ── Charts ───────────────────────────────────────────────────────── */}
        <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

          {/* Signal distribution */}
          <div style={{ ...glass({ overflow: 'hidden' }) }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: S.textPrimary, letterSpacing: '-0.01em' }}>Company Count by Final Signal</h3>
              <BarChart2 size={15} style={{ color: S.textMuted }} />
            </div>
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {signalData.map(({ name, count }) => {
                const style = SIGNAL_STYLE[name] ?? { barColor: S.outline }
                const widthPct = totalSignal > 0 ? (count / totalSignal) * 100 : 0
                return (
                  <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                    onClick={() => onNavigateToExplorer?.(undefined, name)}>
                    <span style={{ width: 88, fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: S.textMuted, letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0 }}>
                      {SHORT_LABEL[name] ?? name}
                    </span>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', height: 22, position: 'relative', borderRadius: 4 }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${widthPct}%`, background: style.barColor, borderRadius: 4, transition: 'width 0.6s ease', opacity: 0.75 }} />
                      <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#fff', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{count}</span>
                    </div>
                  </div>
                )
              })}
              {k && k.opportunity > 0 && (
                <div style={{ marginTop: 8, paddingTop: 14, borderTop: `1px solid ${S.border}` }}>
                  <p style={{ fontSize: 12, color: S.textMuted, lineHeight: 1.5, margin: 0 }}>
                    {k.opportunity} companies meet the Potential Opportunity criteria based on adaptive forecast, model reliability, and risk profile.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Model error distribution */}
          <div style={{ ...glass({ overflow: 'hidden' }) }}>
            <div style={{ padding: '16px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: S.textPrimary, letterSpacing: '-0.01em' }}>Model Error Distribution by MAPE Band</h3>
              <Activity size={15} style={{ color: S.textMuted }} />
            </div>
            <div style={{ padding: 32 }}>
              {modelErrorBands.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={192}>
                    <BarChart
                      data={modelErrorBands.map(b => ({
                        name: ({ 'Elite Reliability': 'Elite', 'Very Strong Reliability': 'V. Strong', 'Strong Reliability': 'Strong', 'Moderate Reliability': 'Mod.', 'Higher Error': 'Higher' } as Record<string,string>)[b.model_error_band] ?? b.model_error_band,
                        count: b.company_count,
                        color: MAPE_BAND_COLORS[b.model_error_band] ?? S.primary,
                        full: b.model_error_band,
                      }))}
                      barSize={36} margin={{ top: 16, right: 8, bottom: 8, left: 0 }}>
                      <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
                      <XAxis dataKey="name" tick={{ fill: S.textMuted, fontSize: 9, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: S.textMuted, fontSize: 9 }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div style={{ background: 'rgba(32,31,38,0.96)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: S.textPrimary }}>
                            <div style={{ color: S.textMuted, marginBottom: 2 }}>{payload[0].payload.full}</div>
                            <div style={{ color: payload[0].payload.color, fontWeight: 700 }}>{payload[0].value} companies</div>
                          </div>
                        )
                      }} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {modelErrorBands.map((band, i) => (
                          <Cell key={i} fill={MAPE_BAND_COLORS[band.model_error_band] ?? S.primary} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ paddingTop: 16, borderTop: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: S.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Reliability Index</span>
                    <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: S.primary, fontWeight: 700 }}>{reliabilityIndex}/100</span>
                  </div>
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 192, color: S.textMuted, fontSize: 13 }}>Loading…</div>
              )}
            </div>
          </div>
        </section>

        {/* ── System integrity ──────────────────────────────────────────────── */}
        <section style={{ ...glass({ padding: 32 }), display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <CheckCircle size={14} style={{ color: S.bronze }} />
              <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: S.bronze, letterSpacing: '0.1em', textTransform: 'uppercase' }}>System Integrity · Secure</span>
            </div>
            <h4 style={{ fontSize: 19, fontWeight: 600, color: S.textPrimary, letterSpacing: '-0.01em', marginBottom: 8 }}>Real-time Data Validation</h4>
            <p style={{ fontSize: 13, color: S.textMuted, lineHeight: 1.6, margin: 0 }}>
              Dashboard data sourced from Databricks pipeline.{' '}
              {filtered.length === companies.length
                ? `All ${companies.length} S&P 500 companies loaded. CSV-based static deployment. Refresh for latest exported data.`
                : `Showing ${filtered.length} of ${companies.length} companies based on active filters.`}
            </p>
          </div>
          {k && (
            <div style={{ display: 'flex', gap: 36, flexShrink: 0 }}>
              {[
                { v: k.companies.toLocaleString(), l: 'Co.' },
                { v: formatPercent(k.upside), l: 'Up%' },
                { v: `${k.mape.toFixed(1)}%`, l: 'MAPE' },
                { v: `${k.vol.toFixed(0)}%`, l: 'Vol' },
                { v: `${k.margin.toFixed(0)}%`, l: 'Mgn' },
              ].map(({ v, l }) => (
                <div key={l} style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: S.textPrimary, letterSpacing: '-0.02em', lineHeight: 1 }}>{v}</div>
                  <div style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: S.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 4 }}>{l}</div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  )
}
