'use client'

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { Sparkles, Search, AlertTriangle, X, TrendingUp, BarChart2, Paperclip, ArrowRight, Filter } from 'lucide-react'
import type { CompanySummary, SectorSummary } from '@/lib/types'
import { formatPercent, formatCurrency, formatCompactNumber } from '@/lib/formatters'

interface Props {
  companies: CompanySummary[]
  sectors: SectorSummary[]
  defaultCompany?: CompanySummary | null
  defaultQuestion?: string
}
interface Message { role: 'user' | 'assistant'; content: string }

const D = {
  bg:        '#121414',
  lowest:    '#0c0f0f',
  surface:   '#1a1c1c',
  container: '#1e2020',
  high:      '#282a2b',
  border:    'rgba(66,71,84,0.3)',
  primary:   '#adc6ff',
  secondary: '#d0bcff',
  tertiary:  '#4edea3',
  error:     '#ffb4ab',
  orange:    '#f59e0b',
  text:      '#e2e2e2',
  textSec:   '#c2c6d6',
  textMuted: '#8c909f',
  mono:      'JetBrains Mono, monospace',
  body:      'Inter, system-ui, sans-serif',
}


function buildContext(company: CompanySummary | null, sector: SectorSummary | null): string {
  if (!company) return 'No company selected. User is asking a general market question.'
  return [
    `Company: ${company.symbol} — ${company.company_name}`,
    `Sector: ${company.sector} | Industry: ${company.industry}`,
    `Latest Price: $${company.latest_price.toFixed(2)}`,
    `30D Forecast Price: $${company.forecast_30d_price.toFixed(2)} (${formatPercent(company.forecast_30d_upside_pct)})`,
    `Forecast Method: ${company.dashboard_forecast_method}`,
    `Best Model: ${company.best_model_name} | MAPE: ${company.best_model_mape.toFixed(2)}%`,
    `Model Reliability: ${company.model_reliability}`,
    `Annualized Volatility: ${company.annualized_volatility_pct.toFixed(1)}%`,
    `Sector Median Volatility: ${company.sector_median_volatility_pct.toFixed(1)}%`,
    `Risk Level: ${company.risk_level} | Sector Relative Risk: ${company.sector_relative_risk}`,
    `Profit Margin: ${company.profit_margin_pct != null ? company.profit_margin_pct.toFixed(1) + '%' : 'N/A'}`,
    `EPS: ${company.eps != null ? '$' + company.eps.toFixed(2) : 'N/A'}`,
    `Fundamental Label: ${company.fundamental_label}`,
    `Forecast Signal: ${company.forecast_signal}`,
    `Final Signal: ${company.final_signal}`,
    `Review Reason: ${company.review_reason ?? 'N/A'}`,
    `Total Return (history): ${formatPercent(company.total_return_pct)}`,
    ...(sector ? [
      `--- Sector Context (${sector.sector}) ---`,
      `Companies in sector: ${sector.number_of_companies}`,
      `Sector avg upside: ${formatPercent(sector.avg_forecast_30d_upside_pct)}`,
      `Sector avg volatility: ${sector.avg_annualized_volatility_pct.toFixed(1)}%`,
      `Sector avg MAPE: ${sector.avg_model_mape.toFixed(2)}%`,
    ] : []),
  ].join('\n')
}

function getInitials(symbol: string): string {
  return symbol.length >= 2 ? symbol.slice(0, 2) : symbol
}

// ── Prompt pool ────────────────────────────────────────────────────────────────

function getPromptPool(symbol: string): string[] {
  return [
    `Explain ${symbol}'s 30-day forecast signal`,
    `What's driving ${symbol}'s recent volatility?`,
    `How reliable is ${symbol}'s forecast model?`,
    `Summarize ${symbol}'s fundamental health`,
    `Is ${symbol} high or low risk vs its sector?`,
    `What are the key risk factors for ${symbol}?`,
    `What does ${symbol}'s final system signal indicate?`,
    `Compare ${symbol} to its sector peers`,
    `How does ${symbol}'s MAPE compare to the sector average?`,
    `What would cause ${symbol}'s forecast to be wrong?`,
    'Which sectors are showing the most 30-day upside?',
    'Explain how the adaptive blended momentum model works',
    'What is a good MAPE score for stock forecasting?',
    'How is the final system signal calculated?',
    'What does "Needs Further Review" mean for a company?',
    'Explain the difference between MAPE and RMSE',
    'How does annualized volatility affect the risk classification?',
    'What does a "Stable Watchlist" signal mean?',
    'How is ensemble weighting determined per company?',
    'Which companies have the highest forecast reliability?',
    'What is adaptive blended momentum in simple terms?',
    'Impact of Fed rate decisions on Tech sector forecasts',
    'What does "High Volatility Speculative" mean?',
    'How should I interpret a negative 30-day forecast upside?',
  ]
}

// ── Markdown renderer ──────────────────────────────────────────────────────────

function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
          return <strong key={i} style={{ fontWeight: 700, color: '#e2e2e2' }}>{part.slice(2, -2)}</strong>
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
          return <em key={i} style={{ fontStyle: 'italic', color: '#c2c6d6' }}>{part.slice(1, -1)}</em>
        if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
          return <code key={i} style={{ background: 'rgba(173,198,255,0.12)', color: '#adc6ff', padding: '1px 5px', borderRadius: 3, fontSize: '0.88em', fontFamily: 'JetBrains Mono, monospace' }}>{part.slice(1, -1)}</code>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function renderMarkdown(content: string): React.ReactNode {
  const lines = content.split('\n')
  return (
    <>
      {lines.map((line, i) => {
        if (/^### /.test(line))
          return <div key={i} style={{ fontSize: 13, fontWeight: 700, color: '#adc6ff', marginTop: 14, marginBottom: 4 }}>{parseInline(line.slice(4))}</div>
        if (/^## /.test(line))
          return <div key={i} style={{ fontSize: 14, fontWeight: 700, color: '#adc6ff', marginTop: 16, marginBottom: 5 }}>{parseInline(line.slice(3))}</div>
        if (/^# /.test(line))
          return <div key={i} style={{ fontSize: 15, fontWeight: 700, color: '#adc6ff', marginTop: 18, marginBottom: 6 }}>{parseInline(line.slice(2))}</div>
        if (/^---+$/.test(line.trim()))
          return <div key={i} style={{ borderTop: '1px solid rgba(66,71,84,0.5)', margin: '10px 0' }} />
        if (/^[-*•] /.test(line))
          return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3, lineHeight: 1.65 }}>
              <span style={{ color: '#adc6ff', flexShrink: 0, fontSize: 10, marginTop: 3 }}>▸</span>
              <span style={{ fontSize: 13, color: '#c2c6d6' }}>{parseInline(line.replace(/^[-*•] /, ''))}</span>
            </div>
          )
        if (/^\d+\. /.test(line)) {
          const m = line.match(/^(\d+)\. (.+)/)
          if (m) return (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 3, lineHeight: 1.65 }}>
              <span style={{ color: '#adc6ff', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, minWidth: 18, marginTop: 2 }}>{m[1]}.</span>
              <span style={{ fontSize: 13, color: '#c2c6d6' }}>{parseInline(m[2])}</span>
            </div>
          )
        }
        if (line.trim() === '')
          return <div key={i} style={{ height: 6 }} />
        return (
          <div key={i} style={{ fontSize: 13, lineHeight: 1.7, color: '#c2c6d6' }}>{parseInline(line)}</div>
        )
      })}
    </>
  )
}

export default function AIAnalyst({ companies, sectors, defaultCompany, defaultQuestion }: Props) {
  const [selectedSymbol, setSelectedSymbol] = useState(defaultCompany?.symbol || 'NVDA')
  const [messages, setMessages]             = useState<Message[]>([])
  const [input, setInput]                   = useState('')
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [sidebarSearch, setSidebarSearch]   = useState('')
  const [chipSlots, setChipSlots]           = useState([0, 1, 2])
  const nextChipRef = useRef(3)
  const bottomRef = useRef<HTMLDivElement>(null)

  const company = useMemo(() => companies.find(c => c.symbol === selectedSymbol) ?? null, [companies, selectedSymbol])
  const sector  = useMemo(() => company ? sectors.find(s => s.sector === company.sector) ?? null : null, [company, sectors])

  // Sidebar company list: curated featured + search
  const FEATURED = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'GOOGL', 'AMZN', 'META', 'AMD', 'JPM', 'V']
  const sidebarCompanies = useMemo(() => {
    const q = sidebarSearch.toLowerCase()
    if (q) return companies.filter(c =>
      c.symbol.toLowerCase().includes(q) || c.company_name.toLowerCase().includes(q)
    ).slice(0, 12)
    const list = companies.filter(c => FEATURED.includes(c.symbol))
      .sort((a, b) => FEATURED.indexOf(a.symbol) - FEATURED.indexOf(b.symbol))
    if (selectedSymbol && !list.find(c => c.symbol === selectedSymbol)) {
      const sel = companies.find(c => c.symbol === selectedSymbol)
      if (sel) list.unshift(sel)
    }
    return list.slice(0, 10)
  }, [companies, sidebarSearch, selectedSymbol])

  useEffect(() => { if (defaultCompany) setSelectedSymbol(defaultCompany.symbol) }, [defaultCompany])
  useEffect(() => {
    if (messages.length > 0 || loading) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  const promptPool = useMemo(() => getPromptPool(selectedSymbol), [selectedSymbol])

  // Reset chips whenever the selected company changes
  useEffect(() => {
    setChipSlots([0, 1, 2])
    nextChipRef.current = 3
  }, [selectedSymbol])

  const handleChipClick = useCallback((slotPosition: number) => {
    const chip = promptPool[chipSlots[slotPosition] % promptPool.length]
    send(chip)
    setChipSlots(prev => {
      const next = nextChipRef.current % promptPool.length
      nextChipRef.current++
      return prev.map((v, i) => i === slotPosition ? next : v)
    })
  }, [chipSlots, promptPool]) // eslint-disable-line
  useEffect(() => {
    if (defaultQuestion) {
      const t = setTimeout(() => send(defaultQuestion), 300)
      return () => clearTimeout(t)
    }
  }, [defaultQuestion]) // eslint-disable-line

  const send = async (text: string) => {
    if (!text.trim() || loading) return
    const newMsgs: Message[] = [...messages, { role: 'user', content: text }]
    setMessages(newMsgs); setInput(''); setLoading(true); setError(null)
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMsgs, context: buildContext(company, sector) }),
      })
      const data = await res.json()
      if (!res.ok || data.error) setError(data.error || 'API error')
      else setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch { setError('Network error — please try again.') }
    finally { setLoading(false) }
  }

  // Metric grid values from real company data
  const metrics = company ? [
    { label: 'Volatility', value: `${company.annualized_volatility_pct.toFixed(1)}%` },
    { label: 'MAPE', value: `${company.best_model_mape.toFixed(1)}%` },
    { label: '30D Upside', value: (company.forecast_30d_upside_pct >= 0 ? '+' : '') + company.forecast_30d_upside_pct.toFixed(1) + '%' },
    { label: 'Risk Level', value: company.risk_level === 'High Risk' ? 'HIGH' : company.risk_level === 'Moderate Risk' ? 'MED' : 'LOW' },
    { label: 'EPS', value: company.eps != null ? `$${company.eps.toFixed(2)}` : '—' },
    { label: 'Margin', value: company.profit_margin_pct != null ? `${company.profit_margin_pct.toFixed(1)}%` : '—' },
  ] : [
    { label: 'Volatility', value: '—' },
    { label: 'MAPE', value: '—' },
    { label: '30D Upside', value: '—' },
    { label: 'Risk Level', value: '—' },
    { label: 'EPS', value: '—' },
    { label: 'Margin', value: '—' },
  ]

  const chipStyle = (active = false): React.CSSProperties => ({
    padding: '6px 14px', borderRadius: 999,
    border: `1px solid ${active ? `${D.primary}40` : D.border}`,
    background: active ? `${D.primary}08` : 'transparent',
    color: D.textMuted, fontSize: 11, fontFamily: D.mono,
    cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' as const,
  })

  return (
    /* Full-bleed layout — negative margin to reclaim padding from parent */
    <div style={{ display: 'flex', margin: '-32px -24px 0', minHeight: 'calc(100vh - 116px)', fontFamily: D.body }}>

      {/* ── LEFT SIDEBAR ────────────────────────────────────────────────── */}
      <aside style={{
        width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: D.lowest, borderRight: `1px solid ${D.border}`,
      }}>

        {/* Markets header */}
        <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, fontFamily: D.mono, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}>Markets</span>
          <Filter size={13} style={{ color: D.textMuted, cursor: 'pointer' }} />
        </div>

        {/* Search */}
        <div style={{ padding: '0 12px 12px', position: 'relative' }}>
          <Search size={12} style={{ position: 'absolute', left: 24, top: '50%', transform: 'translateY(-50%)', color: D.textMuted, pointerEvents: 'none' }} />
          <input
            type="text" placeholder="Search assets..." value={sidebarSearch}
            onChange={e => setSidebarSearch(e.target.value)}
            style={{
              width: '100%', background: D.surface, border: `1px solid ${D.border}`,
              borderRadius: 3, padding: '7px 10px 7px 32px',
              fontSize: 11, fontFamily: D.mono, color: D.text, outline: 'none',
              boxSizing: 'border-box' as const,
            }}
          />
        </div>

        {/* Company list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
          {sidebarCompanies.map(c => {
            const active = c.symbol === selectedSymbol
            const up = c.forecast_30d_upside_pct
            return (
              <button key={c.symbol}
                onClick={() => { setSelectedSymbol(c.symbol); setSidebarSearch('') }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', borderRadius: 3, cursor: 'pointer', marginBottom: 2,
                  background: active ? `${D.primary}12` : 'transparent',
                  border: `1px solid ${active ? `${D.primary}25` : 'transparent'}`,
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = D.surface }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: 3, flexShrink: 0,
                  background: active ? `${D.primary}20` : D.high,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, fontFamily: D.mono,
                  color: active ? D.primary : D.textMuted,
                }}>
                  {getInitials(c.symbol)}
                </div>
                {/* Labels */}
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, fontFamily: D.mono, color: D.text, lineHeight: 1.2 }}>{c.symbol}</div>
                  <div style={{ fontSize: 9, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: D.mono, marginTop: 1 }}>{c.company_name.slice(0, 14)}</div>
                </div>
                {/* Upside */}
                <div style={{ fontSize: 11, fontWeight: 700, fontFamily: D.mono, color: up >= 0 ? D.tertiary : D.error, flexShrink: 0 }}>
                  {up >= 0 ? '+' : ''}{up.toFixed(1)}%
                </div>
              </button>
            )
          })}
        </div>

        {/* Metrics grid at bottom */}
        <div style={{ padding: 16, borderTop: `1px solid ${D.border}`, background: D.lowest }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {metrics.map(({ label, value }) => (
              <div key={label} style={{ background: D.surface, border: `1px solid ${D.border}`, borderRadius: 3, padding: '8px 10px' }}>
                <div style={{ fontSize: 9, fontFamily: D.mono, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 12, fontWeight: 700, fontFamily: D.mono, color: D.text }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── MAIN CHAT AREA ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: D.surface, minWidth: 0 }}>

        {/* Chat header */}
        <div style={{ padding: '16px 28px', borderBottom: `1px solid ${D.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <h1 style={{ fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', fontWeight: 700, letterSpacing: '-0.03em', margin: 0, background: 'linear-gradient(90deg, #adc6ff 0%, #4edea3 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              MarketPulse AI
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 3, background: 'rgba(78,222,163,0.08)', border: '1px solid rgba(78,222,163,0.25)' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: D.tertiary, display: 'inline-block', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 9, fontFamily: D.mono, color: D.tertiary, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 }}>Analyst Live</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 3, border: `1px solid ${D.border}`, background: 'transparent', color: D.textSec, fontSize: 11, fontFamily: D.mono, cursor: 'pointer' }}>
              History
            </button>
            <button
              onClick={() => setMessages([])}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 3, background: D.primary, color: '#002e6a', fontSize: 11, fontFamily: D.mono, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
              + New Analysis
            </button>
          </div>
        </div>

        {/* Amber disclaimer */}
        <div style={{ padding: '8px 28px', background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <AlertTriangle size={12} style={{ color: D.orange, flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontFamily: D.mono, color: '#fcd34d', letterSpacing: '0.02em' }}>
            AI explanations are grounded in dashboard data and are not financial advice.
          </span>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 0' }}>

          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, textAlign: 'center', opacity: 0.65 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: D.high, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <Sparkles size={24} style={{ color: D.primary }} />
              </div>
              <h3 style={{ fontSize: 20, fontWeight: 600, color: D.text, letterSpacing: '-0.02em', margin: '0 0 10px' }}>Ready for Intelligent Analysis</h3>
              <p style={{ fontSize: 13, color: D.textMuted, lineHeight: 1.6, maxWidth: 380 }}>
                Ask me anything about{' '}
                <span style={{ color: D.primary, fontFamily: D.mono, fontWeight: 600 }}>{company?.symbol ?? 'a company'}</span>
                {', its recent volatility, or institutional sentiment correlations.'}
              </p>
            </div>
          )}

          {/* Message thread */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
                {/* Avatar */}
                <div style={{
                  width: 30, height: 30, borderRadius: 4, flexShrink: 0, marginTop: 2,
                  background: msg.role === 'assistant' ? `${D.secondary}18` : `${D.primary}18`,
                  border: `1px solid ${msg.role === 'assistant' ? `${D.secondary}30` : `${D.primary}30`}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {msg.role === 'assistant'
                    ? <Sparkles size={12} style={{ color: D.secondary }} />
                    : <span style={{ fontSize: 9, fontWeight: 700, fontFamily: D.mono, color: D.primary }}>YOU</span>
                  }
                </div>
                {/* Bubble */}
                <div style={{ maxWidth: '80%' }}>
                  {msg.role === 'assistant' && (
                    <div style={{ fontSize: 10, fontFamily: D.mono, color: D.secondary, marginBottom: 6, letterSpacing: '0.02em' }}>
                      MarketPulse AI <span style={{ color: D.textMuted }}>· Just now</span>
                    </div>
                  )}
                  <div style={msg.role === 'assistant'
                    ? { background: D.container, border: `1px solid ${D.border}`, borderRadius: '4px 12px 12px 12px', padding: '12px 16px' }
                    : { background: `${D.secondary}12`, border: `1px solid ${D.secondary}25`, borderRadius: '12px 4px 12px 12px', padding: '12px 16px', fontSize: 13, lineHeight: 1.7, color: D.text, whiteSpace: 'pre-wrap' }
                  }>
                    {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading typing indicator */}
            {loading && (
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 30, height: 30, borderRadius: 4, flexShrink: 0, background: `${D.secondary}18`, border: `1px solid ${D.secondary}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={12} style={{ color: D.secondary }} />
                </div>
                <div style={{ background: D.container, border: `1px solid ${D.border}`, borderRadius: '4px 12px 12px 12px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {[0, 1, 2].map(j => (
                    <div key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: D.textMuted, animation: 'bounce 1.2s infinite', animationDelay: `${j * 0.2}s` }} />
                  ))}
                  <span style={{ fontSize: 11, fontFamily: D.mono, color: D.textMuted, marginLeft: 4 }}>Analyzing...</span>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 4, fontSize: 11, fontFamily: D.mono, color: D.orange }}>
                <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
                AI Analyst temporarily unavailable. Try the Learn tab to explore metrics.
              </div>
            )}
          </div>

          <div ref={bottomRef} style={{ height: 28 }} />
        </div>

        {/* ── Input area ──────────────────────────────────────────────────── */}
        <div style={{ padding: '16px 28px 24px', flexShrink: 0 }}>

          {/* Chips above input — dynamic, rotate on use */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {chipSlots.map((poolIdx, slotPos) => {
              const chip = promptPool[poolIdx % promptPool.length]
              return (
                <button key={`${slotPos}-${poolIdx}`} onClick={() => handleChipClick(slotPos)} disabled={loading}
                  style={{ ...chipStyle(), opacity: loading ? 0.4 : 1 }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = `${D.primary}50`; (e.currentTarget as HTMLElement).style.color = D.textSec }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = D.border; (e.currentTarget as HTMLElement).style.color = D.textMuted }}>
                  {chip}
                </button>
              )
            })}
          </div>

          {/* Textarea container */}
          <div style={{
            background: D.container, border: `1px solid rgba(66,71,84,0.6)`,
            borderRadius: 8, padding: 14,
            boxShadow: input ? '0 0 0 1px rgba(173,198,255,0.15), 0 0 20px rgba(173,198,255,0.04)' : 'none',
            transition: 'box-shadow 0.2s',
          }}
            onFocusCapture={e => (e.currentTarget as HTMLElement).style.borderColor = `${D.primary}40`}
            onBlurCapture={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(66,71,84,0.6)'}
          >
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder={company
                ? `Analyze market trends, cross-asset correlations, or specific tickers...`
                : 'Analyze market trends, cross-asset correlations, or specific tickers...'}
              rows={3}
              style={{
                width: '100%', resize: 'none', background: 'transparent',
                border: 'none', outline: 'none', color: D.text,
                fontSize: 13, fontFamily: D.body, lineHeight: 1.6,
                boxSizing: 'border-box' as const,
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${D.border}` }}>
              {/* Toolbar icons */}
              <div style={{ display: 'flex', gap: 14, color: D.textMuted }}>
                <TrendingUp size={15} style={{ cursor: 'pointer' }} />
                <BarChart2 size={15} style={{ cursor: 'pointer' }} />
                <Paperclip size={15} style={{ cursor: 'pointer' }} />
              </div>
              {/* Send */}
              <button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 20px', borderRadius: 6,
                  background: D.primary, color: '#002e6a',
                  fontSize: 12, fontFamily: D.mono, fontWeight: 700,
                  border: 'none', cursor: 'pointer',
                  opacity: loading || !input.trim() ? 0.4 : 1,
                  letterSpacing: '0.04em', transition: 'opacity 0.15s',
                }}>
                Process Analysis
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* Clear chat */}
          {messages.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
              <button onClick={() => { setMessages([]); setError(null) }}
                style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontFamily: D.mono, color: D.textMuted, background: 'transparent', border: `1px solid ${D.border}`, padding: '4px 10px', borderRadius: 3, cursor: 'pointer' }}>
                <X size={9} /> Clear conversation
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.35} }
        @keyframes bounce { 0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)} }
      `}</style>
    </div>
  )
}
