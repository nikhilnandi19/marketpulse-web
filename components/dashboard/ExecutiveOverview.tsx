'use client'

import { useState, useMemo, useEffect } from 'react'
import { Building2, Ruler, Gauge, Percent } from 'lucide-react'
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

// Colours come from the Learn tab palette. Every signal has its own colour, used the same way everywhere on this page.
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
const RISE = 'animate-[ov-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_backwards] motion-reduce:animate-none'
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"
const cssVar = (hex: string) => ({ '--c': hex } as React.CSSProperties)

const SIGNAL_STYLE: Record<string, { barColor: string }> = {
  'Potential Opportunity':                   { barColor: C.positive },
  'Stable Watchlist':                        { barColor: C.blue     },
  'High Volatility Speculative':             { barColor: C.amber    },
  'Needs Further Review':                    { barColor: C.lilac    },
  'Weak Fundamentals / Negative Forecast':   { barColor: C.negative },
}

const MAPE_BAND_COLORS: Record<string, string> = {
  'Elite Reliability':       C.positive,
  'Very Strong Reliability': C.blue,
  'Strong Reliability':      C.lilac,
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

  const selectClass = `w-full min-h-11 appearance-none rounded-lg py-2 pl-4 pr-10 text-[15px] text-[#e2e2e2] ${GLASS} [@media(hover:hover)]:hover:bg-white/[0.07] ${PRESS} ${FOCUS}`

  const stats = k ? [
    { label: 'Companies',                     value: k.companies.toLocaleString(), sub: 'Companies in this dataset',          color: C.lilac,    Icon: Building2, clickable: true },
    { label: 'Average forecast error (MAPE)', value: `${k.mape.toFixed(2)}%`,      sub: 'Mean across companies',               color: C.blue,     Icon: Ruler },
    { label: 'Average volatility',            value: `${k.vol.toFixed(1)}%`,       sub: 'Annualized, mean across companies',   color: C.amber,    Icon: Gauge },
    { label: 'Average profit margin',         value: `${k.margin.toFixed(1)}%`,    sub: 'Mean across companies',               color: C.positive, Icon: Percent },
  ] : []

  return (
    <div className="relative isolate min-h-dvh w-full overflow-hidden bg-[#121414] font-sans text-[#e2e2e2] antialiased">
      <style>{'@keyframes ov-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}'}</style>

      {/* Depth for the glass: the same faint line grid and grain as the Learn tab. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-x-0 top-0 h-[680px] bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(60%_80%_at_28%_0%,#000,transparent)]" />
        <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }} />
      </div>

      <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-14">

        {/* Header: the same pattern as the Learn tab. Title and filters on the left, the lead figure on the right. */}
        <header className="grid gap-x-14 gap-y-10 pb-12 pt-14 sm:pt-16 lg:grid-cols-12 lg:pb-16 lg:pt-24">
          <div className="lg:col-span-7">
            <p className={`${RISE} text-sm text-[#8c909f]`}>Market overview</p>
            <h1 className={`${RISE} mt-5 text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[1.02] tracking-[-0.045em] [animation-delay:60ms] [text-wrap:balance]`}>
              Executive{' '}
              <span className="bg-[linear-gradient(135deg,#d0bcff_0%,#4edea3_100%)] bg-clip-text pb-1 text-transparent">Overview</span>
            </h1>
            <p className={`${RISE} mt-6 max-w-[48ch] text-lg leading-relaxed text-[#8c909f] [animation-delay:120ms] [text-wrap:pretty]`}>
              S&P 500 forecast data, risk scores, and model reliability in one place. Built on real backtested models, not black-box outputs.
            </p>

            {/* Filters: these change the figures, signals and chart below */}
            <section aria-label="Filters" className={`${RISE} mt-9 [animation-delay:180ms]`}>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: 'Sector', val: filterSector, set: setFilterSector, opts: sectorOptions },
                  { label: 'Signal', val: filterSignal, set: setFilterSignal, opts: signalOptions },
                  { label: 'Risk',   val: filterRisk,   set: setFilterRisk,   opts: riskOptions   },
                ].map(({ label, val, set, opts }) => (
                  <label key={label} className="block min-w-0">
                    <span className="mb-1.5 block text-sm text-[#8c909f]">{label}</span>
                    <span className="relative block">
                      <select value={val} onChange={e => set(e.target.value)} className={selectClass}>
                        {opts.map(o => (
                          <option key={o} value={o} className="bg-[#1e2020]">{o}</option>
                        ))}
                      </select>
                      <svg aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8c909f]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#8c909f]">
                <span>{hasFilters ? 'Filtering by' : 'No filters applied'}</span>
                {hasFilters && (
                  <>
                    <span className="text-[#e2e2e2]">{[filterSector !== ALL && filterSector, filterSignal !== ALL && filterSignal, filterRisk !== ALL && filterRisk].filter(Boolean).join(', ')}</span>
                    <button type="button" onClick={() => { setFilterSector(ALL); setFilterSignal(ALL); setFilterRisk(ALL) }}
                      className={`min-h-9 rounded-sm px-1.5 font-medium text-[#F87171] underline decoration-[#F87171]/40 underline-offset-4 [@media(pointer:coarse)]:min-h-11 ${PRESS} ${FOCUS}`}>
                      Clear
                    </button>
                  </>
                )}
              </div>
            </section>
          </div>

          {/* Lead figure */}
          <aside aria-label="Lead figure" className={`${RISE} self-start rounded-2xl p-7 [animation-delay:240ms] sm:p-8 lg:col-span-5 lg:mt-24 ${GLASS}`}>
            {k ? (
              <>
                <div className="text-[17px] font-medium text-[#c2c6d6]">Average 30-day forecast upside</div>
                <div className={`mt-4 pb-1 text-[clamp(3.75rem,8vw,5.5rem)] font-semibold leading-none tracking-[-0.045em] tabular-nums ${k.upside >= 0 ? 'bg-[linear-gradient(135deg,#d0bcff_0%,#4edea3_100%)] bg-clip-text text-transparent' : 'text-[#F87171]'}`}>{formatPercent(k.upside)}</div>
                <p className="mt-5 border-t border-white/[0.08] pt-4 text-[15px] leading-relaxed text-[#8c909f]">
                  Mean of the model&apos;s 30-day forecasts across {k.companies.toLocaleString()} {k.companies === 1 ? 'company' : 'companies'}.
                </p>
              </>
            ) : (
              <>
                <p className="text-xl font-medium">No companies match these filters.</p>
                <p className="mt-2 text-[15px] leading-relaxed text-[#8c909f]">Clear a filter to see the figures again.</p>
              </>
            )}
          </aside>
        </header>

        {/* Supporting figures: one glass panel, four figures */}
        {k && (
          <section aria-labelledby="ov-figures" className="mb-12 lg:mb-14">
            <h2 id="ov-figures" className="sr-only">Key figures</h2>
            <ul className={`grid grid-cols-2 overflow-hidden rounded-2xl lg:grid-cols-4 lg:divide-x lg:divide-white/[0.08] ${GLASS}`}>
              {stats.map(({ label, value, sub, color, Icon, clickable }, i) => {
                const inner = (
                  <>
                    <span style={cssVar(color)} className="mb-4 grid size-10 place-items-center rounded-lg bg-[color:color-mix(in_srgb,var(--c)_12%,transparent)] text-[color:var(--c)] ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--c)_22%,transparent)]">
                      <Icon size={18} strokeWidth={1.5} aria-hidden />
                    </span>
                    <span className="block text-[15px] text-[#c2c6d6]">{label}</span>
                    <span className="mt-2 block text-[clamp(1.875rem,4vw,2.75rem)] font-semibold leading-none tracking-[-0.035em] tabular-nums text-[#e2e2e2]">{value}</span>
                    <span className={`${MONO} mt-3 block text-xs ${clickable ? 'text-[#adc6ff]' : 'text-[#8c909f]'}`}>{clickable ? 'View all in Explorer →' : sub}</span>
                  </>
                )
                const cell = `block h-full w-full p-5 text-left sm:p-7 ${i % 2 === 1 ? 'border-l border-white/[0.08] lg:border-l-0' : ''} ${i >= 2 ? 'border-t border-white/[0.08] lg:border-t-0' : ''}`
                return (
                  <li key={label} className="min-w-0">
                    {clickable ? (
                      <button type="button" onClick={() => onNavigateToExplorer?.()} className={`${cell} [@media(hover:hover)]:hover:bg-white/[0.05] ${PRESS} ${FOCUS}`}>{inner}</button>
                    ) : (
                      <div className={cell}>{inner}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )}

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

        {/* Signals (one list, counts shown once) beside model accuracy */}
        <section className="mb-12 grid gap-x-6 gap-y-6 lg:mb-14 lg:grid-cols-12">
          <div className={`min-w-0 rounded-2xl p-6 sm:p-7 lg:col-span-7 ${GLASS}`}>
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">Company count by final signal</h2>
            <p className="mb-4 mt-1.5 text-[15px] text-[#8c909f]">Select a signal to see its companies in Explorer.</p>
            <ul className="border-t border-white/[0.08]">
              {signalData.map(({ name, count }) => {
                const style = SIGNAL_STYLE[name] ?? { barColor: C.grey }
                const widthPct = totalSignal > 0 ? (count / totalSignal) * 100 : 0
                return (
                  <li key={name} className="border-b border-white/[0.08] last:border-b-0">
                    <button type="button" style={cssVar(style.barColor)} onClick={() => onNavigateToExplorer?.(undefined, name)}
                      aria-label={`${count} companies, ${name}. Open in Explorer`}
                      className={`group -mx-3 grid min-h-16 w-[calc(100%+1.5rem)] grid-cols-[1fr_auto] items-start gap-x-4 gap-y-3 rounded-lg px-3 py-4 text-left [@media(hover:hover)]:hover:bg-white/[0.05] ${PRESS} ${FOCUS}`}>
                      <span className="min-w-0">
                        <span className="flex items-center gap-3 text-lg font-medium text-[#e2e2e2]">
                          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[color:var(--c)]" />
                          {name}
                        </span>
                        {SIGNAL_DESC[name] && <span className="mt-1 block pl-[22px] text-sm leading-relaxed text-[#8c909f]">{SIGNAL_DESC[name]}</span>}
                      </span>
                      <span className="text-4xl font-semibold leading-none tracking-[-0.03em] tabular-nums text-[color:var(--c)]">{count}</span>
                      <span className="col-span-2 block h-2 overflow-hidden rounded-full bg-white/[0.07]">
                        <span className="block h-full rounded-full bg-[color:var(--c)] opacity-85 transition-[width] duration-500 ease-out group-hover:opacity-100 motion-reduce:transition-none" style={{ width: `${widthPct}%` }} />
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {k && k.opportunity > 0 && (
              <p className="mt-4 max-w-[60ch] text-sm leading-relaxed text-[#8c909f]">
                {k.opportunity} companies are labelled Potential Opportunity, based on the forecast, model reliability, and risk profile.
              </p>
            )}
          </div>

          <div className={`min-w-0 rounded-2xl p-6 sm:p-7 lg:col-span-5 ${GLASS}`}>
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">Model error by MAPE band</h2>
            <p className="mb-4 mt-1.5 text-[15px] leading-relaxed text-[#8c909f]">MAPE is the model&apos;s average percentage error on past prices. Lower is better.</p>
            {modelErrorBands.length > 0 ? (
              <div className="border-t border-white/[0.08] pt-5">
                <ResponsiveContainer width="100%" height={330}>
                  <BarChart
                    data={modelErrorBands.map(b => ({
                      name: ({ 'Elite Reliability': 'Elite', 'Very Strong Reliability': 'V. Strong', 'Strong Reliability': 'Strong', 'Moderate Reliability': 'Mod.', 'Higher Error': 'Higher' } as Record<string,string>)[b.model_error_band] ?? b.model_error_band,
                      count: b.company_count,
                      color: MAPE_BAND_COLORS[b.model_error_band] ?? C.blue,
                      full: b.model_error_band,
                    }))}
                    barSize={40} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" tick={{ fill: C.grey, fontSize: 12, fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.grey, fontSize: 12 }} axisLine={false} tickLine={false} width={32} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} content={({ active, payload }) => {
                      if (!active || !payload?.length) return null
                      return (
                        <div className={`${MONO} rounded-lg bg-[#1e2020] px-3 py-2 text-xs text-[#e2e2e2] ring-1 ring-white/10`}>
                          <div className="mb-0.5 text-[#8c909f]">{payload[0].payload.full}</div>
                          <div className="font-bold" style={{ color: payload[0].payload.color }}>{payload[0].value} companies</div>
                        </div>
                      )
                    }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {modelErrorBands.map((band, i) => (
                        <Cell key={i} fill={MAPE_BAND_COLORS[band.model_error_band] ?? C.blue} fillOpacity={0.9} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : bandsLoaded ? (
              <p className="border-t border-white/[0.08] pt-5 text-[15px] leading-relaxed text-[#8c909f]">The error distribution could not be loaded right now. Reload the page to try again.</p>
            ) : (
              <div aria-busy="true" aria-label="Loading model error distribution" className="border-t border-white/[0.08] pt-5">
                <div className="flex h-[330px] items-end justify-around gap-6 px-6">
                  {[40, 100, 55, 8].map((h, i) => (
                    <span key={i} className="block w-10 animate-pulse rounded-t bg-white/[0.07] motion-reduce:animate-none" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Data note */}
        <section aria-labelledby="ov-data" className="mb-20 max-w-[72ch] border-t border-white/[0.08] pt-6">
          <h2 id="ov-data" className="mb-2 text-lg font-semibold tracking-[-0.01em] text-[#e2e2e2]">About this data</h2>
          <p className="m-0 text-[15px] leading-relaxed text-[#8c909f] [text-wrap:pretty]">
            Prices come from Yahoo Finance and are refreshed on weekdays after the US market closes{dataDate ? `. Latest prices: ${dataDate}` : ''}. Company fundamentals such as profit margin come from a static dataset and can lag.{' '}
            {filtered.length === companies.length
              ? `All ${companies.length} companies are shown.`
              : `Showing ${filtered.length} of ${companies.length} companies based on active filters.`}
          </p>
        </section>

      </div>
    </div>
  )
}
