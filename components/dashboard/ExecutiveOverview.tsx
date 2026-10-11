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

// Colours come from the Learn tab palette. Each signal keeps one colour everywhere on this page.
const C = {
  positive: '#4edea3',
  negative: '#F87171',
  amber: '#F59E0B',
  blue: '#adc6ff',
  grey: '#8c909f',
}

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#adc6ff]'
const PRESS = 'transition-[transform,background-color,box-shadow,color] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:transform-none'
const HOVER_CARD = '[@media(hover:hover)]:hover:bg-white/[0.055] [@media(hover:hover)]:hover:ring-white/[0.16]'
const MONO = "[font-family:'JetBrains_Mono',monospace]"
const SURFACE = 'rounded-xl bg-white/[0.03] ring-1 ring-inset ring-white/[0.08]'
const cssVar = (hex: string) => ({ '--c': hex } as React.CSSProperties)

const SIGNAL_STYLE: Record<string, { barColor: string }> = {
  'Potential Opportunity':                   { barColor: C.positive },
  'High Volatility Speculative':             { barColor: C.amber    },
  'Stable Watchlist':                        { barColor: C.blue     },
  'Needs Further Review':                    { barColor: C.grey     },
  'Weak Fundamentals / Negative Forecast':   { barColor: C.negative },
}

const MAPE_BAND_COLORS: Record<string, string> = {
  'Elite Reliability':       C.positive,
  'Very Strong Reliability': C.blue,
  'Strong Reliability':      C.blue,
  'Moderate Reliability':    C.amber,
  'Higher Error':            C.negative,
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

  const SIGNAL_CARDS = k ? [
    { label: 'Opportunities', desc: 'Stocks with adaptive forecast alpha and low variance signals.',     key: 'Potential Opportunity',       Icon: TrendingUp,    accent: C.positive, tag: 'PRIME',  count: k.opportunity },
    { label: 'Speculative',   desc: 'High momentum names with extreme volatility characteristics.',      key: 'High Volatility Speculative', Icon: AlertTriangle, accent: C.amber,    tag: 'ALERT',  count: k.speculative },
    { label: 'Stable Watch',  desc: 'Consistent performers with high model confidence scores.',          key: 'Stable Watchlist',            Icon: Eye,           accent: C.blue,     tag: 'SECURE', count: k.watchlist   },
    { label: 'Needs Review',  desc: 'Data points with anomalous patterns requiring manual verification.', key: 'Needs Further Review',        Icon: Clock,         accent: C.grey,     tag: 'ACTION', count: k.review      },
  ] : []

  const SHORT_LABEL: Record<string, string> = {
    'Potential Opportunity': 'Opportunity', 'High Volatility Speculative': 'High Vol.',
    'Stable Watchlist': 'Stable Watch.', 'Needs Further Review': 'Needs Review',
    'Weak Fundamentals / Negative Forecast': 'Weak / Neg.',
  }

  const selectClass = `w-full appearance-none rounded-full bg-[#1e2020] py-2 pl-5 pr-9 text-xs font-medium text-[#e2e2e2] ring-1 ring-inset ring-white/10 [@media(hover:hover)]:hover:ring-white/20 ${PRESS} ${FOCUS}`

  return (
    <div className="relative font-sans text-[#e2e2e2] antialiased">

      {/* Hero */}
      <section className="mb-12">
        <h1 className="mb-4 text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.035em] [text-wrap:balance]">Executive Overview</h1>
        <p className="max-w-[640px] text-lg leading-relaxed text-[#c2c6d6] [text-wrap:pretty]">
          S&P 500 forecast data, risk scores, and model reliability in one place. Built on real backtested models, not black-box outputs.
        </p>
      </section>

      {/* Daily Briefing */}
      <DailyBriefing
        companies={companies}
        sectors={sectors}
        signalSnapshots={signalSnapshots}
        signalSummary={signalSummary}
        watchedSymbols={watchedSymbols}
        onNavigateToExplorer={onNavigateToExplorer}
        onNavigateToWatchlist={onNavigateToWatchlist}
      />

      {/* Filter row */}
      <section aria-label="Filters" className="mb-12 flex flex-wrap items-center gap-3">
        {[
          { label: 'Sector', val: filterSector, set: setFilterSector, opts: sectorOptions },
          { label: 'Signal', val: filterSignal, set: setFilterSignal, opts: signalOptions },
          { label: 'Risk',   val: filterRisk,   set: setFilterRisk,   opts: riskOptions   },
        ].map(({ label, val, set, opts }) => (
          <div key={label} className="relative">
            <select value={val} onChange={e => set(e.target.value)} aria-label={`Filter by ${label.toLowerCase()}`} className={selectClass}>
              {opts.map(o => (
                <option key={o} value={o} className="bg-[#1e2020]">{o === ALL ? `${label}: All` : o}</option>
              ))}
            </select>
            <svg aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8c909f]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-2.5">
          <span className={`${MONO} text-[11px] text-[#8c909f]`}>{hasFilters ? 'Filters:' : 'Filters Applied: None'}</span>
          {hasFilters && (
            <>
              <span className={`${MONO} text-[11px] text-[#e2e2e2]`}>
                {[filterSector !== ALL && filterSector, filterSignal !== ALL && filterSignal, filterRisk !== ALL && filterRisk].filter(Boolean).join(', ')}
              </span>
              <button type="button" onClick={() => { setFilterSector(ALL); setFilterSignal(ALL); setFilterRisk(ALL) }}
                className={`rounded-sm px-1.5 py-1 text-xs font-medium text-[#F87171] underline decoration-[#F87171]/40 underline-offset-4 ${PRESS} ${FOCUS}`}>
                Clear
              </button>
            </>
          )}
        </div>
      </section>

      {/* Key figures */}
      {k && (
        <section aria-labelledby="ov-figures" className="mb-12">
          <h2 id="ov-figures" className="sr-only">Key figures</h2>
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Companies',      value: k.companies.toLocaleString(), sub: 'Active in universe',  color: '#e2e2e2', clickable: true },
              { label: 'Avg 30D Upside', value: formatPercent(k.upside),      sub: 'Model forecast mean', color: k.upside >= 0 ? C.positive : C.negative },
              { label: 'Model MAPE',     value: `${k.mape.toFixed(2)}%`,      sub: 'System error margin', color: C.blue },
              { label: 'Volatility',     value: `${k.vol.toFixed(1)}%`,       sub: 'Aggregate index',     color: '#e2e2e2' },
              { label: 'Profit Margin',  value: `${k.margin.toFixed(1)}%`,    sub: 'Mean sector yield',   color: '#e2e2e2' },
            ].map(({ label, value, sub, color, clickable }) => {
              const inner = (
                <>
                  <span className="text-xs text-[#8c909f]">{label}</span>
                  <span className="block">
                    <span style={{ color }} className="mb-1.5 block text-[32px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</span>
                    <span className={`${MONO} block text-[10px] ${clickable ? 'text-[#adc6ff]' : 'text-[#8c909f]'}`}>{clickable ? 'View all in Explorer →' : sub}</span>
                  </span>
                </>
              )
              const base = `${SURFACE} flex min-h-[130px] flex-col justify-between p-6 text-left`
              return clickable ? (
                <button key={label} type="button" onClick={() => onNavigateToExplorer?.()} className={`${base} ${HOVER_CARD} ${PRESS} ${FOCUS}`}>{inner}</button>
              ) : (
                <div key={label} className={base}>{inner}</div>
              )
            })}
          </div>
        </section>
      )}

      {/* Signal categories */}
      {k && SIGNAL_CARDS.length > 0 && (
        <section aria-labelledby="ov-signals" className="mb-12">
          <h2 id="ov-signals" className="sr-only">Signal categories</h2>
          <div className="grid grid-cols-4 gap-4">
            {SIGNAL_CARDS.map(({ label, desc, key, Icon, accent, tag, count }) => (
              <button key={label} type="button" style={cssVar(accent)} onClick={() => onNavigateToExplorer?.(undefined, key)}
                aria-label={`${count} companies, ${label}. Open in Explorer`}
                className={`${SURFACE} border-l-2 border-l-[color:var(--c)] p-6 text-left [@media(hover:hover)]:hover:-translate-y-0.5 ${HOVER_CARD} ${PRESS} ${FOCUS} motion-reduce:hover:transform-none`}>
                <span className="mb-5 flex items-start justify-between">
                  <Icon size={18} strokeWidth={1.5} className="text-[color:var(--c)]" aria-hidden />
                  <span className={`${MONO} rounded-[4px] bg-[color:color-mix(in_srgb,var(--c)_12%,transparent)] px-2 py-0.5 text-[10px] font-bold text-[color:var(--c)]`}>{tag}</span>
                </span>
                <span className="mb-2.5 block text-4xl font-semibold leading-none tracking-[-0.02em] tabular-nums text-[color:var(--c)]">{count}</span>
                <span className="mb-1.5 block text-[17px] font-semibold leading-tight tracking-[-0.01em] text-[#e2e2e2]">{label}</span>
                <span className="block text-xs leading-relaxed text-[#8c909f]">{desc}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Charts */}
      <section className="mb-6 grid grid-cols-2 gap-4">

        {/* Signal distribution */}
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Company Count by Final Signal</h2>
            <BarChart2 size={15} strokeWidth={1.5} className="text-[#8c909f]" aria-hidden />
          </div>
          <div className="flex flex-col gap-3.5 p-6">
            {signalData.map(({ name, count }) => {
              const style = SIGNAL_STYLE[name] ?? { barColor: C.grey }
              const widthPct = totalSignal > 0 ? (count / totalSignal) * 100 : 0
              return (
                <button key={name} type="button" style={cssVar(style.barColor)} onClick={() => onNavigateToExplorer?.(undefined, name)}
                  aria-label={`${count} companies, ${SHORT_LABEL[name] ?? name}. Open in Explorer`}
                  className={`group flex items-center gap-3 rounded-md text-left ${PRESS} ${FOCUS}`}>
                  <span className={`${MONO} w-[88px] shrink-0 text-[10px] text-[#8c909f]`}>{SHORT_LABEL[name] ?? name}</span>
                  <span className="relative block h-[22px] flex-1 rounded-[4px] bg-white/[0.05]">
                    <span className="absolute inset-y-0 left-0 block rounded-[4px] bg-[color:var(--c)] opacity-70 transition-[width,opacity] duration-500 ease-out group-hover:opacity-90 motion-reduce:transition-none" style={{ width: `${widthPct}%` }} />
                    <span className={`${MONO} absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-white`}>{count}</span>
                  </span>
                </button>
              )
            })}
            {k && k.opportunity > 0 && (
              <div className="mt-2 border-t border-white/[0.08] pt-3.5">
                <p className="m-0 text-xs leading-normal text-[#8c909f]">
                  {k.opportunity} companies meet the Potential Opportunity criteria based on adaptive forecast, model reliability, and risk profile.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Model error distribution */}
        <div className={`${SURFACE} overflow-hidden`}>
          <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Model Error Distribution by MAPE Band</h2>
            <Activity size={15} strokeWidth={1.5} className="text-[#8c909f]" aria-hidden />
          </div>
          <div className="p-8">
            {modelErrorBands.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={192}>
                  <BarChart
                    data={modelErrorBands.map(b => ({
                      name: ({ 'Elite Reliability': 'Elite', 'Very Strong Reliability': 'V. Strong', 'Strong Reliability': 'Strong', 'Moderate Reliability': 'Mod.', 'Higher Error': 'Higher' } as Record<string,string>)[b.model_error_band] ?? b.model_error_band,
                      count: b.company_count,
                      color: MAPE_BAND_COLORS[b.model_error_band] ?? C.blue,
                      full: b.model_error_band,
                    }))}
                    barSize={36} margin={{ top: 16, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: C.grey, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.grey, fontSize: 10 }} axisLine={false} tickLine={false} width={28} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className={`${MONO} rounded-lg bg-[#1e2020] px-3 py-2 text-[11px] text-[#e2e2e2] ring-1 ring-white/10`}>
                          <div className="mb-0.5 text-[#8c909f]">{payload[0].payload.full}</div>
                          <div className="font-bold" style={{ color: payload[0].payload.color }}>{payload[0].value} companies</div>
                        </div>
                      )
                    }} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {modelErrorBands.map((band, i) => (
                        <Cell key={i} fill={MAPE_BAND_COLORS[band.model_error_band] ?? C.blue} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
                  <span className={`${MONO} text-[10px] text-[#8c909f]`}>Reliability Index</span>
                  <span className={`${MONO} text-xs font-bold tabular-nums text-[#adc6ff]`}>{reliabilityIndex}/100</span>
                </div>
              </>
            ) : (
              <div className="flex h-48 items-center justify-center text-[13px] text-[#8c909f]">Loading…</div>
            )}
          </div>
        </div>
      </section>

      {/* System integrity */}
      <section className={`${SURFACE} flex flex-wrap items-center justify-between gap-6 p-8`}>
        <div className="min-w-[280px] flex-1">
          <div className="mb-2.5 flex items-center gap-2">
            <CheckCircle size={14} strokeWidth={1.5} className="text-[#F59E0B]" aria-hidden />
            <span className={`${MONO} text-[11px] text-[#F59E0B]`}>System Integrity · Secure</span>
          </div>
          <h2 className="mb-2 text-xl font-semibold tracking-[-0.01em]">Real-time Data Validation</h2>
          <p className="m-0 text-[13px] leading-relaxed text-[#8c909f]">
            Dashboard data sourced from Databricks pipeline.{' '}
            {filtered.length === companies.length
              ? `All ${companies.length} S&P 500 companies loaded. CSV-based static deployment. Refresh for latest exported data.`
              : `Showing ${filtered.length} of ${companies.length} companies based on active filters.`}
          </p>
        </div>
        {k && (
          <div className="flex shrink-0 gap-9">
            {[
              { v: k.companies.toLocaleString(), l: 'Co.' },
              { v: formatPercent(k.upside), l: 'Up%' },
              { v: `${k.mape.toFixed(1)}%`, l: 'MAPE' },
              { v: `${k.vol.toFixed(0)}%`, l: 'Vol' },
              { v: `${k.margin.toFixed(0)}%`, l: 'Mgn' },
            ].map(({ v, l }) => (
              <div key={l} className="text-right">
                <div className="text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{v}</div>
                <div className={`${MONO} mt-1 text-[10px] text-[#8c909f]`}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  )
}
