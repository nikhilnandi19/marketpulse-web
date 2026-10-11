'use client'

import { useState, useMemo, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
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
const MONO = "[font-family:'JetBrains_Mono',monospace]"
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
  const [bandsLoaded, setBandsLoaded] = useState(false)

  useEffect(() => { loadModelErrorBands().then(setModelErrorBands).finally(() => setBandsLoaded(true)) }, [])

  const sectorOptions = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.sector))).sort()], [companies])
  const signalOptions = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.final_signal))).sort()], [companies])
  const riskOptions   = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.risk_level))).sort()],   [companies])

  const filtered = useMemo(() => companies.filter(c =>
    (filterSector === ALL || c.sector      === filterSector) &&
    (filterSignal === ALL || c.final_signal === filterSignal) &&
    (filterRisk   === ALL || c.risk_level   === filterRisk)
  ), [companies, filterSector, filterSignal, filterRisk])

  const dataDate = useMemo(() => {
    const dates = companies.map(c => c.latest_date).filter(Boolean)
    if (!dates.length) return null
    const [y, m, d] = dates.reduce((a, b) => (a > b ? a : b)).split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }, [companies])

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

  // One description per signal, shown once in the Signals section (copy is revised in a later step).
  const SIGNAL_DESC: Record<string, string> = {
    'Potential Opportunity':                 'A positive forecast backed by a reliable model and a manageable risk profile.',
    'Stable Watchlist':                      'Steady names with no major red flags, but a forecast below the Opportunity bar.',
    'High Volatility Speculative':           'Volatility far above the sector median, which lowers confidence in the forecast.',
    'Needs Further Review':                  'Signals conflict or the data looks unusual, so it needs a closer look.',
    'Weak Fundamentals / Negative Forecast': 'Weak fundamentals together with a negative forecast.',
  }

  const selectClass = `w-full min-h-10 appearance-none rounded-md bg-[#1e2020] py-2 pl-3.5 pr-9 text-[13px] text-[#e2e2e2] ring-1 ring-inset ring-white/10 [@media(hover:hover)]:hover:ring-white/20 [@media(pointer:coarse)]:min-h-11 ${PRESS} ${FOCUS}`

  return (
    <div className="relative font-sans text-[#e2e2e2] antialiased">

      {/* Header */}
      <header className="mb-14 max-w-[720px] lg:mb-16">
        <h1 className="mb-4 text-[clamp(2rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.035em] [text-wrap:balance]">Executive Overview</h1>
        <p className="text-lg leading-relaxed text-[#c2c6d6] [text-wrap:pretty]">
          S&P 500 forecast data, risk scores, and model reliability in one place. Built on real backtested models, not black-box outputs.
        </p>
      </header>

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

      {/* Filters: these change the figures, signals and chart below */}
      <section aria-label="Filters" className="mb-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        {[
          { label: 'Sector', val: filterSector, set: setFilterSector, opts: sectorOptions },
          { label: 'Signal', val: filterSignal, set: setFilterSignal, opts: signalOptions },
          { label: 'Risk',   val: filterRisk,   set: setFilterRisk,   opts: riskOptions   },
        ].map(({ label, val, set, opts }) => (
          <label key={label} className="block sm:min-w-[180px]">
            <span className="mb-1.5 block text-xs text-[#8c909f]">{label}</span>
            <span className="relative block">
              <select value={val} onChange={e => set(e.target.value)} className={selectClass}>
                {opts.map(o => (
                  <option key={o} value={o} className="bg-[#1e2020]">{o}</option>
                ))}
              </select>
              <svg aria-hidden className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8c909f]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
            </span>
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pb-2 sm:ml-auto">
          <span className={`${MONO} text-[11px] text-[#8c909f]`}>{hasFilters ? 'Filtering by' : 'No filters applied'}</span>
          {hasFilters && (
            <>
              <span className={`${MONO} text-[11px] text-[#e2e2e2]`}>
                {[filterSector !== ALL && filterSector, filterSignal !== ALL && filterSignal, filterRisk !== ALL && filterRisk].filter(Boolean).join(', ')}
              </span>
              <button type="button" onClick={() => { setFilterSector(ALL); setFilterSignal(ALL); setFilterRisk(ALL) }}
                className={`min-h-9 rounded-sm px-1.5 text-xs font-medium text-[#F87171] underline decoration-[#F87171]/40 underline-offset-4 [@media(pointer:coarse)]:min-h-11 ${PRESS} ${FOCUS}`}>
                Clear
              </button>
            </>
          )}
        </div>
      </section>

      {/* Key figures: one lead figure, four supporting figures. Shown once. */}
      {k ? (
        <section aria-labelledby="ov-figures" className="mb-16 lg:mb-20">
          <h2 id="ov-figures" className="sr-only">Key figures</h2>
          <div className="grid gap-x-14 gap-y-10 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="text-sm text-[#8c909f]">Average 30-day forecast upside</div>
              <div style={{ color: k.upside >= 0 ? C.positive : C.negative }}
                className="mt-2 text-[clamp(3.25rem,7vw,5rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums">{formatPercent(k.upside)}</div>
              <div className={`${MONO} mt-3 text-[11px] text-[#8c909f]`}>Mean of the model&apos;s forecasts</div>
            </div>
            <ul className="grid grid-cols-2 gap-x-8 gap-y-8 border-t border-white/[0.08] pt-8 lg:col-span-7 lg:border-l lg:border-t-0 lg:pl-14 lg:pt-0">
              {[
                { label: 'Companies',     value: k.companies.toLocaleString(), sub: 'Companies in this dataset', color: '#e2e2e2', clickable: true },
                { label: 'Average forecast error (MAPE)', value: `${k.mape.toFixed(2)}%`, sub: 'Mean across companies', color: C.blue },
                { label: 'Average volatility', value: `${k.vol.toFixed(1)}%`, sub: 'Annualized, mean across companies', color: '#e2e2e2' },
                { label: 'Average profit margin', value: `${k.margin.toFixed(1)}%`, sub: 'Mean across companies', color: '#e2e2e2' },
              ].map(({ label, value, sub, color, clickable }) => {
                const inner = (
                  <>
                    <span className="block text-sm text-[#8c909f]">{label}</span>
                    <span style={{ color }} className="mt-1.5 block text-[clamp(1.75rem,3.2vw,2.25rem)] font-semibold leading-none tracking-[-0.03em] tabular-nums">{value}</span>
                    <span className={`${MONO} mt-2 block text-[10px] ${clickable ? 'text-[#adc6ff]' : 'text-[#8c909f]'}`}>{clickable ? 'View all in Explorer →' : sub}</span>
                  </>
                )
                return clickable ? (
                  <li key={label}>
                    <button type="button" onClick={() => onNavigateToExplorer?.()}
                      className={`-m-2 rounded-lg p-2 text-left [@media(hover:hover)]:hover:bg-white/[0.04] ${PRESS} ${FOCUS}`}>{inner}</button>
                  </li>
                ) : (
                  <li key={label}>{inner}</li>
                )
              })}
            </ul>
          </div>
        </section>
      ) : (
        <section className="mb-16 max-w-[56ch] border-t border-white/[0.08] pt-8 lg:mb-20">
          <p className="text-lg font-medium">No companies match these filters.</p>
          <p className="mt-2 text-sm leading-relaxed text-[#8c909f]">Clear a filter to see the figures again.</p>
        </section>
      )}

      {/* Signals (one list, counts shown once) beside model accuracy */}
      <section className="mb-16 grid gap-x-14 gap-y-14 lg:mb-20 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <h2 className="mb-1 text-xl font-semibold tracking-[-0.02em]">Company count by final signal</h2>
          <p className="mb-5 text-sm text-[#8c909f]">Select a signal to see its companies in Explorer.</p>
          <ul className="border-t border-white/[0.08]">
            {signalData.map(({ name, count }) => {
              const style = SIGNAL_STYLE[name] ?? { barColor: C.grey }
              const widthPct = totalSignal > 0 ? (count / totalSignal) * 100 : 0
              return (
                <li key={name} className="border-b border-white/[0.08]">
                  <button type="button" style={cssVar(style.barColor)} onClick={() => onNavigateToExplorer?.(undefined, name)}
                    aria-label={`${count} companies, ${name}. Open in Explorer`}
                    className={`group grid min-h-14 w-full grid-cols-[1fr_auto] items-start gap-x-4 gap-y-2.5 px-1 py-4 text-left [@media(hover:hover)]:hover:bg-white/[0.03] ${PRESS} ${FOCUS}`}>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2.5 text-[15px] font-medium text-[#e2e2e2]">
                        <span aria-hidden className="size-2 shrink-0 rounded-full bg-[color:var(--c)]" />
                        {name}
                      </span>
                      {SIGNAL_DESC[name] && <span className="mt-1 block pl-[18px] text-xs leading-relaxed text-[#8c909f]">{SIGNAL_DESC[name]}</span>}
                    </span>
                    <span className="text-3xl font-semibold leading-none tracking-[-0.02em] tabular-nums text-[color:var(--c)]">{count}</span>
                    <span className="col-span-2 block h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                      <span className="block h-full rounded-full bg-[color:var(--c)] opacity-80 transition-[width] duration-500 ease-out group-hover:opacity-100 motion-reduce:transition-none" style={{ width: `${widthPct}%` }} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {k && k.opportunity > 0 && (
            <p className="mt-5 max-w-[60ch] text-xs leading-relaxed text-[#8c909f]">
              {k.opportunity} companies are labelled Potential Opportunity, based on the forecast, model reliability, and risk profile.
            </p>
          )}
        </div>

        <div className="min-w-0 lg:col-span-5">
          <h2 className="mb-1 text-xl font-semibold tracking-[-0.02em]">Model error distribution by MAPE band</h2>
          <p className="mb-5 text-sm text-[#8c909f]">MAPE is the model&apos;s average percentage error on past prices. Lower is better.</p>
          {modelErrorBands.length > 0 ? (
            <>
              <div className="border-t border-white/[0.08] pt-6">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={modelErrorBands.map(b => ({
                      name: ({ 'Elite Reliability': 'Elite', 'Very Strong Reliability': 'V. Strong', 'Strong Reliability': 'Strong', 'Moderate Reliability': 'Mod.', 'Higher Error': 'Higher' } as Record<string,string>)[b.model_error_band] ?? b.model_error_band,
                      count: b.company_count,
                      color: MAPE_BAND_COLORS[b.model_error_band] ?? C.blue,
                      full: b.model_error_band,
                    }))}
                    barSize={32} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
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
              </div>
            </>
          ) : bandsLoaded ? (
            <p className="border-t border-white/[0.08] pt-6 text-sm leading-relaxed text-[#8c909f]">The error distribution could not be loaded right now. Reload the page to try again.</p>
          ) : (
            <div aria-busy="true" aria-label="Loading model error distribution" className="border-t border-white/[0.08] pt-6">
              <div className="flex h-[220px] items-end justify-around gap-6 px-6">
                {[40, 100, 55, 8].map((h, i) => (
                  <span key={i} className="block w-8 animate-pulse rounded-t bg-white/[0.07] motion-reduce:animate-none" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Data note */}
      <section aria-labelledby="ov-data" className="mb-24 max-w-[68ch] border-t border-white/[0.08] pt-8">
        <h2 id="ov-data" className="mb-2 text-base font-semibold tracking-[-0.01em]">About this data</h2>
        <p className="m-0 text-[13px] leading-relaxed text-[#8c909f] [text-wrap:pretty]">
          Prices come from Yahoo Finance and are refreshed on weekdays after the US market closes{dataDate ? `. Latest prices: ${dataDate}` : ''}. Company fundamentals such as profit margin come from a static dataset and can lag. {' '}
          {filtered.length === companies.length
            ? `All ${companies.length} companies are shown.`
            : `Showing ${filtered.length} of ${companies.length} companies based on active filters.`}
        </p>
      </section>

    </div>
  )
}
