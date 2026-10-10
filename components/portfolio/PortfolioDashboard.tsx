'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Plus, Trash2, Share2, Bot } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { CompanySummary } from '@/lib/types'
import { MAX_HOLDINGS, MIN_TAIL_OBSERVATIONS, WINDOWS, type WindowKey } from '@/lib/risk'
import { usePortfolio, type Confidence } from '@/lib/usePortfolio'
import { S, glass, fmtPct, fmtDate, fmtMoney, pctColor, labelStyle } from './tokens'

interface Props {
  companies: CompanySummary[]
  watchedSymbols: string[]
  onToggleWatchlist: (symbol: string) => void
  onViewForecast: (c: CompanySummary) => void
  onViewAI: (c: CompanySummary) => void
  onNavigateToExplorer: () => void
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
    <div role="group" aria-label={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={labelStyle}>{label}</span>
      <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 9999, padding: 3 }}>
        {options.map(o => {
          const on = o.value === value
          return (
            <button key={String(o.value)} aria-pressed={on} onClick={() => onChange(o.value)}
              style={{ minHeight: 32, minWidth: 44, padding: '0 12px', borderRadius: 9999, border: 'none', cursor: 'pointer', fontFamily: S.mono, fontSize: 12, fontWeight: 600,
                background: on ? `${S.primary}26` : 'transparent', color: on ? S.primary : S.textMuted }}>
              {o.text}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Card({ label, value, sub, explain, badge }: { label: string; value: string; sub?: string; explain: string; badge?: string }) {
  return (
    <div style={glass({ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 })} title={explain}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={labelStyle}>{label}</span>
        {badge && <span style={{ fontSize: 10, fontFamily: S.mono, color: S.warning, background: `${S.warning}18`, border: `1px solid ${S.warning}35`, borderRadius: 9999, padding: '1px 8px' }}>{badge}</span>}
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
        style={{ width: 64, minHeight: 36, textAlign: 'right', fontFamily: S.mono, fontSize: 13, color: S.textPrimary, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '0 8px' }}
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
    <div role="status" style={{ fontSize: 13, color: S.textSecondary, lineHeight: 1.55, background: `${c}10`, border: `1px solid ${c}30`, borderRadius: 12, padding: '10px 14px' }}>
      {children}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function PortfolioDashboard({ companies, watchedSymbols, onToggleWatchlist, onViewForecast, onViewAI, onNavigateToExplorer }: Props) {
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
      <div style={{ fontFamily: S.body, maxWidth: 560 }}>
        <div style={labelStyle}>Portfolio risk</div>
        <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 700, color: S.textPrimary, letterSpacing: '-0.03em', margin: '10px 0 12px' }}>Portfolio</h1>
        <p style={{ fontSize: 14, color: S.textMuted, lineHeight: 1.65, marginBottom: 24 }}>
          Add S&P 500 stocks to see how risky they are together, where the risk comes from, and how the mix behaved in past sell-offs. Everything is saved in this browser. No account needed.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button onClick={() => available.forEach(s => onToggleWatchlist(s))} style={primaryBtn}>
            Load an example of 8 large caps <ArrowRight size={14} />
          </button>
          <button onClick={onNavigateToExplorer} style={ghostBtn}>Find stocks in Explorer</button>
        </div>
        <p style={{ fontSize: 12, color: S.textMuted, marginTop: 16 }}>The example adds {available.length} stocks to your watchlist. You can remove them any time.</p>
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
    <div style={{ fontFamily: S.body, position: 'relative' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
        <div style={{ position: 'absolute', top: '-12%', left: '-10%', width: 700, height: 700, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,128,249,0.13) 0%, transparent 65%)', filter: 'blur(60px)' }} />
        <div style={{ position: 'absolute', bottom: '-12%', right: '-10%', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(205,127,50,0.08) 0%, transparent 65%)', filter: 'blur(60px)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Header */}
        <div>
          <div style={labelStyle}>Portfolio risk</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '10px 0 8px' }}>
            <h1 style={{ fontSize: 'clamp(1.6rem,4vw,2.4rem)', fontWeight: 700, color: S.textPrimary, letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>Portfolio</h1>
            <span style={{ fontSize: 13, fontWeight: 700, color: S.primary, background: `${S.primary}18`, border: `1px solid ${S.primary}35`, padding: '3px 11px', borderRadius: 9999, fontFamily: S.mono }}>{watchedSymbols.length}</span>
          </div>
          <p style={{ fontSize: 14, color: S.textMuted, lineHeight: 1.6, margin: 0, maxWidth: 680 }}>
            See how risky your stocks are together. All figures are historical and educational. They describe the past, they are not a forecast, and they are not advice.
          </p>
        </div>

        {/* Controls */}
        <div style={glass({ padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '14px 28px', alignItems: 'center' })}>
          <Segmented label="Window" value={p.settings.window} onChange={p.setWindow}
            options={(Object.keys(WINDOWS) as WindowKey[]).map(k => ({ value: k, text: k }))} />
          <Segmented<Confidence> label="VaR level" value={p.settings.confidence} onChange={p.setConfidence}
            options={[{ value: 0.95, text: '95%' }, { value: 0.99, text: '99%' }]} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={labelStyle}>Size</span>
            <input aria-label="Portfolio size in dollars" inputMode="numeric" defaultValue={p.settings.size}
              onChange={e => { const n = parseFloat(e.target.value.replace(/[^0-9.]/g, '')); if (n > 0) p.setSize(n) }}
              style={{ width: 110, minHeight: 36, fontFamily: S.mono, fontSize: 13, color: S.textPrimary, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 8, padding: '0 10px' }} />
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
                  <XAxis dataKey="d" hide />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} domain={['auto', 0]} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip content={<ChartTip kind="dd" />} />
                  <Area type="monotone" dataKey="bdd" stroke={S.textMuted} fill="none" strokeWidth={1.2} dot={false} isAnimationActive={false} />
                  <Area type="monotone" dataKey="pdd" stroke={S.negative} fill={`${S.negative}33`} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ fontSize: 12, color: S.textMuted, marginTop: 6 }}>
              {mode === 'rebalanced'
                ? 'Rebalanced daily means the weights are reset to your targets every day. The lower chart shows how far below its previous high the portfolio was.'
                : 'Buy and hold means the stocks are bought once and left alone, so winners grow into a bigger share. The lower chart still shows the rebalanced portfolio.'}
            </div>
          </div>
        )}

        {p.dataStatus === 'loading' && !m && <div style={{ ...glass({ padding: 24 }), color: S.textMuted, fontSize: 14 }}>Loading price history...</div>}

        {/* Holdings */}
        <div style={glass({ overflow: 'hidden' })}>
          <div style={{ padding: '16px 24px', borderBottom: `1px solid ${S.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>Holdings</span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={labelStyle}>What if</span>
              <button style={chipBtn} onClick={p.setEqualWeights}>Equal weight</button>
              <button style={chipBtn} onClick={p.setInverseVolWeights} disabled={!m} title="Weights proportional to 1 divided by each stock's volatility. An educational what-if, not a recommendation.">Inverse volatility</button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  {['Stock', 'Sector', 'Weight', '30D forecast', 'Volatility', 'Beta', ''].map((h, i) => (
                    <th key={i} style={{ ...labelStyle, textAlign: i >= 2 && i <= 5 ? 'right' : 'left', padding: '12px 16px', fontWeight: 500, borderBottom: `1px solid ${S.divider}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {watchedSymbols.map(sym => {
                  const c = byTicker[sym]
                  const h = holdingOf[sym]
                  const ex = excludedOf[sym]
                  return (
                    <tr key={sym} style={{ borderBottom: `1px solid ${S.divider}` }}>
                      <td style={td}>
                        <div style={{ fontFamily: S.mono, fontWeight: 700, color: S.textPrimary, fontSize: 14 }}>{sym}</div>
                        <div style={{ fontSize: 12, color: S.textMuted }}>{c?.company_name ?? 'Unknown company'}</div>
                        {(ex || (!a && p.noFile.includes(sym))) && <div style={{ fontSize: 11, color: S.warning, fontFamily: S.mono }}>Left out of risk numbers</div>}
                      </td>
                      <td style={{ ...td, fontSize: 12, color: S.textSecondary }}>{c?.sector ?? 'n/a'}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <WeightInput symbol={sym} value={p.rawWeights[sym] ?? 0} onCommit={v => p.setWeight(sym, v)} />
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: S.mono, fontSize: 13, color: pctColor(c?.forecast_30d_upside_pct) }}>
                        {c ? `${c.forecast_30d_upside_pct >= 0 ? '+' : ''}${c.forecast_30d_upside_pct.toFixed(1)}%` : 'n/a'}
                      </td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: S.mono, fontSize: 13, color: S.textSecondary }}>{h ? fmtPct(h.annVol) : 'n/a'}</td>
                      <td style={{ ...td, textAlign: 'right', fontFamily: S.mono, fontSize: 13, color: S.textSecondary }}>{h && Number.isFinite(h.beta) ? h.beta.toFixed(2) : 'n/a'}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {c && <button aria-label={`Open forecast for ${sym}`} title="Open forecast" onClick={() => onViewForecast(c)} style={iconBtn}><Share2 size={15} /></button>}
                        {c && <button aria-label={`Ask AI about ${sym}`} title="Ask AI" onClick={() => onViewAI(c)} style={iconBtn}><Bot size={15} /></button>}
                        <button aria-label={`Remove ${sym}`} title="Remove" onClick={() => onToggleWatchlist(sym)} style={iconBtn}><Trash2 size={15} /></button>
                      </td>
                    </tr>
                  )
                })}
                <tr>
                  <td style={{ ...td, ...labelStyle }} colSpan={2}>Total</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: S.mono, fontSize: 13, color: Math.abs(rawSum - 100) > 0.05 ? S.warning : S.textPrimary }}>{round(rawSum)}%</td>
                  <td colSpan={4} />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Add stock */}
          <div style={{ padding: '16px 24px', borderTop: `1px solid ${S.border}`, position: 'relative' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <Plus size={16} color={S.textMuted} />
              <input aria-label="Add a stock by ticker or name" placeholder={atLimit ? `Limit of ${MAX_HOLDINGS} stocks reached` : 'Add stock: ticker or name'} value={query} disabled={atLimit}
                onChange={e => setQuery(e.target.value)}
                style={{ flex: '1 1 240px', maxWidth: 360, minHeight: 40, fontFamily: S.body, fontSize: 14, color: S.textPrimary, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 10, padding: '0 12px' }} />
              <button onClick={onNavigateToExplorer} style={ghostBtn}>Browse Explorer</button>
            </div>
            {matches.length > 0 && (
              <ul style={{ listStyle: 'none', margin: '8px 0 0 26px', padding: 0, maxWidth: 360, ...glass({ borderRadius: 12, overflow: 'hidden' }) }}>
                {matches.map(c => (
                  <li key={c.symbol}>
                    <button onClick={() => { onToggleWatchlist(c.symbol); setQuery('') }}
                      style={{ width: '100%', minHeight: 44, textAlign: 'left', background: 'transparent', border: 'none', borderBottom: `1px solid ${S.divider}`, cursor: 'pointer', padding: '0 14px', color: S.textPrimary, fontSize: 13 }}>
                      <span style={{ fontFamily: S.mono, fontWeight: 700 }}>{c.symbol}</span> <span style={{ color: S.textMuted }}>{c.company_name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

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
            <li>A stock with returns on less than 90% of the window is left out and named above, so one recent listing cannot shrink everyone's window.</li>
            <li>Today's S&P 500 members only. Stocks that left the index are not included.</li>
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
    <div style={{ ...glass({ padding: '8px 12px', borderRadius: 10 }), fontSize: 12, fontFamily: S.mono, color: S.textPrimary }}>
      <div style={{ color: S.textMuted, marginBottom: 4 }}>{label ? fmtDate(label) : ''}</div>
      {rows.map(([k, v]) => <div key={k}>{k}: {v}</div>)}
    </div>
  )
}

const td: React.CSSProperties = { padding: '12px 16px', verticalAlign: 'middle' }
const iconBtn: React.CSSProperties = { minWidth: 36, minHeight: 36, background: 'transparent', border: 'none', color: S.textMuted, cursor: 'pointer', borderRadius: 8 }
const chipBtn: React.CSSProperties = { minHeight: 36, padding: '0 14px', fontSize: 12, fontWeight: 600, fontFamily: S.body, color: S.textPrimary, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: 9999, cursor: 'pointer' }
const primaryBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, fontSize: 13, fontWeight: 600, color: S.primary, background: `${S.primary}12`, border: `1px solid ${S.primary}30`, padding: '0 22px', borderRadius: 9999, cursor: 'pointer', fontFamily: S.body }
const ghostBtn: React.CSSProperties = { minHeight: 40, padding: '0 18px', fontSize: 13, fontWeight: 600, color: S.textSecondary, background: 'transparent', border: `1px solid ${S.border}`, borderRadius: 9999, cursor: 'pointer', fontFamily: S.body }
