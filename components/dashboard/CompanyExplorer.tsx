'use client'

import { LIST_NAME_LOWER } from '@/lib/riskLab'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Search, GitBranch, Bot, RotateCcw, Bookmark } from 'lucide-react'
import type { CompanySummary } from '@/lib/types'
import { formatCurrency, getSignalColor } from '@/lib/formatters'

interface Props {
  companies: CompanySummary[]
  onViewForecast: (c: CompanySummary) => void
  onViewAI: (c: CompanySummary) => void
  initialSector?: string
  initialSignal?: string
  /** Symbols currently in the user's watchlist (from useWatchlist). */
  watchedSymbols?: string[]
  /** Called when the user clicks the bookmark toggle for a row. */
  onToggleWatchlist?: (symbol: string) => void
}

type SortKey = keyof CompanySummary
type SortDir = 'asc' | 'desc'
const ALL = 'All'
const PAGE_SIZE = 10

const D = {
  bg:        '#121414',
  surface:   '#1a1c1c',
  container: '#1e2020',
  lowest:    '#0c0f0f',
  border:    'rgba(66,71,84,0.3)',
  primary:   '#adc6ff',
  secondary: '#d0bcff',
  tertiary:  '#4edea3',
  error:     '#ffb4ab',
  orange:    '#fb923c',
  text:      '#e2e2e2',
  textSec:   '#c2c6d6',
  textMuted: '#8c909f',
  mono:      'JetBrains Mono, monospace',
  body:      'Inter, system-ui, sans-serif',
}

const signalShortLabel: Record<string, string> = {
  'Potential Opportunity':                    'OPPORTUNITY',
  'Stable Watchlist':                         'STABLE',
  'High Volatility Speculative':              'HIGH VOL',
  'Needs Further Review':                     'REVIEW',
  'Weak Fundamentals / Negative Forecast':    'RISK WARN',
}

// ── Ticker tape (inside explorer only) ────────────────────────────────────
const TICKER_SYMBOLS = ['AAPL','NVDA','MSFT','TSLA','AMZN','GOOGL','META','AMD','NFLX','CRM',
  'PLTR','SNOW','SHOP','UBER','ABNB','COIN','SPOT','RBLX','ZS','CRWD']

function TickerTape({ companies }: { companies: CompanySummary[] }) {
  const items = useMemo(() => {
    const matched = TICKER_SYMBOLS
      .map(sym => companies.find(c => c.symbol === sym))
      .filter((c): c is CompanySummary => !!c)
    const list = matched.length >= 6 ? matched
      : [...companies].sort((a, b) => Math.abs(b.forecast_30d_upside_pct) - Math.abs(a.forecast_30d_upside_pct)).slice(0, 20)
    return [...list, ...list] // double for seamless loop
  }, [companies])

  if (!items.length) return null

  return (
    <div style={{
      background: D.lowest,
      borderBottom: `1px solid ${D.border}`,
      height: 36,
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      width: '100vw',
      position: 'relative',
      left: '50%',
      right: '50%',
      marginLeft: '-50vw',
      marginRight: '-50vw',
    }}>
      <div style={{
        display: 'flex',
        width: 'max-content',
        animation: 'tickerScroll 40s linear infinite',
        whiteSpace: 'nowrap',
        willChange: 'transform',
      }}>
        {items.map((c, i) => {
          const up = c.forecast_30d_upside_pct
          const color = up >= 0 ? D.tertiary : '#f87171'
          const sign = up >= 0 ? '+' : ''
          return (
            <span key={`${c.symbol}-${i}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              paddingInline: 20,
              borderRight: `1px solid ${D.border}`,
            }}>
              <span style={{ fontSize: 11, fontWeight: 600, fontFamily: D.mono, color: D.text, letterSpacing: '0.04em' }}>{c.symbol}</span>
              <span style={{ fontSize: 11, fontFamily: D.mono, color: D.textMuted }}>${c.latest_price.toFixed(2)}</span>
              <span style={{ fontSize: 11, fontFamily: D.mono, color, fontWeight: 500 }}>{sign}{up.toFixed(1)}%</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

// ── Design constants (the ticker tape above keeps its own, unchanged styling) ───
const SIGNAL_COLOR: Record<string, string> = {
  'Potential Opportunity':                 '#4edea3',
  'Stable Watchlist':                      '#adc6ff',
  'High Volatility Speculative':           '#F59E0B',
  'Needs Further Review':                  '#d0bcff',
  'Weak Fundamentals / Negative Forecast': '#F87171',
}
const RISK_RANK: Record<string, number> = { 'Low Risk': 1, 'Medium Risk': 2, 'High Risk': 3 }

const GLASS =
  'bg-white/[0.04] backdrop-blur-xl ring-1 ring-inset ring-white/[0.08] ' +
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_22px_44px_-28px_rgba(4,8,9,0.95)] ' +
  '[@media(prefers-reduced-transparency:reduce)]:bg-[#1e2020] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#adc6ff]'
const PRESS = 'transition-[transform,background-color,box-shadow,color,opacity] duration-200 ease-out active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:transform-none'
const MONO = "[font-family:'JetBrains_Mono',monospace]"
const RISE = 'animate-[ex-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_backwards] motion-reduce:animate-none'
const GROW = 'animate-[ex-grow_0.6s_cubic-bezier(0.16,1,0.3,1)_backwards] motion-reduce:animate-none'
const FIELD = `min-h-11 w-full rounded-lg bg-white/[0.04] px-3.5 text-[15px] text-[#e2e2e2] ring-1 ring-inset ring-white/10 placeholder:text-[#8c909f] [@media(hover:hover)]:hover:ring-white/20 ${FOCUS}`
const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"
// Pinned first column: opaque so scrolled cells never show through it
const PIN = 'sticky left-0 z-10 bg-[#1a1c1c] shadow-[1px_0_0_rgba(255,255,255,0.08)]'
const cssVar = (hex: string) => ({ '--c': hex } as React.CSSProperties)

export default function CompanyExplorer({
  companies, onViewForecast, onViewAI, initialSector, initialSignal,
  watchedSymbols = [], onToggleWatchlist,
}: Props) {
  const [search, setSearch]         = useState('')
  const [filterSector, setFilterSector] = useState(initialSector ?? ALL)
  const [filterSignal, setFilterSignal] = useState(initialSignal ?? ALL)
  const [filterRisk, setFilterRisk]     = useState(ALL)
  const [upsideMinInput, setUpsideMinInput] = useState('')
  const [upsideMaxInput, setUpsideMaxInput] = useState('')
  const [upsideMin, setUpsideMin]   = useState('')
  const [upsideMax, setUpsideMax]   = useState('')
  const [sortKey, setSortKey]       = useState<SortKey>('forecast_30d_upside_pct')
  const [sortDir, setSortDir]       = useState<SortDir>('desc')
  const [page, setPage]             = useState(0)

  const sectors  = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.sector))).sort()], [companies])
  const signals  = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.final_signal))).sort()], [companies])
  const risks    = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.risk_level))).sort((a, b) => (RISK_RANK[a] ?? 0) - (RISK_RANK[b] ?? 0))], [companies])

  const hasFilters = filterSector !== ALL || filterSignal !== ALL || filterRisk !== ALL || upsideMin !== '' || upsideMax !== '' || search !== ''

  const dataDate = useMemo(() => {
    const dates = companies.map(c => c.latest_date).filter(Boolean)
    if (!dates.length) return null
    const [y, m, d] = dates.reduce((a, b) => (a > b ? a : b)).split('-').map(Number)
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }, [companies])

  const applyUpside = () => { setUpsideMin(upsideMinInput); setUpsideMax(upsideMaxInput); setPage(0) }
  const resetFilters = () => {
    setSearch(''); setFilterSector(ALL); setFilterSignal(ALL); setFilterRisk(ALL)
    setUpsideMinInput(''); setUpsideMaxInput(''); setUpsideMin(''); setUpsideMax('')
    setPage(0)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return companies.filter(c => {
      if (q && !c.symbol.toLowerCase().includes(q) && !c.company_name.toLowerCase().includes(q)) return false
      if (filterSector !== ALL && c.sector !== filterSector) return false
      if (filterSignal !== ALL && c.final_signal !== filterSignal) return false
      if (filterRisk   !== ALL && c.risk_level   !== filterRisk) return false
      if (upsideMin !== '' && c.forecast_30d_upside_pct < parseFloat(upsideMin)) return false
      if (upsideMax !== '' && c.forecast_30d_upside_pct > parseFloat(upsideMax)) return false
      return true
    })
  }, [companies, search, filterSector, filterSignal, filterRisk, upsideMin, upsideMax])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    // Risk sorts by level (Low, Medium, High), not alphabetically.
    if (sortKey === 'risk_level') {
      const d = (RISK_RANK[a.risk_level] ?? 0) - (RISK_RANK[b.risk_level] ?? 0)
      return sortDir === 'asc' ? d : -d
    }
    const av = a[sortKey] as any, bv = b[sortKey] as any
    if (av == null) return 1; if (bv == null) return -1
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortDir === 'asc' ? av - bv : bv - av
  }), [filtered, sortKey, sortDir])

  const paginated  = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE)

  const handleSort = useCallback((key: SortKey) => {
    if (key === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(0)
  }, [sortKey])

  // Top 12 by forecast upside within the current filters, for the ranked list
  const topUpside = useMemo(() =>
    [...filtered]
      .sort((a, b) => b.forecast_30d_upside_pct - a.forecast_30d_upside_pct)
      .slice(0, 12)
  , [filtered])

  // Bars start at 0 and share one scale: the largest absolute upside in the list fills the track
  const scaleMax = useMemo(() => Math.max(...topUpside.map(c => Math.abs(c.forecast_30d_upside_pct)), 0.1), [topUpside])

  const riskColor = (r: string) => r === 'High Risk' ? '#F87171' : r === 'Medium Risk' ? '#F59E0B' : '#4edea3'
  const riskDots  = (r: string) => r === 'High Risk' ? 3 : r === 'Medium Risk' ? 2 : 1
  const riskLabel = (r: string) => r === 'High Risk' ? 'H' : r === 'Medium Risk' ? 'M' : 'L'

  // Fade on the right edge while the table has more columns to scroll to
  const scrollRef = useRef<HTMLDivElement>(null)
  const [moreRight, setMoreRight] = useState(false)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => setMoreRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    check()
    el.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => { el.removeEventListener('scroll', check); window.removeEventListener('resize', check) }
  }, [])

  const columns: { key: SortKey; label: string; align?: 'right' }[] = [
    { key: 'symbol', label: 'Ticker' },
    { key: 'company_name', label: 'Name' },
    { key: 'latest_price', label: 'Price' },
    { key: 'forecast_30d_upside_pct', label: '30-day forecast' },
    { key: 'best_model_mape', label: 'MAPE' },
    { key: 'risk_level', label: 'Risk' },
    { key: 'annualized_volatility_pct', label: 'Volatility' },
    { key: 'profit_margin_pct', label: 'Margin' },
    { key: 'final_signal', label: 'Signal' },
  ]

  const iconBtn = `grid size-9 place-items-center rounded-md text-[#c2c6d6] ring-1 ring-inset ring-white/10 [@media(hover:hover)]:hover:bg-white/[0.08] [@media(hover:hover)]:hover:text-white [@media(pointer:coarse)]:size-11 ${PRESS} ${FOCUS}`
  const pageBtn = `grid h-9 min-w-9 place-items-center rounded-md px-2 text-sm text-[#c2c6d6] ring-1 ring-inset ring-white/10 [@media(hover:hover)]:hover:bg-white/[0.07] disabled:opacity-35 [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11 ${PRESS} ${FOCUS}`

  return (
    <div style={{ fontFamily: D.body }}>

      {/* ── Ticker tape: unchanged, kept on top ─────────────────────────── */}
      <TickerTape companies={companies} />

      {/* Everything below the tape: same page pattern as the Learn and Overview tabs */}
      <div className="relative isolate w-full overflow-hidden bg-[#121414] font-sans text-[#e2e2e2] antialiased">
        <style>{'@keyframes ex-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes ex-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}'}</style>
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-x-0 top-0 h-[640px] bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(60%_80%_at_28%_0%,#000,transparent)]" />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }} />
        </div>

        <div className="mx-auto w-full max-w-[1320px] px-5 sm:px-8 lg:px-14">

          {/* ── Header ─────────────────────────────────────────────────── */}
          <header className="grid gap-x-14 gap-y-8 pb-10 pt-12 sm:pt-14 lg:grid-cols-12 lg:pb-12 lg:pt-16">
            <div className="lg:col-span-7">
              <p className={`${RISE} text-sm text-[#8c909f]`}>S&P 500 screener</p>
              <h1 className={`${RISE} mt-5 text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[1.02] tracking-[-0.045em] [animation-delay:60ms] [text-wrap:balance]`}>
                Company{' '}
                <span className="bg-[linear-gradient(135deg,#d0bcff_0%,#4edea3_100%)] bg-clip-text pb-1 text-transparent">Explorer</span>
              </h1>
              <p className={`${RISE} mt-6 max-w-[48ch] text-lg leading-relaxed text-[#8c909f] [animation-delay:120ms] [text-wrap:pretty]`}>
                Search, filter, and sort every S&P 500 company by forecast, risk, and signal.
              </p>
            </div>
            <aside aria-label="Results summary" className={`${RISE} self-start rounded-2xl p-6 [animation-delay:200ms] sm:p-7 lg:col-span-5 lg:mt-12 ${GLASS}`}>
              <div className="text-[17px] font-medium text-[#c2c6d6]">Companies shown</div>
              <div className="mt-3 flex items-baseline gap-3 text-[clamp(2.75rem,6vw,4rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums">
                <span className="bg-[linear-gradient(135deg,#d0bcff_0%,#4edea3_100%)] bg-clip-text text-transparent">{filtered.length}</span>
                <span className="text-[0.5em] font-normal text-[#8c909f]">of {companies.length}</span>
              </div>
              {dataDate && <p className="mt-5 border-t border-white/[0.08] pt-4 text-[15px] leading-relaxed text-[#8c909f]">Closing prices as of {dataDate}.</p>}
            </aside>
          </header>

          {/* ── Filters ────────────────────────────────────────────────── */}
          <section aria-labelledby="ex-filters" className={`mb-6 rounded-2xl p-5 sm:p-6 ${GLASS}`}>
            <h2 id="ex-filters" className="sr-only">Filters</h2>
            <div className="grid gap-4 sm:grid-cols-6 lg:grid-cols-12">
              <label className="block min-w-0 sm:col-span-6 lg:col-span-5">
                <span className="mb-1.5 block text-sm text-[#8c909f]">Search</span>
                <span className="relative block">
                  <Search size={16} strokeWidth={1.5} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8c909f]" aria-hidden />
                  <input type="text" placeholder="Ticker or company name" value={search}
                    onChange={e => { setSearch(e.target.value); setPage(0) }}
                    className={`${FIELD} pl-10`} />
                </span>
              </label>
              {[
                { label: 'Sector', val: filterSector, set: setFilterSector, opts: sectors, span: 'sm:col-span-2 lg:col-span-2' },
                { label: 'Signal', val: filterSignal, set: setFilterSignal, opts: signals, span: 'sm:col-span-2 lg:col-span-3' },
                { label: 'Risk',   val: filterRisk,   set: setFilterRisk,   opts: risks,   span: 'sm:col-span-2 lg:col-span-2' },
              ].map(({ label, val, set, opts, span }) => (
                <label key={label} className={`block min-w-0 ${span}`}>
                  <span className="mb-1.5 block text-sm text-[#8c909f]">{label}</span>
                  <span className="relative block">
                    <select value={val} onChange={e => { set(e.target.value); setPage(0) }} className={`${FIELD} appearance-none pr-10`}>
                      {opts.map(o => <option key={o} value={o} className="bg-[#1e2020]">{o}</option>)}
                    </select>
                    <svg aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8c909f]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-3 border-t border-white/[0.08] pt-4">
              <fieldset className="m-0 min-w-0 border-0 p-0">
                <legend className="mb-1.5 p-0 text-sm text-[#8c909f]">Forecast upside range (%)</legend>
                <div className="flex flex-wrap items-center gap-2.5">
                  <input type="number" inputMode="decimal" aria-label="Minimum upside percent" placeholder="Min" value={upsideMinInput}
                    onChange={e => setUpsideMinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyUpside()}
                    className={`${FIELD} !w-24 text-center ${MONO}`} />
                  <span className="text-sm text-[#8c909f]">to</span>
                  <input type="number" inputMode="decimal" aria-label="Maximum upside percent" placeholder="Max" value={upsideMaxInput}
                    onChange={e => setUpsideMaxInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyUpside()}
                    className={`${FIELD} !w-24 text-center ${MONO}`} />
                  <button type="button" onClick={applyUpside}
                    className={`min-h-11 rounded-lg bg-[#adc6ff] px-5 text-sm font-semibold text-[#002e6a] [@media(hover:hover)]:hover:brightness-110 ${PRESS} ${FOCUS}`}>
                    Apply
                  </button>
                </div>
              </fieldset>
              {hasFilters && (
                <button type="button" onClick={resetFilters}
                  className={`ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-[#F87171] [@media(hover:hover)]:hover:bg-[#F87171]/10 ${PRESS} ${FOCUS}`}>
                  <RotateCcw size={14} strokeWidth={1.5} aria-hidden /> Reset filters
                </button>
              )}
            </div>
          </section>

          {/* ── Table ──────────────────────────────────────────────────── */}
          <section aria-labelledby="ex-table" className={`mb-12 overflow-hidden rounded-2xl lg:mb-14 ${GLASS}`}>
            <h2 id="ex-table" className="sr-only">Companies</h2>
            <div className="relative">
            <div ref={scrollRef} role="region" aria-label="Companies table, scrolls sideways" tabIndex={0} className={`overflow-x-auto ${FOCUS} focus-visible:-outline-offset-2`}>
              <table className="w-full min-w-[1040px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.08]">
                    {columns.map((col, i) => {
                      const active = sortKey === col.key
                      const th = (
                        <th key={col.key} scope="col" aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                          className={`px-1 py-1.5 ${i === 0 ? `${PIN} pl-3` : ''}`}>
                          <button type="button" onClick={() => handleSort(col.key)}
                            className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap [@media(hover:hover)]:hover:bg-white/[0.06] [@media(pointer:coarse)]:min-h-11 ${active ? 'text-[#adc6ff]' : 'text-[#8c909f]'} ${PRESS} ${FOCUS}`}>
                            {col.label}
                            <span aria-hidden className={`text-xs ${active ? 'opacity-100' : 'opacity-30'}`}>{active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                          </button>
                        </th>
                      )
                      return th
                    })}
                    <th scope="col" className="px-4 py-3.5 text-sm font-medium text-[#8c909f]">Open</th>
                    <th scope="col" className="px-2 py-3.5 pr-5 text-sm font-medium text-[#8c909f]">Save</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(c => {
                    const up = c.forecast_30d_upside_pct
                    const rc = riskColor(c.risk_level)
                    const rd = riskDots(c.risk_level)
                    const sc = SIGNAL_COLOR[c.final_signal] ?? '#8c909f'
                    const slabel = signalShortLabel[c.final_signal] ?? c.final_signal
                    const watched = watchedSymbols.includes(c.symbol)
                    const mapeColor = c.best_model_mape < 2 ? '#4edea3' : c.best_model_mape < 5 ? '#F59E0B' : '#F87171'
                    return (
                      <tr key={c.symbol} className="group border-b border-white/[0.06] last:border-b-0 [@media(hover:hover)]:hover:bg-white/[0.035]">
                        <td className={`${MONO} ${PIN} px-4 py-3 pl-6 text-[16px] font-bold whitespace-nowrap text-[#e2e2e2] [@media(hover:hover)]:group-hover:bg-[#202323]`}>{c.symbol}</td>
                        <td className="max-w-[132px] truncate px-3 py-3 text-[15px] sm:max-w-[220px] sm:px-4 text-[#c2c6d6]" title={c.company_name}>{c.company_name}</td>
                        <td className={`${MONO} px-4 py-3 text-[15px] whitespace-nowrap tabular-nums text-[#e2e2e2]`}>{formatCurrency(c.latest_price)}</td>
                        <td className={`${MONO} px-4 py-3 text-[15px] font-semibold whitespace-nowrap tabular-nums ${up >= 0 ? 'text-[#4edea3]' : 'text-[#F87171]'}`}>{up >= 0 ? '+' : ''}{up.toFixed(1)}%</td>
                        <td className={`${MONO} px-4 py-3 text-[15px] whitespace-nowrap tabular-nums`} style={{ color: mapeColor }}>{c.best_model_mape.toFixed(1)}%</td>
                        <td className="px-4 py-3 whitespace-nowrap" title={c.risk_level}>
                          <span className="inline-flex items-center gap-2">
                            <span className="sr-only">{c.risk_level}</span>
                            <span aria-hidden className="flex gap-0.5">
                              {[1, 2, 3].map(d => <span key={d} className="block h-4 w-1 rounded-full" style={{ background: d <= rd ? rc : 'rgba(255,255,255,0.12)' }} />)}
                            </span>
                            <span aria-hidden className={`${MONO} text-xs`} style={{ color: rc }}>{riskLabel(c.risk_level)}</span>
                          </span>
                        </td>
                        <td className={`${MONO} px-4 py-3 text-[15px] whitespace-nowrap tabular-nums text-[#c2c6d6]`}>{c.annualized_volatility_pct.toFixed(1)}%</td>
                        <td className={`${MONO} px-4 py-3 text-[15px] whitespace-nowrap tabular-nums text-[#c2c6d6]`}>{c.profit_margin_pct != null ? `${c.profit_margin_pct.toFixed(1)}%` : 'n/a'}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span style={cssVar(sc)} className={`${MONO} inline-block rounded-[4px] bg-[color:color-mix(in_srgb,var(--c)_10%,transparent)] px-2 py-1 text-[11px] font-medium text-[color:var(--c)] ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--c)_30%,transparent)]`}>{slabel}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex gap-1.5">
                            <button type="button" onClick={() => onViewForecast(c)} aria-label={`View forecast for ${c.symbol}`} title="View forecast" className={`${iconBtn} text-[#adc6ff]`}>
                              <GitBranch size={15} strokeWidth={1.5} aria-hidden />
                            </button>
                            <button type="button" onClick={() => onViewAI(c)} aria-label={`Ask AI about ${c.symbol}`} title="Ask AI" className={`${iconBtn} text-[#d0bcff]`}>
                              <Bot size={15} strokeWidth={1.5} aria-hidden />
                            </button>
                          </div>
                        </td>
                        <td className="px-2 py-3 pr-5 whitespace-nowrap">
                          <button type="button" aria-pressed={watched}
                            onClick={e => { e.stopPropagation(); onToggleWatchlist?.(c.symbol) }}
                            title={watched ? `Remove ${c.symbol} from ${LIST_NAME_LOWER}` : `Add ${c.symbol} to ${LIST_NAME_LOWER}`}
                            aria-label={watched ? `Remove ${c.symbol} from ${LIST_NAME_LOWER}` : `Add ${c.symbol} to ${LIST_NAME_LOWER}`}
                            className={`${iconBtn} ${watched ? '!bg-[#d0bcff]/15 !text-[#d0bcff] !ring-[#d0bcff]/40' : ''}`}>
                            <Bookmark size={15} strokeWidth={1.5} fill={watched ? '#d0bcff' : 'none'} aria-hidden />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {!paginated.length && (
                    <tr><td colSpan={11} className="px-6 py-14 text-center">
                      {companies.length === 0 ? (
                        <p className="text-lg font-medium text-[#e2e2e2]">Company data isn&apos;t available right now.</p>
                      ) : (
                        <>
                          <p className="text-lg font-medium text-[#e2e2e2]">No companies match your filters.</p>
                          <p className="mt-1.5 text-[15px] text-[#8c909f]">Try widening the upside range, or show all {companies.length} companies.</p>
                          <button type="button" onClick={resetFilters}
                            className={`mt-5 inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#adc6ff] px-5 text-sm font-semibold text-[#002e6a] [@media(hover:hover)]:hover:brightness-110 ${PRESS} ${FOCUS}`}>
                            <RotateCcw size={14} strokeWidth={1.5} aria-hidden /> Reset filters
                          </button>
                        </>
                      )}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div aria-hidden className={`pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#121414]/80 to-transparent transition-opacity duration-200 motion-reduce:transition-none ${moreRight ? 'opacity-100' : 'opacity-0'}`} />
            </div>

            {/* Pagination */}
            <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-5 py-3.5">
              <span className="text-sm tabular-nums text-[#8c909f]">
                Showing {sorted.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, sorted.length)}` : '0'} of {sorted.length} {sorted.length === 1 ? 'company' : 'companies'}
              </span>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} aria-label="Previous page" className={pageBtn}>‹</button>
                <span className="px-2 text-sm tabular-nums text-[#c2c6d6] sm:hidden">Page {Math.min(page + 1, Math.max(totalPages, 1))} of {Math.max(totalPages, 1)}</span>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                  const on = p === page
                  return (
                    <button key={p} type="button" onClick={() => setPage(p)} aria-current={on ? 'page' : undefined} aria-label={`Page ${p + 1}`}
                      className={`${pageBtn} max-sm:hidden tabular-nums ${on ? '!bg-[#adc6ff]/15 !text-[#adc6ff] !ring-[#adc6ff]/50' : ''}`}>{p + 1}</button>
                  )
                })}
                {totalPages > 5 && page < totalPages - 3 && (
                  <>
                    <span aria-hidden className="px-1 text-sm text-[#8c909f] max-sm:hidden">…</span>
                    <button type="button" onClick={() => setPage(totalPages - 1)} aria-label={`Page ${totalPages}`} className={`${pageBtn} max-sm:hidden tabular-nums`}>{totalPages}</button>
                  </>
                )}
                <button type="button" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} aria-label="Next page" className={pageBtn}>›</button>
              </div>
            </nav>
          </section>

          {/* ── Top companies: ranked list on a true 0-based scale ─────────── */}
          <section aria-labelledby="ex-top" className={`mb-20 rounded-2xl p-5 sm:p-7 ${GLASS}`}>
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
              <div>
                <h2 id="ex-top" className="text-2xl font-semibold tracking-[-0.02em] text-[#e2e2e2] sm:text-[28px]">Top forecast upside</h2>
                <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-[#8c909f]">
                  {topUpside.length === 0 ? 'Companies ranked by 30-day forecast upside appear here.' : `${topUpside.length === 1 ? 'The company' : `The ${topUpside.length} companies`} with the highest 30-day forecast upside under your current filters. Every bar starts at 0%, so lengths compare directly.`}
                </p>
              </div>
              {topUpside.length > 0 && <p className="text-sm tabular-nums text-[#8c909f]">Full bar = {scaleMax.toFixed(1)}%</p>}
            </div>

            {topUpside.length === 0 ? (
              <p className="mt-8 rounded-xl bg-white/[0.03] px-5 py-10 text-center text-[15px] text-[#8c909f]">No companies to rank. Change or reset the filters above.</p>
            ) : (
              <ol className="mt-6 grid gap-1">
                {topUpside.map((c, i) => {
                  const pct = c.forecast_30d_upside_pct
                  const width = Math.max(1.5, (Math.abs(pct) / scaleMax) * 100)
                  const color = pct >= 0 ? '#4edea3' : '#F87171'
                  return (
                    <li key={c.symbol}>
                      <button type="button" onClick={() => onViewForecast(c)}
                        aria-label={`View forecast for ${c.symbol}, ${c.company_name}, ${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% forecast`}
                        className={`grid min-h-11 w-full grid-cols-[3.75rem_minmax(0,1fr)_4rem] items-center gap-x-2 rounded-lg px-1.5 py-1.5 text-left sm:grid-cols-[1.75rem_4.5rem_11rem_minmax(0,1fr)_4.75rem] sm:gap-x-4 sm:px-3 [@media(hover:hover)]:hover:bg-white/[0.05] ${PRESS} ${FOCUS}`}>
                        <span aria-hidden className={`${MONO} hidden text-sm tabular-nums text-[#8c909f] sm:block`}>{i + 1}</span>
                        <span className={`${MONO} text-[15px] font-bold text-[#e2e2e2]`}>{c.symbol}</span>
                        <span className="hidden truncate text-[15px] text-[#c2c6d6] sm:block">{c.company_name}</span>
                        <span aria-hidden className="relative h-3 overflow-hidden rounded-full bg-white/[0.06]">
                          <span className={`absolute inset-y-0 left-0 origin-left rounded-full ${GROW}`}
                            style={{ width: `${width}%`, background: color, animationDelay: `${i * 30}ms` }} />
                        </span>
                        <span className={`${MONO} text-right text-[15px] font-semibold tabular-nums`} style={{ color }}>{pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

        </div>
      </div>
    </div>
  )
}
