'use client'

import { useState, useMemo, useCallback } from 'react'
import { Search, GitBranch, Bot, RotateCcw } from 'lucide-react'
import type { CompanySummary } from '@/lib/types'
import { formatCurrency, getSignalColor } from '@/lib/formatters'

interface Props {
  companies: CompanySummary[]
  onViewForecast: (c: CompanySummary) => void
  onViewAI: (c: CompanySummary) => void
  initialSector?: string
  initialSignal?: string
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
  'Potential Opportunity':                    'AI OPPORT.',
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

export default function CompanyExplorer({ companies, onViewForecast, onViewAI, initialSector, initialSignal }: Props) {
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
  const [chartView, setChartView]   = useState(false)

  const sectors  = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.sector))).sort()], [companies])
  const signals  = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.final_signal))).sort()], [companies])
  const risks    = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.risk_level))).sort()], [companies])

  const hasFilters = filterSector !== ALL || filterSignal !== ALL || filterRisk !== ALL || upsideMin !== '' || upsideMax !== '' || search !== ''

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

  // Top 12 for bar chart — Stitch style
  const topUpside = useMemo(() =>
    [...filtered]
      .sort((a, b) => b.forecast_30d_upside_pct - a.forecast_30d_upside_pct)
      .slice(0, 12)
  , [filtered])

  const maxUpside = useMemo(() => Math.max(...topUpside.map(c => c.forecast_30d_upside_pct), 1), [topUpside])

  const SortArrow = ({ col }: { col: SortKey }) => (
    <span style={{ marginLeft: 3, opacity: sortKey === col ? 1 : 0.2, color: sortKey === col ? D.primary : D.textMuted, fontSize: 9 }}>
      {sortKey === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
    </span>
  )

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left',
    fontSize: 10, fontFamily: D.mono, color: D.textMuted,
    letterSpacing: '0.08em', textTransform: 'uppercase',
    fontWeight: 500, cursor: 'pointer', userSelect: 'none',
    whiteSpace: 'nowrap', background: D.surface,
    borderBottom: `1px solid ${D.border}`,
  }

  const selectBase: React.CSSProperties = {
    background: 'transparent', border: 'none',
    color: D.text, borderRadius: 0, padding: 0,
    fontSize: 13, fontFamily: D.mono, outline: 'none',
    cursor: 'pointer', appearance: 'none' as const,
  }

  const riskColor = (r: string) =>
    r === 'High Risk' ? D.error : r === 'Moderate Risk' ? D.orange : D.tertiary
  const riskDots  = (r: string) =>
    r === 'High Risk' ? 3 : r === 'Moderate Risk' ? 2 : 1
  const riskLabel = (r: string) =>
    r === 'High Risk' ? 'H' : r === 'Moderate Risk' ? 'M' : 'L'

  return (
    <div style={{ fontFamily: D.body }}>

      {/* ── Live ticker tape ─────────────────────────────────────────────── */}
      <TickerTape companies={companies} />

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 32, marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 'clamp(2.2rem,5vw,3.2rem)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.1, color: D.text, margin: 0 }}>
            Company{' '}
            <span style={{ color: '#adc6ff' }}>
              Explorer
            </span>
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, paddingBottom: 4 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontFamily: D.mono, color: D.textMuted, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>Companies Analyzed</div>
            <div style={{ fontSize: 22, fontFamily: D.mono, color: D.text, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1 }}>
              {filtered.length} <span style={{ color: D.textMuted, fontWeight: 400 }}>/ {companies.length}</span>
            </div>
          </div>
          <div style={{ width: 1, height: 32, background: D.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 8, color: D.tertiary, filter: `drop-shadow(0 0 4px ${D.tertiary})` }}>●</span>
            <span style={{ fontSize: 11, fontFamily: D.mono, color: D.text, letterSpacing: '0.12em' }}>LIVE DATASTREAM</span>
          </div>
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: '4px 4px 0 0', display: 'flex', flexWrap: 'wrap', alignItems: 'stretch' }}>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px', borderRight: `1px solid ${D.border}`, flex: '1 1 200px', minWidth: 180 }}>
          <Search size={13} style={{ color: D.textMuted, flexShrink: 0 }} />
          <input
            type="text" placeholder="TICKER OR COMPANY NAME ..." value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            style={{ background: 'transparent', border: 'none', outline: 'none', color: D.text, fontSize: 12, fontFamily: D.mono, letterSpacing: '0.04em', width: '100%' }}
          />
        </div>

        {/* Sector */}
        <div style={{ padding: '8px 16px', borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 140 }}>
          <div style={{ fontSize: 9, fontFamily: D.mono, color: `${D.textMuted}80`, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Sector</div>
          <select value={filterSector} onChange={e => { setFilterSector(e.target.value); setPage(0) }} style={selectBase}>
            {sectors.map(o => <option key={o} style={{ background: D.container }}>{o}</option>)}
          </select>
        </div>

        {/* Signal */}
        <div style={{ padding: '8px 16px', borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 160 }}>
          <div style={{ fontSize: 9, fontFamily: D.mono, color: `${D.textMuted}80`, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Signal</div>
          <select value={filterSignal} onChange={e => { setFilterSignal(e.target.value); setPage(0) }} style={selectBase}>
            {signals.map(o => <option key={o} style={{ background: D.container }}>{o}</option>)}
          </select>
        </div>

        {/* Risk */}
        <div style={{ padding: '8px 16px', borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 110 }}>
          <div style={{ fontSize: 9, fontFamily: D.mono, color: `${D.textMuted}80`, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Risk</div>
          <select value={filterRisk} onChange={e => { setFilterRisk(e.target.value); setPage(0) }} style={selectBase}>
            {risks.map(o => <option key={o} style={{ background: D.container }}>{o}</option>)}
          </select>
        </div>

        {/* Upside Range */}
        <div style={{ padding: '8px 16px', borderRight: `1px solid ${D.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 190 }}>
          <div style={{ fontSize: 9, fontFamily: D.mono, color: `${D.textMuted}80`, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>Upside Range (%)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <input type="number" placeholder="5.0" value={upsideMinInput} onChange={e => setUpsideMinInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyUpside()}
              style={{ background: D.bg, border: `1px solid ${D.border}`, color: D.text, width: 50, padding: '3px 6px', fontSize: 11, fontFamily: D.mono, textAlign: 'center', borderRadius: 2, outline: 'none' }} />
            <span style={{ color: D.textMuted, fontSize: 11 }}>—</span>
            <input type="number" placeholder="MAX" value={upsideMaxInput} onChange={e => setUpsideMaxInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && applyUpside()}
              style={{ background: D.bg, border: `1px solid ${D.border}`, color: D.text, width: 50, padding: '3px 6px', fontSize: 11, fontFamily: D.mono, textAlign: 'center', borderRadius: 2, outline: 'none' }} />
            <button onClick={applyUpside}
              style={{ fontSize: 10, fontFamily: D.mono, color: D.text, background: `${D.primary}18`, border: `1px solid ${D.primary}35`, padding: '3px 8px', borderRadius: 2, cursor: 'pointer', fontWeight: 600 }}>
              GO
            </button>
          </div>
        </div>

        {/* Reset */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', marginLeft: 'auto' }}>
          {hasFilters && (
            <button onClick={resetFilters}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontFamily: D.mono, color: D.error, background: `${D.error}10`, border: `1px solid ${D.error}28`, padding: '5px 10px', borderRadius: 2, cursor: 'pointer' }}>
              <RotateCcw size={9} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div style={{ background: D.bg, border: `1px solid ${D.border}`, borderTop: 'none', marginBottom: 28, borderRadius: '0 0 4px 4px' }}>
        <div style={{ overflowX: 'auto', maxHeight: 520, overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ ...thStyle, paddingLeft: 18 }}>ACT</th>
                <th style={thStyle} onClick={() => handleSort('symbol')}>Ticker <SortArrow col="symbol" /></th>
                <th style={thStyle} onClick={() => handleSort('company_name')}>Name <SortArrow col="company_name" /></th>
                <th style={thStyle} onClick={() => handleSort('latest_price')}>Price <SortArrow col="latest_price" /></th>
                <th style={thStyle} onClick={() => handleSort('forecast_30d_upside_pct')}>30D Forecast <SortArrow col="forecast_30d_upside_pct" /></th>
                <th style={thStyle} onClick={() => handleSort('best_model_mape')}>MAPE <SortArrow col="best_model_mape" /></th>
                <th style={thStyle} onClick={() => handleSort('risk_level')}>Risk Index <SortArrow col="risk_level" /></th>
                <th style={thStyle} onClick={() => handleSort('annualized_volatility_pct')}>Volatility <SortArrow col="annualized_volatility_pct" /></th>
                <th style={thStyle} onClick={() => handleSort('profit_margin_pct')}>Margin <SortArrow col="profit_margin_pct" /></th>
                <th style={{ ...thStyle, paddingRight: 18 }} onClick={() => handleSort('final_signal')}>System Signal <SortArrow col="final_signal" /></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map(c => {
                const up = c.forecast_30d_upside_pct
                const upColor = up >= 0 ? D.tertiary : D.error
                const rc = riskColor(c.risk_level)
                const rd = riskDots(c.risk_level)
                const sc = getSignalColor(c.final_signal)
                const slabel = signalShortLabel[c.final_signal] ?? c.final_signal
                return (
                  <tr key={c.symbol}
                    style={{ borderBottom: `1px solid ${D.border}`, transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(173,198,255,0.025)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

                    <td style={{ padding: '11px 14px 11px 18px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => onViewForecast(c)} title="View Forecast"
                          style={{ width: 24, height: 21, borderRadius: 2, border: `1px solid ${D.border}`, background: D.container, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: D.primary }}>
                          <GitBranch size={9} />
                        </button>
                        <button onClick={() => onViewAI(c)} title="Ask AI"
                          style={{ width: 24, height: 21, borderRadius: 2, border: `1px solid ${D.border}`, background: D.container, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: D.secondary }}>
                          <Bot size={9} />
                        </button>
                      </div>
                    </td>

                    <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 700, color: D.text, fontFamily: D.mono, whiteSpace: 'nowrap' }}>{c.symbol}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: D.textSec, maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.company_name}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: D.text, fontFamily: D.mono, whiteSpace: 'nowrap' }}>{formatCurrency(c.latest_price)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: upColor, fontFamily: D.mono, whiteSpace: 'nowrap' }}>
                      {up >= 0 ? '+' : ''}{up.toFixed(1)}%
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: c.best_model_mape < 2 ? D.tertiary : c.best_model_mape < 5 ? D.orange : D.error, fontFamily: D.mono, whiteSpace: 'nowrap' }}>
                      {c.best_model_mape.toFixed(1)}%
                    </td>
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <div style={{ display: 'flex', gap: 2 }}>
                          {[1,2,3].map(d => (
                            <div key={d} style={{ width: 3, height: 13, borderRadius: 2, background: d <= rd ? rc : D.border }} />
                          ))}
                        </div>
                        <span style={{ fontSize: 10, fontFamily: D.mono, color: rc }}>{riskLabel(c.risk_level)}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: D.textSec, fontFamily: D.mono, whiteSpace: 'nowrap' }}>
                      {c.annualized_volatility_pct.toFixed(1)}%
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: D.textSec, fontFamily: D.mono, whiteSpace: 'nowrap' }}>
                      {c.profit_margin_pct != null ? `${c.profit_margin_pct.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ padding: '11px 14px 11px 14px', paddingRight: 18, whiteSpace: 'nowrap' }}>
                      <span style={{
                        display: 'inline-block', fontSize: 9, fontFamily: D.mono, letterSpacing: '0.06em',
                        color: sc, background: `${sc}14`, border: `1px solid ${sc}30`,
                        padding: '3px 6px', borderRadius: 2, textTransform: 'uppercase',
                      }}>
                        {slabel}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {!paginated.length && (
                <tr><td colSpan={10} style={{ padding: 48, textAlign: 'center', color: D.textMuted, fontSize: 13, fontFamily: D.mono }}>
                  No companies match your filters.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderTop: `1px solid ${D.border}`, flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 11, fontFamily: D.mono, color: D.textMuted }}>
            Showing {sorted.length > 0 ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, sorted.length)}` : '0'} of {sorted.length} companies
          </span>
          <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              style={{ width: 26, height: 26, border: `1px solid ${D.border}`, background: D.container, color: D.textSec, fontSize: 13, borderRadius: 2, cursor: 'pointer', opacity: page === 0 ? 0.3 : 1, fontFamily: D.mono }}>‹</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const p = Math.max(0, Math.min(page - 2, totalPages - 5)) + i
              return (
                <button key={p} onClick={() => setPage(p)}
                  style={{ minWidth: 30, height: 26, border: `1px solid ${p === page ? D.primary : D.border}`, background: p === page ? `${D.primary}18` : D.container, color: p === page ? D.primary : D.textSec, fontSize: 11, fontFamily: D.mono, borderRadius: 2, cursor: 'pointer', padding: '0 6px' }}>
                  {p + 1}
                </button>
              )
            })}
            {totalPages > 5 && page < totalPages - 3 && (
              <>
                <span style={{ color: D.textMuted, fontSize: 11, padding: '0 3px' }}>…</span>
                <button onClick={() => setPage(totalPages - 1)}
                  style={{ minWidth: 30, height: 26, border: `1px solid ${D.border}`, background: D.container, color: D.textSec, fontSize: 11, fontFamily: D.mono, borderRadius: 2, cursor: 'pointer', padding: '0 6px' }}>
                  {totalPages}
                </button>
              </>
            )}
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              style={{ width: 26, height: 26, border: `1px solid ${D.border}`, background: D.container, color: D.textSec, fontSize: 13, borderRadius: 2, cursor: 'pointer', opacity: page >= totalPages - 1 ? 0.3 : 1, fontFamily: D.mono }}>›</button>
          </div>
        </div>
      </div>

      {/* ── Top Companies — Stitch bar chart ─────────────────────────────── */}
      <div style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 4 }}>
        {/* Section header with horizontal rule */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: D.text, fontFamily: D.body, whiteSpace: 'nowrap' }}>Top Companies by 30-Day Forecast Upside</span>
            <div style={{ flex: 1, height: 1, background: D.border, minWidth: 40 }} />
          </div>
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            {['TABLE VIEW', 'CHART VIEW'].map(v => (
              <button key={v} onClick={() => setChartView(v === 'CHART VIEW')}
                style={{
                  fontSize: 10, fontFamily: D.mono, padding: '4px 10px', borderRadius: 0,
                  cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase' as const, transition: 'all 0.12s',
                  background: (v === 'CHART VIEW') === chartView ? D.primary : D.surface,
                  color: (v === 'CHART VIEW') === chartView ? '#002e6a' : D.textMuted,
                  border: `1px solid ${(v === 'CHART VIEW') === chartView ? D.primary : D.border}`,
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Stitch-style bar chart */}
        <div style={{ padding: '24px 20px', position: 'relative' }}>
          {/* Grid lines + % labels — absolute positioned behind bars */}
          <div style={{ position: 'relative', height: 320, background: `${D.container}50`, border: `1px solid ${D.border}`, borderRadius: 4, padding: '16px 16px 48px' }}>
            {/* Y-axis grid lines */}
            {[25, 20, 15, 10, 5].map(pct => (
              <div key={pct} style={{ position: 'absolute', left: 0, right: 0, bottom: `${48 + (pct / 30) * (320 - 64)}px`, borderTop: `1px solid rgba(66,71,84,0.12)`, display: 'flex', justifyContent: 'flex-end', paddingRight: 8 }}>
                <span style={{ fontSize: 9, fontFamily: D.mono, color: `${D.textMuted}60`, marginTop: -10 }}>{pct}%</span>
              </div>
            ))}

            {/* Bars grid */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${topUpside.length}, 1fr)`, gap: 4, height: '100%', alignItems: 'flex-end' }}>
              {topUpside.map(c => {
                const pct = c.forecast_30d_upside_pct
                const barHeightPct = Math.max(2, (pct / Math.max(maxUpside * 1.1, 1)) * 100)
                return (
                  <div key={c.symbol}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer', height: '100%', justifyContent: 'flex-end' }}
                    onClick={() => onViewForecast(c)}
                    title={`${c.symbol}: +${pct.toFixed(1)}%`}>
                    {/* Bar — Stitch style: translucent fill + top/side borders in tertiary */}
                    <div style={{
                      width: '100%',
                      height: `${barHeightPct}%`,
                      background: 'rgba(78,222,163,0.15)',
                      borderLeft: '1px solid rgba(78,222,163,0.6)',
                      borderRight: '1px solid rgba(78,222,163,0.6)',
                      borderTop: '1px solid rgba(78,222,163,0.9)',
                      transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(78,222,163,0.30)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(78,222,163,0.15)'}
                    />
                    {/* Ticker label */}
                    <span style={{ fontSize: 10, fontFamily: D.mono, color: D.textMuted, letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1 }}>
                      {c.symbol}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
