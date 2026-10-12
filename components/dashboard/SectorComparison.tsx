'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { SectorSummary } from '@/lib/types'
import SlidingSegmented from '@/components/ui/SlidingSegmented'

interface Props {
  sectors: SectorSummary[]
  /** Opens the Explorer filtered by sector, signal, or both. */
  onNavigateToExplorer?: (sector?: string, signal?: string) => void
}

// The pipeline writes a literal "Unknown" for companies with no sector. It is shown apart from the
// real sectors and left out of the leaders, so it never ranks like a peer.
const UNKNOWN = 'Unknown'

// Same signal names the Explorer filters on, same colours as the Overview tab.
const SIGNALS = [
  { key: 'potential_opportunity_count',       short: 'Opportunity',     explorer: 'Potential Opportunity',                  color: '#4edea3' },
  { key: 'stable_watchlist_count',            short: 'Stable',          explorer: 'Stable Watchlist',                       color: '#adc6ff' },
  { key: 'needs_further_review_count',        short: 'Needs review',    explorer: 'Needs Further Review',                   color: '#d0bcff' },
  { key: 'high_volatility_speculative_count', short: 'High volatility', explorer: 'High Volatility Speculative',            color: '#F59E0B' },
  { key: 'weak_negative_count',               short: 'Weak',            explorer: 'Weak Fundamentals / Negative Forecast',  color: '#F87171' },
] as const
type SignalKey = typeof SIGNALS[number]['key']

const METRICS = [
  { key: 'avg_forecast_30d_upside_pct',    short: 'Upside',      dir: 'desc', fmt: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}%` },
  { key: 'avg_annualized_volatility_pct',  short: 'Volatility',  dir: 'asc',  fmt: (v: number) => `${v.toFixed(1)}%` },
  { key: 'avg_model_mape',                 short: 'Model error', dir: 'asc',  fmt: (v: number) => `${v.toFixed(2)}%` },
  { key: 'avg_profit_margin_pct',          short: 'Margin',      dir: 'desc', fmt: (v: number) => `${v.toFixed(1)}%` },
] as const
type MetricKey = typeof METRICS[number]['key']

// Glass texture shared with the other revamped tabs (see globals.css for reduced transparency).
const GLASS: CSSProperties = {
  background: 'var(--glass-bg, rgba(255,255,255,0.04))',
  backdropFilter: 'var(--glass-blur, blur(24px))', WebkitBackdropFilter: 'var(--glass-blur, blur(24px))',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 22px 44px -28px rgba(4,8,9,0.95)',
  borderRadius: 20,
}
// Tall panels skip the blur: a blur layer that large painted a dark patch over rows in testing,
// and the page behind is flat, so it looks the same.
const GLASS_TALL: CSSProperties = { ...GLASS, backdropFilter: 'none', WebkitBackdropFilter: 'none' }

const RISE = 'animate-[ui-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_backwards] motion-reduce:animate-none'
const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#adc6ff]'
const MONO = "[font-family:'JetBrains_Mono',monospace]"
const ROW_HOVER = '[@media(hover:hover)]:hover:bg-white/[0.04] has-[button:focus-visible]:bg-white/[0.06]'
// Makes the sector name's button cover its whole row, so the row is one click target.
const STRETCH = "after:absolute after:inset-0 after:content-['']"

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const signed = (v: number, d = 0) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`

export default function SectorComparison({ sectors, onNavigateToExplorer }: Props) {
  const reduce = useReducedMotion()
  const [metric, setMetric] = useState<MetricKey>('avg_forecast_30d_upside_pct')
  const [signal, setSignal] = useState<SignalKey>('potential_opportunity_count')
  const go = (sector?: string, sig?: string) => onNavigateToExplorer?.(sector, sig)

  const real = useMemo(() => sectors.filter(s => s.sector !== UNKNOWN), [sectors])
  const unknown = useMemo(() => sectors.find(s => s.sector === UNKNOWN), [sectors])
  const totalCompanies = sum(sectors.map(s => s.number_of_companies))
  const rankedCompanies = sum(real.map(s => s.number_of_companies))
  const signalTotal = (s: SectorSummary) => sum(SIGNALS.map(g => s[g.key]))
  const share = (s: SectorSummary, key: SignalKey) => { const t = signalTotal(s); return t ? (s[key] / t) * 100 : 0 }

  const overall = useMemo(() => {
    const t = sum(sectors.map(signalTotal))
    return Object.fromEntries(SIGNALS.map(g => [g.key, { count: sum(sectors.map(s => s[g.key])), pct: t ? (sum(sectors.map(s => s[g.key])) / t) * 100 : 0 }])) as Record<SignalKey, { count: number; pct: number }>
  }, [sectors])

  const meta = METRICS.find(m => m.key === metric)!
  const sigMeta = SIGNALS.find(g => g.key === signal)!

  // Leaders ignore the "Unknown" group.
  const leaders = useMemo(() => {
    if (!real.length) return []
    const best = (key: MetricKey, dir: 'max' | 'min') => real.reduce((p, c) => (dir === 'max' ? c[key] > p[key] : c[key] < p[key]) ? c : p, real[0])
    const up = best('avg_forecast_30d_upside_pct', 'max'), vol = best('avg_annualized_volatility_pct', 'min')
    const err = best('avg_model_mape', 'min'), mar = best('avg_profit_margin_pct', 'max')
    return [
      { label: 'Highest forecast upside', s: up,  text: `${METRICS[0].fmt(up.avg_forecast_30d_upside_pct)} average`,           color: '#4edea3' },
      { label: 'Lowest volatility',       s: vol, text: `${vol.avg_annualized_volatility_pct.toFixed(1)}% a year`,             color: '#adc6ff' },
      { label: 'Best model fit',          s: err, text: `${err.avg_model_mape.toFixed(2)}% average error`,                    color: '#d0bcff' },
      { label: 'Highest profit margin',   s: mar, text: `${mar.avg_profit_margin_pct.toFixed(1)}% average`,                    color: '#F59E0B' },
    ]
  }, [real])

  // ── Scoreboard ──
  const board = useMemo(() => [...real].sort((a, b) => (meta.dir === 'desc' ? b[metric] - a[metric] : a[metric] - b[metric])), [real, metric, meta.dir])
  const boardAll = unknown ? [...real, unknown] : real
  const maxOf = (key: MetricKey) => Math.max(0.0001, ...boardAll.map(s => Math.max(0, s[key])))
  const hasRange = boardAll.every(s => s.min_forecast_30d_upside_pct != null && s.max_forecast_30d_upside_pct != null)
  const fLo = Math.min(0, ...boardAll.map(s => s.min_forecast_30d_upside_pct ?? s.avg_forecast_30d_upside_pct)) - 1
  const fHi = Math.max(0, ...boardAll.map(s => s.max_forecast_30d_upside_pct ?? s.avg_forecast_30d_upside_pct)) + 1
  const fPos = (v: number) => ((v - fLo) / (fHi - fLo)) * 100

  // ── Signal table: rows ordered by the chosen signal's share ──
  const signalRows = useMemo(() => [...real].sort((a, b) => share(b, signal) - share(a, signal)), [real, signal]) // eslint-disable-line react-hooks/exhaustive-deps
  const diffs = boardAll.map(s => share(s, signal) - overall[signal].pct)
  const dLo = Math.min(-4, ...diffs) - 3
  const dHi = Math.max(4, ...diffs) + 3
  const dPos = (v: number) => ((v - dLo) / (dHi - dLo)) * 100

  const springT = reduce ? { duration: 0 } : { type: 'spring' as const, duration: 0.4, bounce: 0 }
  const scoreCtx = {
    go, fPos, springT,
    maxVol: maxOf('avg_annualized_volatility_pct'), maxMape: maxOf('avg_model_mape'), maxMargin: maxOf('avg_profit_margin_pct'),
  }
  const signalCtx = { go, springT, signal, sigMeta, overallPct: overall[signal].pct, dPos, share, signalTotal }

  if (!sectors.length) {
    return (
      <div style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        <div className="rounded-[20px] p-8 text-[15px] text-[#8c909f]" style={GLASS} role="status">Loading sector data…</div>
      </div>
    )
  }

  return (
    <div className="font-sans text-[#e2e2e2]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <header className="mb-8 grid gap-x-14 gap-y-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <p className={`${RISE} text-sm text-[#8c909f]`}>S&P 500 sectors</p>
          <h1 className={`${RISE} mt-4 text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[1.02] tracking-[-0.045em] [animation-delay:60ms] [text-wrap:balance]`}>
            Sector{' '}
            <span className="bg-[linear-gradient(135deg,#d0bcff_0%,#4edea3_100%)] bg-clip-text pb-1 text-transparent">Comparison</span>
          </h1>
          <p className={`${RISE} mt-5 max-w-[52ch] text-lg leading-relaxed text-[#8c909f] [animation-delay:120ms] [text-wrap:pretty]`}>
            How sectors differ on forecast upside, risk, and signals. Every figure is a simple average across a sector&apos;s companies, not weighted by company size.
          </p>
        </div>
        <aside aria-label="Coverage" className={`${RISE} self-start p-6 [animation-delay:200ms] sm:p-7 lg:col-span-5 lg:mt-10`} style={GLASS}>
          <div className="text-[17px] font-medium text-[#c2c6d6]">Companies in the rankings</div>
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="bg-[linear-gradient(135deg,#d0bcff_0%,#4edea3_100%)] bg-clip-text text-[clamp(2.75rem,6vw,4rem)] font-semibold leading-none tracking-[-0.04em] tabular-nums text-transparent">{rankedCompanies}</span>
            <span className="text-[18px] tracking-normal text-[#8c909f]">across {real.length} sectors</span>
          </div>
          {unknown && (
            <p className="mt-5 border-t border-white/[0.08] pt-4 text-[15px] leading-relaxed text-[#8c909f]">
              {unknown.number_of_companies} more companies have no sector in the data. They are shown apart below and left out of the rankings.
            </p>
          )}
        </aside>
      </header>

      {/* ── Leaders ──────────────────────────────────────────────────────── */}
      <section aria-label="Sector leaders" className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {leaders.map(l => (
          <button key={l.label} type="button" onClick={() => go(l.s.sector)} className={`ui-press rounded-[20px] p-5 text-left ${FOCUS}`} style={GLASS}
            aria-label={`${l.label}: ${l.s.sector}, ${l.text}. Open in Explorer`}>
            <div className="text-sm text-[#8c909f]">{l.label}</div>
            <div className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.02em]">{l.s.sector}</div>
            <div className={`${MONO} mt-1.5 text-[14px] tabular-nums`} style={{ color: l.color }}>{l.text}</div>
          </button>
        ))}
      </section>

      {/* ── Scoreboard ───────────────────────────────────────────────────── */}
      <section aria-labelledby="sc-title" className="mb-4 overflow-hidden" style={GLASS_TALL}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 pb-4 pt-5 sm:px-6">
          <div>
            <h2 id="sc-title" className="text-[22px] font-semibold tracking-[-0.02em]">Sector scoreboard</h2>
            <p className="mt-1 text-sm text-[#8c909f]">Sorted by {meta.short.toLowerCase()}, {meta.dir === 'desc' ? 'highest' : 'lowest'} first.</p>
          </div>
          <div className="flex max-w-full items-center gap-2.5">
            <span className="shrink-0 text-sm text-[#8c909f]">Sort by</span>
            <div className="-m-1 max-w-full overflow-x-auto p-1 [scrollbar-width:none]">
              <SlidingSegmented ariaLabel="Sort sectors by" value={metric} onChange={setMetric} fontSize={13} padX={12} minHeight={30}
                options={METRICS.map(m => ({ value: m.key, label: m.short }))} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div role="table" aria-label="Sectors compared on forecast, volatility, model error, and margin" className="min-w-[860px]">
            <div role="row" className="grid grid-cols-[minmax(150px,1.1fr)_minmax(260px,2.4fr)_repeat(3,minmax(88px,1fr))] items-end gap-x-5 border-y border-white/[0.08] px-5 py-2.5 text-[12px] text-[#8c909f] sm:px-6">
              <div role="columnheader">Sector</div>
              <div role="columnheader">30-day forecast: range and average</div>
              <div role="columnheader">Volatility</div>
              <div role="columnheader">Model error</div>
              <div role="columnheader">Profit margin</div>
            </div>

            <div role="rowgroup">
              {board.map(s => <ScoreRow key={s.sector} s={s} {...scoreCtx} />)}
            </div>
            {unknown && (
              <div role="rowgroup" className="mt-1 border-t border-dashed border-white/[0.14] pt-1">
                <ScoreRow s={unknown} noData {...scoreCtx} />
              </div>
            )}
          </div>
        </div>
        <p className="px-5 pb-5 pt-3 text-[13px] leading-relaxed text-[#8c909f] sm:px-6">
          {hasRange
            ? 'In the forecast column the dot is the sector average, the bar runs from the lowest to the highest forecast among its companies, and the vertical line marks 0%. '
            : 'In the forecast column the dot is the sector average and the vertical line marks 0%. '}
          Model error is the average MAPE of each company&apos;s best model, so lower is better.
        </p>
      </section>

      {/* ── Signal mix ───────────────────────────────────────────────────── */}
      <section aria-labelledby="sg-title" className="mb-4 overflow-hidden" style={GLASS_TALL}>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 pb-4 pt-5 sm:px-6">
          <div>
            <h2 id="sg-title" className="text-[22px] font-semibold tracking-[-0.02em]">Signal mix by sector</h2>
            <p className="mt-1 max-w-[62ch] text-sm leading-relaxed text-[#8c909f]">
              The heatmap shows each sector&apos;s share of companies in every signal. The chart on the right shows how far one signal sits above or below the overall mix.
            </p>
          </div>
          <div className="flex max-w-full items-center gap-2.5">
            <span className="shrink-0 text-sm text-[#8c909f]">Compare</span>
            <div className="-m-1 max-w-full overflow-x-auto p-1 [scrollbar-width:none]">
              <SlidingSegmented ariaLabel="Signal to compare" value={signal} onChange={setSignal} fontSize={13} padX={12} minHeight={30}
                options={SIGNALS.map(g => ({ value: g.key, label: g.short }))} />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div role="table" aria-label="Share of each sector's companies by final signal" className="min-w-[900px]">
            <div role="row" className="grid grid-cols-[150px_repeat(5,minmax(70px,1fr))_minmax(260px,2.6fr)] items-end gap-x-1.5 border-y border-white/[0.08] px-5 py-2.5 text-[12px] text-[#8c909f] sm:px-6">
              <div role="columnheader">Sector</div>
              {SIGNALS.map(g => (
                <div role="columnheader" key={g.key} className={`flex items-center justify-center gap-1.5 text-center leading-tight ${g.key === signal ? 'text-[#e2e2e2]' : ''}`}>
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: g.color }} />{g.short}
                </div>
              ))}
              <div role="columnheader" className="pl-5">{sigMeta.short} vs overall, in percentage points</div>
            </div>

            <div role="rowgroup">
              <div role="row" className="grid grid-cols-[150px_repeat(5,minmax(70px,1fr))_minmax(260px,2.6fr)] items-center gap-x-1.5 px-5 py-1.5 sm:px-6">
                <div role="cell" className="text-[14px] font-medium">All companies<div className={`${MONO} text-[11px] font-normal text-[#8c909f]`}>{totalCompanies} companies</div></div>
                {SIGNALS.map(g => (
                  <div role="cell" key={g.key}>
                    <HeatCell pct={overall[g.key].pct} count={overall[g.key].count} white active={g.key === signal}
                      label={`All companies: ${overall[g.key].pct.toFixed(0)}% ${g.explorer}, ${overall[g.key].count} of ${totalCompanies}. Open in Explorer`}
                      onClick={() => go(undefined, g.explorer)} />
                  </div>
                ))}
                <div role="cell" className="pl-5 text-[13px] text-[#8c909f]">Overall {sigMeta.short.toLowerCase()} share: <span className={`${MONO} text-[#e2e2e2]`}>{overall[signal].pct.toFixed(0)}%</span></div>
              </div>
              <div className="mx-5 border-t border-white/[0.08] sm:mx-6" />
              {signalRows.map(s => <SignalRow key={s.sector} s={s} {...signalCtx} />)}
            </div>
            {unknown && (
              <div role="rowgroup" className="mt-1 border-t border-dashed border-white/[0.14] pt-1">
                <SignalRow s={unknown} noData {...signalCtx} />
              </div>
            )}
          </div>
        </div>
        <p className="px-5 pb-5 pt-3 text-[13px] leading-relaxed text-[#8c909f] sm:px-6">
          Each cell is the percentage of that sector&apos;s companies with the signal, with the company count beside it. Click a cell to see those companies in the Explorer.
        </p>
      </section>

      {/* ── About this data ──────────────────────────────────────────────── */}
      <aside aria-label="About this data" className="mb-16 rounded-[20px] p-5 sm:p-6" style={GLASS}>
        <h2 className="text-[17px] font-semibold text-[#c2c6d6]">About this data</h2>
        <ul className="mt-3 grid list-disc gap-2 pl-5 text-[14px] leading-relaxed text-[#8c909f]">
          <li>Sector figures are simple averages across companies, so a sector with a few large movers can look different from its typical stock.</li>
          <li>Small sectors are noisier. {real.length ? `${[...real].sort((a, b) => a.number_of_companies - b.number_of_companies)[0].sector} has only ${[...real].sort((a, b) => a.number_of_companies - b.number_of_companies)[0].number_of_companies} companies.` : ''}</li>
          <li>Forecasts and signals are model outputs for education. They are not advice, and they are not a promise of future returns.</li>
        </ul>
      </aside>
    </div>
  )
}

/** One heatmap cell: a quiet single-hue tint that deepens with share, with the exact numbers printed. */
function HeatCell({ pct, count, label, onClick, active, white }: { pct: number; count: number; label: string; onClick: () => void; active?: boolean; white?: boolean }) {
  const alpha = 0.04 + Math.min(pct / 60, 1) * 0.34
  return (
    <button type="button" onClick={onClick} aria-label={label}
      className={`ui-press flex h-9 w-full items-center justify-center gap-1.5 rounded-lg ${MONO} text-[12px] tabular-nums ${FOCUS} ${active ? 'ring-1 ring-inset ring-white/25' : ''}`}
      style={{ background: white ? `rgba(255,255,255,${(0.03 + Math.min(pct / 60, 1) * 0.18).toFixed(3)})` : `rgba(173,198,255,${alpha.toFixed(3)})`, color: pct < 0.5 ? '#8c909f' : '#e2e2e2' }}>
      {pct < 0.5 ? '0%' : `${pct.toFixed(0)}%`}
      <span className="text-[11px]" style={{ color: pct < 0.5 ? '#8c909f' : '#e2e2e2' }}>{count}</span>
    </button>
  )
}

type Go = (sector?: string, signal?: string) => void
type Spring = { duration: number } | { type: 'spring'; duration: number; bounce: number }

function ScoreRow({ s, noData, go, fPos, springT, maxVol, maxMape, maxMargin }: {
  s: SectorSummary; noData?: boolean; go: Go; fPos: (v: number) => number; springT: Spring; maxVol: number; maxMape: number; maxMargin: number
}) {
  const mid = s.avg_forecast_30d_upside_pct
  const lo = s.min_forecast_30d_upside_pct, hi = s.max_forecast_30d_upside_pct
  const color = mid >= 0 ? '#4edea3' : '#F87171'
  return (
    <motion.div layout="position" transition={springT} role="row"
      className={`relative grid grid-cols-[minmax(150px,1.1fr)_minmax(260px,2.4fr)_repeat(3,minmax(88px,1fr))] items-center gap-x-5 px-5 py-2 sm:px-6 ${ROW_HOVER}`}>
      <div role="cell" className="min-w-0">
        <button type="button" onClick={() => go(s.sector)} className={`${STRETCH} text-left text-[15px] font-medium leading-5 ${noData ? 'text-[#c2c6d6]' : ''} ${FOCUS} rounded-md`}
          aria-label={`${noData ? 'Sector not in data' : s.sector}, ${s.number_of_companies} companies. Open in Explorer`}>
          {noData ? 'Sector not in data' : s.sector}
        </button>
        <div className={`${MONO} text-[12px] leading-4 text-[#8c909f]`}>{s.number_of_companies} companies</div>
      </div>
      <div role="cell" className="flex items-center gap-3">
        <div className="relative h-6 flex-1" aria-hidden>
          <div className="absolute inset-x-0 top-[11px] h-[2px] rounded bg-white/[0.07]" />
          <div className="absolute inset-y-0.5 w-px bg-white/30" style={{ left: `${fPos(0)}%` }} />
          {lo != null && hi != null && <div className="absolute top-[9px] h-1.5 rounded-sm bg-[#adc6ff]/30" style={{ left: `${fPos(lo)}%`, width: `${Math.max(0.5, fPos(hi) - fPos(lo))}%` }} />}
          <div className="absolute top-[7px] size-2.5 rounded-full ring-2 ring-[#1b1d1d]" style={{ left: `calc(${fPos(mid)}% - 5px)`, background: color }} />
        </div>
        <div className={`${MONO} w-[58px] shrink-0 text-right text-[13px] tabular-nums`} style={{ color }}>{METRICS[0].fmt(mid)}</div>
        <span className="sr-only">{lo != null && hi != null ? `Range ${METRICS[0].fmt(lo)} to ${METRICS[0].fmt(hi)}` : ''}</span>
      </div>
      <MetricCell value={s.avg_annualized_volatility_pct} text={METRICS[1].fmt(s.avg_annualized_volatility_pct)} max={maxVol} />
      <MetricCell value={s.avg_model_mape} text={METRICS[2].fmt(s.avg_model_mape)} max={maxMape} />
      <MetricCell value={s.avg_profit_margin_pct} text={METRICS[3].fmt(s.avg_profit_margin_pct)} max={maxMargin} />
    </motion.div>
  )
}

function MetricCell({ value, text, max }: { value: number; text: string; max: number }) {
  return (
    <div role="cell">
      <div className={`${MONO} text-[13px] tabular-nums`}>{text}</div>
      <div className="mt-1.5 h-1 rounded-full bg-white/[0.07]" aria-hidden>
        <div className="h-full rounded-full bg-[#adc6ff]/60" style={{ width: `${Math.max(0, value) / max * 100}%` }} />
      </div>
    </div>
  )
}

function SignalRow({ s, noData, go, springT, signal, sigMeta, overallPct, dPos, share, signalTotal }: {
  s: SectorSummary; noData?: boolean; go: Go; springT: Spring; signal: SignalKey; sigMeta: typeof SIGNALS[number]; overallPct: number
  dPos: (v: number) => number; share: (s: SectorSummary, key: SignalKey) => number; signalTotal: (s: SectorSummary) => number
}) {
  const name = noData ? 'Sector not in data' : s.sector
  const d = share(s, signal) - overallPct
  const c = d >= 0 ? '#7fd8b4' : '#8c909f'
  return (
    <motion.div layout="position" transition={springT} role="row"
      className={`relative grid grid-cols-[150px_repeat(5,minmax(70px,1fr))_minmax(260px,2.6fr)] items-center gap-x-1.5 px-5 py-0.5 sm:px-6 ${ROW_HOVER}`}>
      <div role="cell" className="min-w-0 py-0.5">
        <button type="button" onClick={() => go(s.sector, sigMeta.explorer)} className={`${STRETCH} block max-w-full truncate text-left text-[14px] leading-5 ${noData ? 'text-[#c2c6d6]' : ''} ${FOCUS} rounded-md`}
          aria-label={`${name}: ${share(s, signal).toFixed(0)}% ${sigMeta.explorer}. Open in Explorer`}>
          {name}
        </button>
        <div className={`${MONO} text-[11px] leading-4 text-[#8c909f]`}>{s.number_of_companies} companies</div>
      </div>
      {SIGNALS.map(g => (
        <div role="cell" key={g.key} className="relative z-10">
          <HeatCell pct={share(s, g.key)} count={s[g.key]} active={g.key === signal}
            label={`${name}: ${share(s, g.key).toFixed(0)}% ${g.explorer}, ${s[g.key]} of ${signalTotal(s)}. Open in Explorer`}
            onClick={() => go(s.sector, g.explorer)} />
        </div>
      ))}
      <div role="cell" className="flex items-center gap-3 pl-5">
        <div className="relative h-5 flex-1" aria-hidden>
          <div className="absolute inset-y-0 w-px bg-white/30" style={{ left: `${dPos(0)}%` }} />
          <div className="absolute top-[9px] h-[2px]" style={{ left: `${Math.min(dPos(0), dPos(d))}%`, width: `${Math.abs(dPos(d) - dPos(0))}%`, background: c }} />
          <div className="absolute top-[5px] size-2.5 rounded-full" style={{ left: `calc(${dPos(d)}% - 5px)`, background: c }} />
        </div>
        <div className={`${MONO} w-[92px] shrink-0 text-right text-[12px] tabular-nums`}>
          <span style={{ color: c }}>{signed(d)} pp</span> <span className="text-[#8c909f]">{share(s, signal).toFixed(0)}%</span>
        </div>
      </div>
    </motion.div>
  )
}
