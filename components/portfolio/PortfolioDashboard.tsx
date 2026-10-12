'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Plus, Trash2, Share2, Bot, Link2, Download } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CompanySummary } from '@/lib/types'
import { MAX_HOLDINGS, MIN_TAIL_OBSERVATIONS, SCENARIOS, WINDOWS, computeFlags, decodeShare, encodeShare, metricsCsv, type SharedPortfolio, type WindowKey } from '@/lib/risk'
import { usePortfolio, type Confidence } from '@/lib/usePortfolio'
import { S, R, inset, glass, fmtPct, fmtDate, fmtMoney, pctColor, labelStyle } from './tokens'
import SegmentedControl, { SEG_CSS } from './SegmentedControl'
import RiskContribution, { type ContributionMode } from './RiskContribution'
import CorrelationHeatmap from './CorrelationHeatmap'
import Diversification from './Diversification'
import Flags from './Flags'
import StressTests from './StressTests'
import ForecastRisk from './ForecastRisk'
import { useNarrow } from './useNarrow'
import { LIST_NAME_LOWER } from '@/lib/riskLab'
import { RollingCorrelationChart, RollingVolChart } from './RollingCharts'

interface Props {
  companies: CompanySummary[]
  watchedSymbols: string[]
  onToggleWatchlist: (symbol: string) => void
  onViewForecast: (c: CompanySummary) => void
  onViewAI: (c: CompanySummary) => void
  onNavigateToExplorer: () => void
  /** Replace the saved list of stocks (used when opening a shared link). */
  onReplaceWatchlist: (symbols: string[]) => void
  /** True once the saved list has been read from the browser. */
  listReady: boolean
}

const PF_CSS = `
@keyframes pf-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (max-width: 720px) { .pf-tap { min-height: 44px !important; min-width: 44px !important; } }
@media (prefers-reduced-transparency: reduce) { .pf-root { --pf-glass-bg: #1e2020; --pf-glass-blur: none; } }
${SEG_CSS}`
const RISE = 'animate-[pf-rise_0.5s_cubic-bezier(0.16,1,0.3,1)_backwards] motion-reduce:animate-none'

/** Same heading as the Learn, Overview and Explorer tabs. */
function Heading({ count }: { count?: number }) {
  return (
    <div>
      <p className={`${RISE} text-sm text-[#8c909f]`}>Portfolio risk{count ? ` · ${count} ${count === 1 ? 'stock' : 'stocks'}` : ''}</p>
      <h1 className={`${RISE} mt-4 text-[clamp(2.75rem,7vw,5rem)] font-semibold leading-[1.02] tracking-[-0.045em] [animation-delay:60ms] [text-wrap:balance]`}>
        <span className="bg-[linear-gradient(135deg,#d0bcff_0%,#4edea3_100%)] bg-clip-text pb-1 text-transparent">Portfolio</span>
      </h1>
    </div>
  )
}

const EXAMPLE = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'JPM', 'XOM', 'JNJ']
const WINDOW_LABEL: Record<WindowKey, string> = { '1Y': '1 year', '2Y': '2 years', '3Y': '3 years', '5Y': '5 years' }

// ── Small pieces ─────────────────────────────────────────────────────────────

function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string
  value: T
  options: { value: T; text: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <SegmentedControl ariaLabel={label} value={value} options={options} onChange={onChange} />
    </div>
  )
}

function Card({ label, value, sub, explain, badge }: { label: string; value: string; sub?: string; explain: string; badge?: string }) {
  return (
    <div style={glass({ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 })} title={explain}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={labelStyle}>{label}</span>
        {badge && <span style={{ fontSize: 10, fontFamily: S.mono, color: S.warning, background: `${S.warning}18`, border: `1px solid ${S.warning}35`, borderRadius: R.min, padding: '1px 8px' }}>{badge}</span>}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: S.textPrimary, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, fontFamily: S.mono, color: S.textSecondary }}>{sub}</div>}
      <div style={{ fontSize: 12, color: S.textMuted, lineHeight: 1.5 }}>{explain}</div>
    </div>
  )
}

/** Weight box that lets you clear and retype without the value snapping back. */
function WeightInput({ value, onCommit, symbol }: { value: number; onCommit: (v: number) => void; symbol: string }) {
  const [text, setText] = useState(String(round(value)))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(String(round(value)))
  }, [value, focused])
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        className="pf-tap"
        aria-label={`Weight for ${symbol} in percent`}
        inputMode="decimal"
        value={text}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={e => {
          setText(e.target.value)
          const n = parseFloat(e.target.value)
          if (Number.isFinite(n)) onCommit(n)
        }}
        style={{ width: 64, minHeight: 36, textAlign: 'right', fontFamily: S.mono, fontSize: 13, color: S.textPrimary, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: R.control, padding: '0 8px' }}
      />
      <span style={{ fontFamily: S.mono, fontSize: 12, color: S.textMuted }}>%</span>
    </div>
  )
}

const round = (x: number) => Math.round(x * 100) / 100

/** Plain-English reason a ticker has no usable prices, from the export's skip list. */
function noDataText(symbol: string, reason?: string): string {
  const stopped = reason?.match(/last price (\d{4}-\d{2}-\d{2}) \(stopped trading\)/)
  if (stopped) return `${symbol} stopped trading on ${fmtDate(stopped[1])}, so it has no current price history and is left out of the risk numbers.`
  return `${symbol} has no price history in the Portfolio data, so it is left out of the risk numbers.`
}

function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warn' }) {
  const c = tone === 'warn' ? S.warning : S.primary
  return (
    <div role="status" style={{ fontSize: 13, color: S.textSecondary, lineHeight: 1.55, background: `${c}10`, border: `1px solid ${c}30`, borderRadius: R.control, padding: '10px 14px' }}>
      {children}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function PortfolioDashboard({ companies, watchedSymbols, onToggleWatchlist, onViewForecast, onViewAI, onNavigateToExplorer, onReplaceWatchlist, listReady }: Props) {
  const byTicker = useMemo(() => {
    const m: Record<string, CompanySummary> = {}
    companies.forEach(c => (m[c.symbol] = c))
    return m
  }, [companies])
  const sectorOf = useMemo(() => {
    const m: Record<string, string> = {}
    companies.forEach(c => (m[c.symbol] = c.sector))
    return m
  }, [companies])

  const p = usePortfolio(watchedSymbols, sectorOf)
  const a = p.analysis
  const m = a?.metrics ?? null
  const [mode, setMode] = useState<'rebalanced' | 'hold'>('rebalanced')
  const [query, setQuery] = useState('')
  const [contribMode, setContribMode] = useState<ContributionMode>('vol')
  const [hovered, setHovered] = useState<string | null>(null)
  const narrow = useNarrow()

  // ── Share link: read on open, write on Copy link ──
  const [pending, setPending] = useState<{ value: SharedPortfolio; problems: string[] } | null>(null)
  const [linkNote, setLinkNote] = useState<{ text: string; tone: 'info' | 'warn' } | null>(null)
  const [copied, setCopied] = useState(false)
  const [manualLink, setManualLink] = useState<string | null>(null)

  const clearHash = () => window.history.replaceState(null, '', window.location.pathname + window.location.search)
  const applyShared = (v: SharedPortfolio) => {
    onReplaceWatchlist(v.holdings.map(h => h.symbol))
    const custom = v.holdings.every(h => h.weight !== undefined)
    p.applyShared({
      weights: custom ? Object.fromEntries(v.holdings.map(h => [h.symbol, h.weight as number])) : {},
      window: v.window, confidence: v.confidence, size: v.size,
    })
    clearHash()
    setPending(null)
    setLinkNote({ text: `Loaded the shared portfolio of ${v.holdings.length} ${v.holdings.length === 1 ? 'stock' : 'stocks'}.`, tone: 'info' })
  }
  useEffect(() => {
    if (!listReady) return
    const read = () => {
      const d = decodeShare(window.location.hash)
      if (!d.isShare) return
      if (!d.value) {
        setLinkNote({ text: `This share link could not be used. ${d.problems.join(' ')}`, tone: 'warn' })
        clearHash()
        return
      }
      if (d.problems.length) setLinkNote({ text: d.problems.join(' '), tone: 'warn' })
      if (watchedSymbols.length === 0) applyShared(d.value)
      else setPending({ value: d.value, problems: d.problems })
    }
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listReady])

  const hasCustomWeights = watchedSymbols.some(sym => p.settings.weights[sym] !== undefined)
  const buildLink = () => {
    const hash = encodeShare({
      holdings: watchedSymbols.map(symbol => ({ symbol, weight: hasCustomWeights ? p.rawWeights[symbol] : undefined })),
      window: p.settings.window, confidence: p.settings.confidence, size: p.settings.size,
    })
    return `${window.location.origin}${window.location.pathname}#${hash}`
  }
  const copyLink = async () => {
    const link = buildLink()
    try {
      await navigator.clipboard.writeText(link)
      setManualLink(null)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      setManualLink(link) // clipboard blocked: show the link so it can be copied by hand
    }
  }
  const downloadCsv = () => {
    if (!m || !a || !p.meta) return
    const csv = metricsCsv(m, {
      windowLabel: WINDOW_LABEL[p.settings.window], confidence: p.settings.confidence, size: p.settings.size,
      methodVersion: p.meta.methodology_version, pricesThrough: p.meta.last_date, scenarios: a.scenarios,
    })
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const el = document.createElement('a')
    el.href = url
    el.download = `marketpulse-portfolio-risk-${p.meta.last_date}.csv`
    el.click()
    URL.revokeObjectURL(url)
  }

  const rawSum = watchedSymbols.reduce((s, sym) => s + (p.rawWeights[sym] ?? 0), 0)
  const tail = m ? (p.settings.confidence === 0.99 ? m.tail99 : m.tail95) : null
  const lowConfidence = tail ? tail.tailCount < MIN_TAIL_OBSERVATIONS : false
  const oneIn = Math.round(1 / (1 - p.settings.confidence))
  const holdingOf = useMemo(() => {
    const o: Record<string, NonNullable<typeof m>['holdings'][number]> = {}
    m?.holdings.forEach(h => (o[h.symbol] = h))
    return o
  }, [m])
  const excludedOf = useMemo(() => {
    const o: Record<string, { days: number; reason: string }> = {}
    a?.excluded.forEach(e => (o[e.symbol] = e))
    return o
  }, [a])

  const chartData = useMemo(() => {
    const g = a?.growth
    if (!g) return []
    return g.dates.map((d, i) => ({
      d,
      port: mode === 'hold' ? g.buyAndHold[i] : g.portfolio[i],
      bench: g.benchmark[i],
      pdd: g.portfolioDd[i],
      bdd: g.benchmarkDd[i],
    }))
  }, [a, mode])

  const flags = useMemo(() => (m ? computeFlags(m) : []), [m])

  // Past sell-offs that fall inside the chart's date range, shaded on both charts.
  const stressShades = useMemo(() => {
    const dates = a?.growth?.dates ?? []
    return SCENARIOS.filter(sc => sc.kind === 'drawdown').flatMap(sc => {
      const inside = dates.filter(d => d >= sc.start && d <= sc.end)
      return inside.length > 1 ? [{ id: sc.id, name: sc.name, x1: inside[0], x2: inside[inside.length - 1], start: sc.start, end: sc.end }] : []
    })
  }, [a])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return companies
      .filter(c => !watchedSymbols.includes(c.symbol) && (c.symbol.toLowerCase().startsWith(q) || c.company_name.toLowerCase().includes(q)))
      .slice(0, 6)
  }, [query, companies, watchedSymbols])

  const atLimit = watchedSymbols.length >= MAX_HOLDINGS

  // ── Empty state ──
  if (watchedSymbols.length === 0) {
    const available = EXAMPLE.filter(s => byTicker[s])
    return (
      <div className="pf-root" style={{ fontFamily: S.body, maxWidth: 640 }}>
        {linkNote && <div style={{ marginBottom: 16 }}><Notice tone={linkNote.tone}>{linkNote.text}</Notice></div>}
        <Heading />
        <p className={`${RISE} mb-6 mt-5 max-w-[52ch] text-lg leading-relaxed text-[#8c909f] [animation-delay:120ms] [text-wrap:pretty]`}>
          Add S&P 500 stocks to see how risky they are together, where the risk comes from, and how the mix behaved in past sell-offs. Everything is saved in this browser. No account needed.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button className="pf-tap" onClick={() => available.forEach(s => onToggleWatchlist(s))} style={primaryBtn}>
            Load an example of 8 large caps <ArrowRight size={14} />
          </button>
          <button className="pf-tap" onClick={onNavigateToExplorer} style={ghostBtn}>Find stocks in Explorer</button>
        </div>
        <p style={{ fontSize: 12, color: S.textMuted, marginTop: 16 }}>The example adds {available.length} stocks to your {LIST_NAME_LOWER}. You can remove them any time.</p>
      </div>
    )
  }

  const dollars = (x: number) => fmtMoney(x * p.settings.size)

  const summary = m && tail
    ? `Over the last ${WINDOW_LABEL[p.settings.window]} (${fmtDate(m.startDate)} to ${fmtDate(m.endDate)}), this portfolio's value swung about ${fmtPct(m.annVol)} a year, compared with ${fmtPct(m.benchAnnVol)} for SPY. On the worst 1 in ${oneIn} days it lost at least ${fmtPct(tail.var)} (about ${dollars(tail.var)} on ${fmtMoney(p.settings.size)}), and its biggest fall from a high was ${fmtPct(Math.abs(m.maxDrawdown.maxDrawdown))}. These are historical figures, not a forecast.`
    : null

  const dd = m?.maxDrawdown
  const gDates = a?.growth?.dates ?? []

  return (
    <div className="pf-root" style={{ fontFamily: S.body, position: 'relative' }}>
      <style>{PF_CSS}</style>
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-12%', left: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,128,249,0.13) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '-12%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(205,127,50,0.08) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <Heading count={watchedSymbols.length} />
          <p className={`${RISE} mt-5 max-w-[52ch] text-lg leading-relaxed text-[#8c909f] [animation-delay:120ms] [text-wrap:pretty]`}>
            See how risky your stocks are together. All figures are historical and educational. They describe the past, they are not a forecast, and they are not advice.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="pf-tap" style={chipBtn} onClick={copyLink}><Link2 size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{copied ? 'Link copied' : 'Copy link'}</button>
          <button className="pf-tap" style={{ ...chipBtn, opacity: m ? 1 : 0.5 }} onClick={downloadCsv} disabled={!m}><Download size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Download CSV</button>
        </div>
        </div>

        {pending && (
          <div role="alertdialog" aria-label="Shared portfolio" style={{ ...glass({ padding: '16px 20px', borderRadius: R.control }), border: `1px solid ${S.primary}40` }}>
            <div style={{ fontSize: 14, color: S.textPrimary, lineHeight: 1.6 }}>
              This link contains a portfolio of {pending.value.holdings.length} {pending.value.holdings.length === 1 ? 'stock' : 'stocks'} ({pending.value.holdings.slice(0, 8).map(h => h.symbol).join(', ')}{pending.value.holdings.length > 8 ? ', and more' : ''}). Opening it replaces your current list of {watchedSymbols.length}.
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
              <button className="pf-tap" style={primaryBtn} onClick={() => applyShared(pending.value)}>Open shared portfolio</button>
              <button className="pf-tap" style={ghostBtn} onClick={() => { setPending(null); clearHash() }}>Keep my own</button>
            </div>
          </div>
        )}
        {linkNote && <Notice tone={linkNote.tone}>{linkNote.text}</Notice>}
        {manualLink && (
          <Notice>Your browser blocked copying. Copy this link by hand: <input className="pf-tap" readOnly value={manualLink} aria-label="Share link" onFocus={e => e.currentTarget.select()} style={{ width: '100%', marginTop: 6, minHeight: 36, fontFamily: S.mono, fontSize: 12, color: S.textPrimary, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: R.control, padding: '0 8px' }} /></Notice>
        )}

        {/* Controls */}
        <div style={glass({ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '14px 28px', alignItems: 'center' })}>
          <Segmented label="Window" value={p.settings.window} onChange={p.setWindow}
            options={(Object.keys(WINDOWS) as WindowKey[]).map(k => ({ value: k, text: k }))} />
          <Segmented<Confidence> label="VaR level" value={p.settings.confidence} onChange={p.setConfidence}
            options={[{ value: 0.95, text: '95%' }, { value: 0.99, text: '99%' }]} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={labelStyle}>Size</span>
            <input className="pf-tap" aria-label="Portfolio size in dollars" inputMode="numeric" defaultValue={p.settings.size}
              onChange={e => { const n = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); if (n > 0) p.setSize(n) }}
              style={{ width: 110, minHeight: 36, fontFamily: S.mono, fontSize: 13, color: S.textPrimary, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: R.control, padding: '0 10px' }} />
          </label>
          <span style={{ marginLeft: 'auto', fontSize: 11, fontFamily: S.mono, color: S.textMuted }}>
            {p.meta ? `Prices to ${fmtDate(p.meta.last_date)} · Method v${p.meta.methodology_version} · Benchmark SPY` : ''}
          </span>
        </div>

        {/* Notices */}
        {p.dataStatus === 'unavailable' && <Notice tone="warn">Price history could not be loaded, so risk numbers are unavailable right now. Reload the page to try again.</Notice>}
        {p.error && <Notice tone="warn">Something went wrong computing the numbers: {p.error}</Notice>}
        {a?.issues.map(i => <Notice key={i.message} tone="warn">{i.message}</Notice>)}
        {a?.insufficient && !a.issues.length && <Notice tone="warn">{a.insufficient.reason} Try a shorter window or other stocks.</Notice>}
        {a?.excluded.map(e => (
          <Notice key={e.symbol} tone="warn">
            {e.reason === 'no_data'
              ? noDataText(e.symbol, p.meta?.symbols_skipped[e.symbol])
              : `${e.symbol} has only ${e.days} days of history in this window, so it is left out of the risk numbers. A shorter window may include it.`}
          </Notice>
        ))}
        {!a && p.noFile.map(s => <Notice key={s} tone="warn">{noDataText(s, p.meta?.symbols_skipped[s])}</Notice>)}
        {m && m.weightCoverage < 0.999 && <Notice>The risk numbers cover {fmtPct(m.weightCoverage, 0)} of your weights. The stocks left out are listed above.</Notice>}
        {Math.abs(rawSum - 100) > 0.05 && <Notice>Weights add up to {round(rawSum)}%, so they are scaled to 100% for the calculations.</Notice>}
        {a && a.droppedDates > 0 && <Notice>{a.droppedDates} days in the window were skipped because a stock had no price that day.</Notice>}

        {/* Headline */}
        {m && tail && dd && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, opacity: p.computing ? 0.6 : 1, transition: 'opacity .2s' }}>
              <Card label="Volatility (a year)" value={fmtPct(m.annVol)} sub={`SPY ${fmtPct(m.benchAnnVol)}`}
                explain="How much the portfolio's daily returns typically swing, scaled to a year. Higher means a bumpier ride." />
              <Card label={`1-day VaR (${p.settings.confidence * 100}%)`} value={fmtPct(tail.var)} sub={`${dollars(tail.var)} · Shortfall ${fmtPct(tail.es)} (${dollars(tail.es)})`}
                badge={lowConfidence ? `Low confidence · ${tail.tailCount} days` : undefined}
                explain={`On ${oneIn - 1} out of ${oneIn} historical days the loss was smaller than this. The shortfall is the average loss on the worst 1 in ${oneIn} days. Based on ${tail.tailCount} bad days.`} />
              <Card label="Max drawdown" value={fmtPct(dd.maxDrawdown)}
                sub={dd.maxDrawdown < 0 ? `${fmtDate(gDates[dd.peakIdx])} to ${fmtDate(gDates[dd.troughIdx])}` : 'No fall in this window'}
                explain={dd.maxDrawdown < 0
                  ? `The largest fall from a high point to a later low. ${dd.recoveryIdx !== null ? `Recovered ${fmtDate(gDates[dd.recoveryIdx])}` : 'Not recovered yet'}, ${dd.daysUnderwater} trading days from the high.`
                  : 'The largest fall from a high point to a later low.'} />
              <Card label="Beta vs SPY" value={Number.isFinite(m.beta) ? m.beta.toFixed(2) : 'n/a'} sub={`R² ${Number.isFinite(m.rSquared) ? m.rSquared.toFixed(2) : 'n/a'}`}
                explain="How much the portfolio tends to move when SPY moves. 1.2 means about 20% bigger moves. R² is how much of the portfolio's movement SPY explains." />
              <Card label="Effective holdings" value={Number.isFinite(m.effectiveHoldings) ? m.effectiveHoldings.toFixed(1) : 'n/a'} sub={`of ${m.symbols.length} stocks · top ${fmtPct(m.top1, 0)}`}
                explain="How many equal-sized positions would give the same concentration. A few big weights can make ten stocks behave like three." />
            </div>
            {summary && <p style={{ fontSize: 15, color: S.textSecondary, lineHeight: 1.7, margin: 0, maxWidth: 820 }}>{summary}</p>}
          </>
        )}

        {/* Hero chart */}
        {m && a?.growth && (
          <div style={glass({ padding: '22px 24px' })}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 6 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>Growth of 100 and time under water</div>
                <div style={{ fontSize: 12, color: S.textMuted, marginTop: 2 }}>
                  {fmtDate(m.startDate)} to {fmtDate(m.endDate)} · {m.observations} trading days · total return, dividends included
                </div>
              </div>
              <Segmented label="Weights" value={mode} onChange={setMode}
                options={[{ value: 'rebalanced', text: 'Rebalanced daily' }, { value: 'hold', text: 'Buy and hold' }]} />
            </div>
            <div role="img" aria-label={`Chart. 100 invested on ${fmtDate(m.startDate)} ended at ${chartData.length ? chartData[chartData.length - 1].port.toFixed(0) : ''} for the portfolio and ${chartData.length ? chartData[chartData.length - 1].bench.toFixed(0) : ''} for SPY. Largest fall ${fmtPct(dd!.maxDrawdown)}.`}>
              <div style={{ display: 'flex', gap: 18, fontSize: 12, fontFamily: S.mono, margin: '8px 0' }}>
                <span style={{ color: S.primary }}>● Portfolio</span>
                <span style={{ color: S.textMuted }}>● SPY</span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData} syncId="pf" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  {stressShades.map(z => <ReferenceArea key={z.id} x1={z.x1} x2={z.x2} fill={S.bronze} fillOpacity={0.14} stroke="none" />)}
                  <XAxis dataKey="d" tickFormatter={shortDate} minTickGap={60} tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} domain={['auto', 'auto']} tickFormatter={(v: number) => v.toFixed(0)} />
                  <Tooltip content={<ChartTip kind="growth" />} />
                  <Line type="monotone" dataKey="bench" stroke={S.textMuted} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="port" stroke={S.primary} strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
              <ResponsiveContainer width="100%" height={130}>
                <AreaChart data={chartData} syncId="pf" margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                  {stressShades.map(z => <ReferenceArea key={z.id} x1={z.x1} x2={z.x2} fill={S.bronze} fillOpacity={0.14} stroke="none" />)}
                  <XAxis dataKey="d" hide />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} domain={['auto', 0]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip content={<ChartTip kind="dd" />} />
                  <Area type="monotone" dataKey="bdd" stroke={S.textMuted} fill="none" strokeWidth={1.2} dot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="pdd" stroke={S.negative} fill={`${S.negative}33`} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {stressShades.length > 0 && (
              <div style={{ fontSize: 12, color: S.textMuted, marginTop: 4 }}>
                <span style={{ color: S.bronze }}>■</span> Shaded: {stressShades.map(z => `${z.name} (${fmtDate(z.start)} to ${fmtDate(z.end)})`).join('; ')}. Details in the stress tests below.
              </div>
            )}
            <div style={{ fontSize: 12, color: S.textMuted, marginTop: 6 }}>
              {mode === 'rebalanced'
                ? 'Rebalanced daily means the weights are reset to your targets every day. The lower chart shows how far below its previous high the portfolio was.'
                : 'Buy and hold means the stocks are bought once and left alone, so winners grow into a bigger share. The lower chart still shows the rebalanced portfolio.'}
            </div>
          </div>
        )}

        {p.dataStatus === 'loading' && !m && <div style={{ ...glass({ padding: 24 }), color: S.textMuted, fontSize: 14 }}>Loading price history...</div>}

        {/* Holdings */}
        {/* No blur on this tall panel: a blur layer this large painted a dark patch over the table rows in testing, and the page behind is flat so it looks the same. */}
        <div style={glass({ overflow: 'hidden', backdropFilter: 'none', WebkitBackdropFilter: 'none' })}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>Holdings</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={labelStyle}>What if</span>
              <button className="pf-tap" style={chipBtn} onClick={p.setEqualWeights}>Equal weight</button>
              <button className="pf-tap" style={chipBtn} onClick={p.setInverseVolWeights} disabled={!m} title="Weights proportional to 1 divided by each stock's volatility. An educational what-if, not a recommendation.">Inverse volatility</button>
            </div>
          </div>

          {narrow ? (
            <ul style={{ listStyle: 'none', margin: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {watchedSymbols.map(sym => {
                const c = byTicker[sym]
                const h = holdingOf[sym]
                const ex = excludedOf[sym]
                const stat = (label: string, value: string, color: string = S.textSecondary) => (
                  <div><div style={labelStyle}>{label}</div><div style={{ fontFamily: S.mono, fontSize: 13, color }}>{value}</div></div>
                )
                return (
                  <li key={sym} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${S.divider}`, borderRadius: inset(R.panel, 12), padding: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontFamily: S.mono, fontWeight: 700, color: S.textPrimary, fontSize: 15 }}>{sym}</div>
                        <div style={{ fontSize: 12, color: S.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c?.company_name ?? 'Unknown company'}</div>
                      </div>
                      <WeightInput symbol={sym} value={p.rawWeights[sym] ?? 0} onCommit={v => p.setWeight(sym, v)} />
                    </div>
                    {(ex || (!a && p.noFile.includes(sym))) && <div style={{ fontSize: 11, color: S.warning, fontFamily: S.mono, marginTop: 6 }}>Left out of risk numbers</div>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 12 }}>
                      {stat('Risk share', h ? fmtPct(h.riskPercent) : 'n/a', S.textPrimary)}
                      {stat('30D fcst', c ? `${c.forecast_30d_upside_pct >= 0 ? '+' : ''}${c.forecast_30d_upside_pct.toFixed(1)}%` : 'n/a', pctColor(c?.forecast_30d_upside_pct))}
                      {stat('Vol', h ? fmtPct(h.annVol) : 'n/a')}
                      {stat('Beta', h && Number.isFinite(h.beta) ? h.beta.toFixed(2) : 'n/a')}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 8 }}>
                      {c && <button className="pf-tap" aria-label={`Open forecast for ${sym}`} onClick={() => onViewForecast(c)} style={iconBtn}><Share2 size={16} /></button>}
                      {c && <button className="pf-tap" aria-label={`Ask AI about ${sym}`} onClick={() => onViewAI(c)} style={iconBtn}><Bot size={16} /></button>}
                      <button className="pf-tap" aria-label={`Remove ${sym}`} onClick={() => onToggleWatchlist(sym)} style={iconBtn}><Trash2 size={16} /></button>
                    </div>
                  </li>
                )
              })}
              <li style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 4px 0' }}>
                <span style={labelStyle}>Total</span>
                <span style={{ fontFamily: S.mono, fontSize: 13, color: Math.abs(rawSum - 100) > 0.05 ? S.warning : S.textPrimary }}>{round(rawSum)}%</span>
              </li>
            </ul>
          ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 840 }}>
              <thead>
                <tr>
                  {['Stock', 'Sector', 'Weight', 'Risk share', '30D forecast', 'Volatility', 'Beta', 'Actions'].map((h, i) => (
                    <th key={i} style={{ ...labelStyle, textAlign: i >= 2 && i <= 6 ? 'right' : 'left', padding: '12px 16px', fontWeight: 500, borderBottom: `1px solid ${S.divider}`, ...(h === 'Actions' ? { color: 'transparent' } : {}) }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {watchedSymbols.map(sym => {
                  const c = byTicker[sym]
                  const h = holdingOf[sym]
                  const ex = excludedOf[sym]
                  return (
                    <tr key={sym} onMouseEnter={() => setHovered(sym)} onMouseLeave={() => setHovered(null)} style={{ borderBottom: `1px solid ${S.divider}`, background: hovered === sym ? 'rgba(198,192,255,0.07)' : 'transparent' }}>
                      <td style={td}>
                        <div style={{ fontFamily: S.mono, fontWeight: 700, color: S.textPrimary, fontSize: 14 }}>{sym}</div>
                        <div style={{ fontSize: 12, color: S.textMuted }}>{c?.company_name ?? 'Unknown company'}</div>
                        {(ex || (!a && p.noFile.includes(sym))) && <div style={{ fontSize: 11, color: S.warning, fontFamily: S.mono }}>Left out of risk numbers</div>}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: S.textSecondary }}>{c?.sector ?? 'n/a'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <WeightInput symbol={sym} value={p.rawWeights[sym] ?? 0} onCommit={v => p.setWeight(sym, v)} />
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: S.mono, fontSize: 13, color: S.textPrimary }}>{h ? fmtPct(h.riskPercent) : 'n/a'}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: S.mono, fontSize: 13, color: pctColor(c?.forecast_30d_upside_pct) }}>
                        {c ? `${c.forecast_30d_upside_pct >= 0 ? '+' : ''}${c.forecast_30d_upside_pct.toFixed(1)}%` : 'n/a'}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: S.mono, fontSize: 13, color: S.textSecondary }}>{h ? fmtPct(h.annVol) : 'n/a'}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: S.mono, fontSize: 13, color: S.textSecondary }}>{h && Number.isFinite(h.beta) ? h.beta.toFixed(2) : 'n/a'}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {c && <button className="pf-tap" aria-label={`Open forecast for ${sym}`} title="Open forecast" onClick={() => onViewForecast(c)} style={iconBtn}><Share2 size={15} /></button>}
                        {c && <button className="pf-tap" aria-label={`Ask AI about ${sym}`} title="Ask AI" onClick={() => onViewAI(c)} style={iconBtn}><Bot size={15} /></button>}
                        <button className="pf-tap" aria-label={`Remove ${sym}`} title="Remove" onClick={() => onToggleWatchlist(sym)} style={iconBtn}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  )
                })}
                <tr>
                  <td style={{ ...td, ...labelStyle }} colSpan={2}>Total</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: S.mono, fontSize: 13, color: Math.abs(rawSum - 100) > 0.05 ? S.warning : S.textPrimary }}>{round(rawSum)}%</td>
                  <td colSpan={5} />
                </tr>
              </tbody>
            </table>
          </div>
          )}

          {/* Add stock */}
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${S.border}`, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Plus size={16} color={S.textMuted} />
              <input className="pf-tap" aria-label="Add a stock by ticker or name" placeholder={atLimit ? `Limit of ${MAX_HOLDINGS} stocks reached` : 'Add stock: ticker or name'} value={query} disabled={atLimit}
                onChange={e => setQuery(e.target.value)}
                style={{ flex: '1 1 240px', maxWidth: 360, minHeight: 40, fontFamily: S.body, fontSize: 14, color: S.textPrimary, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: R.control, padding: '0 12px' }} />
              <button className="pf-tap" onClick={onNavigateToExplorer} style={ghostBtn}>Browse Explorer</button>
            </div>
            {matches.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '8px 0 0 26px', padding: 0, maxWidth: 360, ...glass({ borderRadius: R.control, overflow: 'hidden' }) }}>
                {matches.map(c => (
                  <li key={c.symbol}>
                    <button className="pf-tap" onClick={() => { onToggleWatchlist(c.symbol); setQuery('') }}
                      style={{ width: '100%', minHeight: 44, textAlign: 'left', background: 'transparent', border: 'none', borderBottom: `1px solid ${S.divider}`, cursor: 'pointer', padding: '0 14px', color: S.textPrimary, fontSize: 13 }}>
                      <span style={{ fontFamily: S.mono, fontWeight: 700 }}>{c.symbol}</span> <span style={{ color: S.textMuted }}>{c.company_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Where the risk comes from */}
        {m && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 16, alignItems: 'start', opacity: p.computing ? 0.6 : 1, transition: 'opacity .2s' }}>
            <RiskContribution holdings={m.holdings} mode={contribMode} onMode={setContribMode} tailCount={m.tailContribution.tailCount}
              confidence={p.settings.confidence} hovered={hovered} onHover={setHovered} />
            <Flags flags={flags} hovered={hovered} onHover={setHovered} />
          </div>
        )}

        {/* Diversification */}
        {m && a?.growth && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 16, opacity: p.computing ? 0.6 : 1, transition: 'opacity .2s' }}>
              <Diversification m={m} unknownSymbols={m.symbols.filter(x => (sectorOf[x] || 'Unknown') === 'Unknown')} />
              <RollingCorrelationChart m={m} growth={a.growth} />
            </div>
            <CorrelationHeatmap symbols={m.symbols} corr={m.corr} sectorOf={sectorOf} hovered={hovered} onHover={setHovered} />
            <RollingVolChart m={m} />
          </>
        )}

        {/* Stress tests */}
        {a && a.scenarios.length > 0 && (
          <StressTests scenarios={a.scenarios} m={m} sectorOf={sectorOf} size={p.settings.size} windowLabel={WINDOW_LABEL[p.settings.window]} />
        )}

        {/* Forecast next to risk */}
        {m && <ForecastRisk m={m} byTicker={byTicker} />}

        {/* Method */}
        <details style={glass({ padding: '16px 24px' })}>
          <summary style={{ cursor: 'pointer', fontSize: 14, fontWeight: 600, color: S.textPrimary }}>How these numbers are calculated</summary>
          <ul style={{ margin: '12px 0 0', paddingLeft: 18, fontSize: 13, color: S.textSecondary, lineHeight: 1.75 }}>
            <li>Prices are daily closes adjusted for splits and dividends, so returns include dividends. Source: Yahoo Finance.</li>
            <li>The benchmark is SPY, an ETF that tracks the S&P 500. Beta and the comparison lines use it.</li>
            <li>Returns are simple daily returns. The portfolio return is the weighted sum of each stock's return, with weights held constant (rebalanced daily).</li>
            <li>Volatility is the standard deviation of daily returns times the square root of 252 trading days.</li>
            <li>VaR is the loss on the 5th (or 1st) worst percentile of past days. Shortfall is the average loss on the days at or beyond that cutoff. Both are historical, not predictions.</li>
            <li>Max drawdown is the largest fall from a running high to a later low.</li>
            <li>Risk share is weight times marginal volatility divided by portfolio volatility, so the shares add up to 100%. Bad-day share is each stock's average loss on the portfolio's worst days, as a share of expected shortfall.</li>
            <li>Correlation is the Pearson correlation of daily returns over the window. Average correlation is weighted by position sizes.</li>
            <li>A stock with returns on less than 90% of the window is left out and named above, so one recent listing cannot shrink everyone's window.</li>
            <li>Stress-test replays use your weights at the start of each window, buy and hold, no rebalancing. Stocks with no price on the start or end date are left out and the rest are scaled to 100%; below 80% coverage a scenario is marked partial.</li>
            <li>The market-fall estimate is portfolio beta times the market move. It is a rough approximation that assumes betas hold, which they often do not in real crises.</li>
            <li>Today's S&P 500 members only. Stocks that left the index are not included, so past sell-offs look milder than they were.</li>
          </ul>
        </details>
      </div>
    </div>
  )
}

// ── Chart helpers and shared styles ──────────────────────────────────────────

const axisTick = { fill: S.textMuted, fontSize: 11, fontFamily: S.mono }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (d: string) => `${MONTHS[parseInt(d.slice(5, 7), 10) - 1]} ${d.slice(2, 4)}`

function ChartTip({ active, payload, label, kind }: { active?: boolean; payload?: { dataKey: string; value: number }[]; label?: string; kind: 'growth' | 'dd' }) {
  if (!active || !payload?.length) return null
  const get = (k: string) => payload.find(x => x.dataKey === k)?.value
  const rows = kind === 'growth'
    ? [['Portfolio', get('port')?.toFixed(1)], ['SPY', get('bench')?.toFixed(1)]]
    : [['Portfolio', fmtPct(get('pdd') ?? NaN)], ['SPY', fmtPct(get('bdd') ?? NaN)]]
  return (
    <div style={{ ...glass({ padding: '8px 12px', borderRadius: R.control }), fontSize: 12, fontFamily: S.mono, color: S.textPrimary }}>
      <div style={{ color: S.textMuted, marginBottom: 4 }}>{label ? fmtDate(label) : ''}</div>
      {rows.map(([k, v]) => <div key={k}>{k}: {v}</div>)}
    </div>
  )
}

const td: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'middle' }
const iconBtn: React.CSSProperties = { minWidth: 36, minHeight: 36, background: 'transparent', border: 'none', color: S.textMuted, cursor: 'pointer', borderRadius: R.control }
const chipBtn: React.CSSProperties = { minHeight: 36, padding: '0 14px', fontSize: 12, fontWeight: 600, fontFamily: S.body, color: S.textPrimary, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: R.control, cursor: 'pointer' }
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 13, fontWeight: 600, color: S.primary, background: `${S.primary}12`, border: `1px solid ${S.primary}30`, padding: '0 22px', borderRadius: R.control, cursor: 'pointer', fontFamily: S.body }
const ghostBtn: React.CSSProperties = { minHeight: 40, padding: '0 18px', fontSize: 13, fontWeight: 600, color: S.textSecondary, background: 'transparent', border: `1px solid ${S.border}`, borderRadius: R.control, cursor: 'pointer', fontFamily: S.body }
