'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import {
  ComposedChart, Line, Bar, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'
import { Info, AlertTriangle, ZoomIn, RefreshCw, RotateCcw, Download } from 'lucide-react'
import type { CompanySummary, ActualVsPredicted, FutureForecast } from '@/lib/types'
import { formatCurrency } from '@/lib/formatters'

interface Props {
  companies: CompanySummary[]
  actualVsPredicted: ActualVsPredicted[]
  futureForecast: FutureForecast[]
  defaultSymbol?: string
}

const PRESET_RANGES = [
  { label: '30D', days: 30 },
  { label: '60D', days: 60 },
  { label: '90D', days: 90 },
  { label: '180D', days: 180 },
  { label: 'All', days: 0 },
]

// Colors
const C = {
  actual:    { stroke: '#e2e2e2', width: 2.5, dash: undefined },
  close:     { stroke: '#8c909f', width: 1,   dash: '3 3' },
  adaptive:  { stroke: '#adc6ff', width: 2.5, dash: undefined },
  xgboost:   { stroke: '#F472B6', width: 2,   dash: undefined },
  momentum:  { stroke: '#4edea3', width: 1.5, dash: '5 3' },
  naive:     { stroke: '#fb923c', width: 1.5, dash: '5 3' },
  movavg:    { stroke: '#4ADE80', width: 1.5, dash: '5 3' },
  drift:     { stroke: '#94A3B8', width: 1,   dash: '3 3' },
  linear:    { stroke: '#d0bcff', width: 1.5, dash: '6 3' },
  ensemble:  { stroke: '#fb923c', width: 2.5, dash: undefined },
  band:      '#adc6ff',
}

const AVP_COLORS: Record<string, string> = {
  actual_price: '#e2e2e2',
  predicted_naive: '#fb923c',
  predicted_moving_average_30d: '#4ADE80',
  predicted_drift: '#adc6ff',
  predicted_recent_linear_trend_252d: '#d0bcff',
}

// Stitch design tokens
const D = {
  bg: '#121414', card: '#1a1c1c', elevated: '#1e2020',
  border: 'rgba(255,255,255,0.08)', borderV: '#424754',
  text: '#e2e2e2', textSec: '#c2c6d6', textMuted: '#8c909f',
  mono: 'JetBrains Mono, monospace',
  body: 'Inter, system-ui, sans-serif',
}

export default function ForecastPerformance({ companies, actualVsPredicted, futureForecast, defaultSymbol }: Props) {
  const symbols = useMemo(() => Array.from(new Set(
    actualVsPredicted.length > 0
      ? actualVsPredicted.map(r => r.symbol)
      : companies.map(c => c.symbol)
  )).sort(), [actualVsPredicted, companies])

  const [selectedSymbol, setSelectedSymbol] = useState(defaultSymbol || symbols[0] || '')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [symbolSearch, setSymbolSearch] = useState('')
  const [rangeDays, setRangeDays] = useState(90)
  const [showLinearTrend, setShowLinearTrend] = useState(false)
  const [avpZoom, setAvpZoom] = useState({ startIdx: 0, endIdx: -1 })
  const [activeLegendKeys, setActiveLegendKeys] = useState<Set<string>>(new Set())
  const [selectedHorizon, setSelectedHorizon] = useState(30)
  const [ensembleMode, setEnsembleMode] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (defaultSymbol) setSelectedSymbol(defaultSymbol) }, [defaultSymbol])
  useEffect(() => { setAvpZoom({ startIdx: 0, endIdx: -1 }) }, [selectedSymbol])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false); setSymbolSearch('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const company = useMemo(() => companies.find(c => c.symbol === selectedSymbol), [companies, selectedSymbol])
  const avpData = useMemo(() =>
    actualVsPredicted.filter(r => r.symbol === selectedSymbol).sort((a, b) => a.date.localeCompare(b.date))
  , [actualVsPredicted, selectedSymbol])
  const ffData = useMemo(() =>
    futureForecast.filter(r => r.symbol === selectedSymbol).sort((a, b) => a.forecast_horizon - b.forecast_horizon)
  , [futureForecast, selectedSymbol])
  const hasActualData = avpData.length > 0

  // XGBoost availability — true only when at least one row has a non-null value
  const xgboostAvailable = useMemo(() =>
    ffData.some(r => r.forecast_xgboost_direct != null),
  [ffData])

  // Date range filter relative to data's last date
  const rangeFilteredAvp = useMemo(() => {
    if (!hasActualData || rangeDays === 0) return avpData
    if (!avpData.length) return avpData
    const latestDate = avpData[avpData.length - 1]?.date
    if (!latestDate) return avpData
    const cutoff = new Date(latestDate)
    cutoff.setDate(cutoff.getDate() - rangeDays)
    return avpData.filter(r => r.date >= cutoff.toISOString().slice(0, 10))
  }, [avpData, rangeDays, hasActualData])

  const zoomedAvp = useMemo(() => {
    const end = avpZoom.endIdx === -1 ? rangeFilteredAvp.length : avpZoom.endIdx
    return rangeFilteredAvp.slice(avpZoom.startIdx, end)
  }, [rangeFilteredAvp, avpZoom])

  const avpDomain = useMemo(() => {
    const vals = zoomedAvp.flatMap(r => [
      r.actual_price, r.predicted_naive, r.predicted_moving_average_30d,
      r.predicted_drift, r.predicted_recent_linear_trend_252d,
    ].filter((v): v is number => v != null && v > 0))
    if (!vals.length) return undefined
    const min = Math.min(...vals), max = Math.max(...vals)
    const pad = (max - min) * 0.04
    return [Math.floor(min - pad), Math.ceil(max + pad)] as [number, number]
  }, [zoomedAvp])

  // Per-model MAPE for Error by Model panel (matching Stitch design)
  const modelErrors = useMemo(() => {
    if (!avpData.length) return []
    const models = [
      { key: 'predicted_drift', label: 'Adaptive Momentum', color: C.adaptive.stroke },
      { key: 'predicted_recent_linear_trend_252d', label: 'XGBoost Direct', color: C.xgboost.stroke },
      { key: 'predicted_moving_average_30d', label: 'Weighted Ensemble', color: C.ensemble.stroke },
      { key: 'predicted_naive', label: 'Naive Drift', color: '#8c909f' },
    ]
    return models.map(m => {
      const key = m.key as keyof ActualVsPredicted
      const rows = avpData.filter(r => r[key] != null && r.actual_price > 0)
      if (!rows.length) return { ...m, mape: 0, barWidth: 0 }
      const mape = rows.reduce((s, r) => s + Math.abs((r.actual_price - (r[key] as number)) / r.actual_price) * 100, 0) / rows.length
      return { ...m, mape: parseFloat(mape.toFixed(2)) }
    }).sort((a, b) => a.mape - b.mape)
      .map(m => ({ ...m, barWidth: Math.min(100, (m.mape / 6) * 100) }))
  }, [avpData])

  const latestClose = ffData[0]?.latest_close ?? avpData[avpData.length - 1]?.actual_price ?? 0
  const recentHistory = useMemo(() => avpData.slice(-60), [avpData])

  const combinedData = useMemo(() => {
    const hist = recentHistory.map(r => ({
      date: r.date, actual_price: r.actual_price, type: 'history' as const,
    }))
    const fcast = ffData.map(r => ({
      date: r.forecast_date,
      forecast_naive: r.forecast_naive,
      forecast_moving_average_30d: r.forecast_moving_average_30d,
      forecast_drift: r.forecast_drift,
      forecast_linear_trend: r.forecast_recent_linear_trend_252d,
      forecast_momentum_10d: r.forecast_recent_momentum_10d,
      forecast_adaptive: r.forecast_adaptive_blended_momentum,
      forecast_lower: r.forecast_lower_band,
      forecast_upper: r.forecast_upper_band,
      forecast_xgboost: r.forecast_xgboost_direct,
      forecast_ensemble: r.forecast_weighted_ensemble,
      latest_close_line: latestClose,
      type: 'forecast' as const,
    }))
    return [...hist, ...fcast]
  }, [recentHistory, ffData, latestClose])

  // Domain — adapts to ensemble mode
  const combinedDomain = useMemo(() => {
    const vals = combinedData.flatMap(r => {
      if (ensembleMode) return [
        (r as any).actual_price,
        (r as any).forecast_ensemble,
        (r as any).latest_close_line,
      ].filter((x): x is number => x != null && x > 0)
      return [
        (r as any).actual_price, (r as any).forecast_adaptive,
        (r as any).latest_close_line, (r as any).forecast_naive,
        (r as any).forecast_moving_average_30d, (r as any).forecast_momentum_10d,
      ].filter((x): x is number => x != null && x > 0)
    })
    if (!vals.length) return undefined
    const min = Math.min(...vals), max = Math.max(...vals)
    const pad = (max - min) * 0.05
    return [Math.floor(min - pad), Math.ceil(max + pad)] as [number, number]
  }, [combinedData, ensembleMode])

  const maxHorizon = useMemo(() => ffData.length ? Math.max(...ffData.map(r => r.forecast_horizon)) : 30, [ffData])
  const selectedRow = useMemo(() => {
    if (!ffData.length) return null
    const exact = ffData.find(r => r.forecast_horizon === selectedHorizon)
    if (exact) return exact
    return ffData.reduce((prev, curr) =>
      Math.abs(curr.forecast_horizon - selectedHorizon) < Math.abs(prev.forecast_horizon - selectedHorizon) ? curr : prev
    )
  }, [ffData, selectedHorizon])
  const horizonMarkerDate = selectedRow?.forecast_date

  // High divergence check
  const highDivergence = useMemo(() => {
    if (!selectedRow || !latestClose) return false
    const adaptive = selectedRow.forecast_adaptive_blended_momentum
    if (adaptive == null) return false
    return Math.abs((adaptive - latestClose) / latestClose * 100) > 10
  }, [selectedRow, latestClose])

  const snapshotRows = selectedRow ? [
    { key: 'forecast_adaptive_blended_momentum', label: 'Adaptive Momentum', price: selectedRow.forecast_adaptive_blended_momentum, lower: selectedRow.forecast_lower_band, upper: selectedRow.forecast_upper_band, color: C.adaptive.stroke, isMain: true, status: 'STABLE' },
    // XGBoost row: only include when data is available for this symbol
    ...(xgboostAvailable ? [{ key: 'forecast_xgboost_direct', label: 'XGBoost Direct', price: selectedRow.forecast_xgboost_direct, lower: null, upper: null, color: C.xgboost.stroke, isMain: false, status: 'NEUTRAL' }] : []),
    { key: 'forecast_weighted_ensemble', label: 'Weighted Ensemble', price: selectedRow.forecast_weighted_ensemble, lower: null, upper: null, color: C.ensemble.stroke, isMain: false, status: 'NEUTRAL' },
    { key: 'forecast_naive', label: 'Naive Drift', price: selectedRow.forecast_naive, lower: null, upper: null, color: '#8c909f', isMain: false, status: 'REF' },
  ] : []

  const hasLegendFilter = activeLegendKeys.size > 0
  const isVisible = (key: string) => !hasLegendFilter || activeLegendKeys.has(key)
  const toggleLegendKey = (key: string) => setActiveLegendKeys(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key); else next.add(key)
    return next
  })

  const handleZoomIn = () => {
    const len = rangeFilteredAvp.length
    const mid = Math.floor((avpZoom.startIdx + (avpZoom.endIdx === -1 ? len : avpZoom.endIdx)) / 2)
    const quarter = Math.floor((avpZoom.endIdx === -1 ? len : avpZoom.endIdx - avpZoom.startIdx) / 4)
    setAvpZoom({ startIdx: Math.max(0, mid - quarter), endIdx: Math.min(len, mid + quarter) })
  }
  const handleZoomOut = () => setAvpZoom({ startIdx: 0, endIdx: -1 })

  const splitDate = recentHistory[recentHistory.length - 1]?.date
  const card = { background: D.card, border: `1px solid ${D.border}`, borderRadius: 8 }

  const filteredSymbols = symbols.filter(s => s.toLowerCase().includes(symbolSearch.toLowerCase()))

  // Confidence score bar (5 segments, filled based on MAPE)
  const ConfidenceBar = ({ mape }: { mape: number }) => {
    const filled = mape < 1 ? 5 : mape < 2 ? 4 : mape < 3 ? 3 : mape < 5 ? 2 : 1
    return (
      <div style={{ display: 'flex', gap: 2 }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} style={{ width: 18, height: 4, borderRadius: 2, background: i <= filled ? C.adaptive.stroke : 'rgba(255,255,255,0.1)' }} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ fontFamily: D.body }}>

      {/* ── Header + company selector ─────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, marginBottom: 32, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, color: D.text, fontFamily: D.body, marginBottom: 8 }}>
            Forecast <span style={{ color: '#adc6ff' }}>Performance</span>
          </h1>
          <p style={{ fontSize: 15, color: D.textMuted, lineHeight: 1.6 }}>
            Model back-test performance and 30-day forward projections — single company view
          </p>
        </div>

        {/* Company selector — Stitch style dropdown */}
        <div ref={dropdownRef} style={{ position: 'relative', minWidth: 260 }}>
          <button onClick={() => setDropdownOpen(v => !v)}
            style={{ ...card, display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', cursor: 'pointer', width: '100%', border: `1px solid ${dropdownOpen ? C.adaptive.stroke : D.border}` }}>
            <div style={{ flex: 1, textAlign: 'left' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: D.text, fontFamily: D.mono }}>{selectedSymbol || '—'}</span>
                {company && <span style={{ fontSize: 12, color: D.textMuted, fontFamily: D.body }}>{company.company_name}</span>}
              </div>
              {company && (
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: D.textMuted, fontFamily: D.mono }}>{company.sector}</span>
                  <span style={{ fontSize: 11, color: company.best_model_mape < 2 ? '#4edea3' : company.best_model_mape < 5 ? '#fb923c' : '#f87171', background: 'rgba(255,255,255,0.05)', padding: '1px 6px', borderRadius: 3, fontFamily: D.mono }}>
                    MAPE: {company.best_model_mape.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ color: D.textMuted, transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {dropdownOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50, background: '#1e2020', border: `1px solid ${D.border}`, borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
              <div style={{ padding: '8px 8px 6px', borderBottom: `1px solid ${D.border}` }}>
                <input type="text" placeholder="Search ticker…" value={symbolSearch}
                  onChange={e => setSymbolSearch(e.target.value)}
                  autoFocus
                  style={{ width: '100%', background: '#282a2b', border: `1px solid ${D.border}`, borderRadius: 4, padding: '6px 10px', fontSize: 12, color: D.text, outline: 'none', fontFamily: D.mono }} />
              </div>
              <div style={{ maxHeight: 260, overflowY: 'auto' }}>
                {filteredSymbols.slice(0, 50).map(s => {
                  const c = companies.find(x => x.symbol === s)
                  return (
                    <button key={s} onClick={() => { setSelectedSymbol(s); setDropdownOpen(false); setSymbolSearch('') }}
                      style={{ width: '100%', textAlign: 'left', padding: '8px 14px', background: s === selectedSymbol ? 'rgba(173,198,255,0.08)' : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: s === selectedSymbol ? C.adaptive.stroke : D.text, fontFamily: D.mono }}>{s}</span>
                      {c && <span style={{ fontSize: 11, color: D.textMuted, fontFamily: D.body }}>{c.sector}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 1: AVP chart + Error by Model panel (Stitch 2-col) ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, marginBottom: 16 }}>

        {/* AVP chart */}
        <div style={card}>
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: D.text, fontFamily: D.body }}>Actual vs. Predicted Price by Model</h3>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {PRESET_RANGES.map(p => (
                <button key={p.label} onClick={() => { setRangeDays(p.days); setAvpZoom({ startIdx: 0, endIdx: -1 }) }}
                  style={{ fontSize: 12, padding: '4px 10px', borderRadius: 4, border: `1px solid ${rangeDays === p.days ? C.adaptive.stroke : D.border}`, background: rangeDays === p.days ? 'rgba(173,198,255,0.12)' : 'transparent', color: rangeDays === p.days ? C.adaptive.stroke : D.textMuted, cursor: 'pointer', fontFamily: D.mono }}>
                  {p.label}
                </button>
              ))}
              <div style={{ width: 1, height: 16, background: D.border, marginInline: 4 }} />
              <button onClick={handleZoomIn} style={{ padding: '4px 6px', border: `1px solid ${D.border}`, borderRadius: 4, background: 'transparent', cursor: 'pointer', color: D.textMuted }}>
                <ZoomIn size={12} />
              </button>
              <button onClick={handleZoomOut} style={{ padding: '4px 6px', border: `1px solid ${D.border}`, borderRadius: 4, background: 'transparent', cursor: 'pointer', color: D.textMuted }}>
                <RefreshCw size={12} />
              </button>
            </div>
          </div>
          <div style={{ padding: 4 }}>
            <ResponsiveContainer key={`avp-${selectedSymbol}`} width="100%" height={280}>
              <ComposedChart data={zoomedAvp} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="date" tick={{ fill: D.textMuted, fontSize: 10, fontFamily: D.mono }}
                  tickFormatter={d => d?.slice(5)} interval={Math.max(1, Math.floor(zoomedAvp.length / 7))} axisLine={false} />
                <YAxis tick={{ fill: D.textMuted, fontSize: 10, fontFamily: D.mono }}
                  tickFormatter={v => `$${v.toFixed(0)}`} width={52} domain={avpDomain} axisLine={false} />
                <Tooltip content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div style={{ background: '#1e2020', border: `1px solid ${D.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 12, fontFamily: D.mono }}>
                      <div style={{ color: D.textMuted, marginBottom: 6 }}>{label}</div>
                      {payload.filter(p => p.value != null).map(p => (
                        <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 24, color: p.color as string }}>
                          <span>{p.dataKey === 'actual_price' ? 'Actual' : p.dataKey === 'predicted_drift' ? 'Adaptive' : String(p.dataKey).replace('predicted_', '')}</span>
                          <span style={{ color: D.text }}>{formatCurrency(p.value as number)}</span>
                        </div>
                      ))}
                    </div>
                  )
                }} />
                <Line type="monotone" dataKey="actual_price" stroke={C.actual.stroke} strokeWidth={C.actual.width} dot={false} connectNulls name="Actual" />
                <Line type="monotone" dataKey="predicted_drift" stroke={C.adaptive.stroke} strokeWidth={1.5} dot={false} connectNulls name="Adaptive" />
                <Line type="monotone" dataKey="predicted_naive" stroke={C.naive.stroke} strokeWidth={1} strokeDasharray="4 2" dot={false} strokeOpacity={0.6} connectNulls name="Naive" />
                <Line type="monotone" dataKey="predicted_moving_average_30d" stroke={C.movavg.stroke} strokeWidth={1} strokeDasharray="4 2" dot={false} strokeOpacity={0.6} connectNulls name="MovAvg" />
                <Line type="monotone" dataKey="predicted_recent_linear_trend_252d" stroke={C.linear.stroke} strokeWidth={1} strokeDasharray="4 2" dot={false} strokeOpacity={0.6} connectNulls name="Linear" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {/* Legend row */}
          <div style={{ padding: '8px 20px 14px', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { color: C.actual.stroke, label: 'Actual Price', solid: true },
              { color: C.adaptive.stroke, label: 'Adaptive Momentum', solid: true },
              { color: C.naive.stroke, label: 'Naive Baseline', solid: false },
              { color: C.linear.stroke, label: 'Linear Trend', solid: false },
            ].map(({ color, label, solid }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: D.textMuted, fontFamily: D.body }}>
                <svg width="16" height="4">
                  <line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth={solid ? 2 : 1.5} strokeDasharray={solid ? '' : '4 2'} />
                </svg>
                {label}
              </div>
            ))}
            <button onClick={handleZoomOut} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: D.textMuted, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: D.body }}>
              <RefreshCw size={10} /> Reset
            </button>
          </div>
        </div>

        {/* Right panel: Error by Model + Adaptive Momentum info card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Error by Model */}
          <div style={{ ...card, padding: '16px 20px', flex: 1 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: D.text, fontFamily: D.body, marginBottom: 16 }}>Error by Model</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {modelErrors.map(m => (
                <div key={m.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: D.textSec, fontFamily: D.mono }}>{m.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: m.color, fontFamily: D.mono }}>{m.mape.toFixed(1)}% MAPE</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${m.barWidth}%`, background: m.color, borderRadius: 2, opacity: 0.8 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Adaptive Momentum info card */}
          <div style={{ ...card, padding: '14px 18px', background: '#1e2020', border: `1px solid rgba(173,198,255,0.15)` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Info size={14} style={{ color: C.adaptive.stroke, flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 600, color: D.text, fontFamily: D.body }}>Adaptive Momentum</span>
            </div>
            <p style={{ fontSize: 12, color: D.textSec, lineHeight: 1.6, fontFamily: D.body }}>
              Our main model blends recent 5D, 10D, 21D, 63D, and 252D momentum with damping, reacting to recent trends without overreacting to short-term noise.
              {company && <> Currently <strong style={{ color: C.adaptive.stroke }}>
                {(company.forecast_30d_upside_pct ?? 0) >= 0 ? 'Bullish' : 'Bearish'} Signal
              </strong> in {selectedSymbol}.</>}
            </p>
          </div>
        </div>
      </div>

      {/* ── Row 2: Forecast path chart ───────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 16 }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: D.text, fontFamily: D.body, marginBottom: 2 }}>
              Recent Price History + 30-Day Forecast Path
            </h3>
            <p style={{ fontSize: 12, color: D.textMuted }}>Last 60 trading days of actual price, then 30-day forward projections</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* All Models / Weighted Ensemble toggle */}
            <div style={{ display: 'flex', background: '#1e2020', border: `1px solid ${D.border}`, borderRadius: 6, padding: 3, gap: 2 }}>
              <button onClick={() => { setEnsembleMode(false); setActiveLegendKeys(new Set()) }}
                style={{ fontSize: 12, padding: '5px 14px', borderRadius: 4, border: `1px solid ${!ensembleMode ? D.borderV : 'transparent'}`, background: !ensembleMode ? D.card : 'transparent', color: !ensembleMode ? D.text : D.textMuted, cursor: 'pointer', fontFamily: D.body, fontWeight: !ensembleMode ? 500 : 400, transition: 'all 0.2s' }}>
                All Models
              </button>
              <button onClick={() => { setEnsembleMode(true); setActiveLegendKeys(new Set()) }}
                style={{ fontSize: 12, padding: '5px 14px', borderRadius: 4, border: `1px solid ${ensembleMode ? 'rgba(251,146,60,0.4)' : 'transparent'}`, background: ensembleMode ? 'rgba(251,146,60,0.12)' : 'transparent', color: ensembleMode ? '#fb923c' : D.textMuted, cursor: 'pointer', fontFamily: D.body, fontWeight: ensembleMode ? 500 : 400, transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fb923c', display: 'inline-block' }} />
                Weighted Ensemble
              </button>
            </div>
            {/* Linear trend toggle — only in all-models mode */}
            {!ensembleMode && (
              <button onClick={() => setShowLinearTrend(v => !v)}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 4, border: `1px solid ${showLinearTrend ? 'rgba(208,188,255,0.35)' : D.border}`, background: showLinearTrend ? 'rgba(208,188,255,0.08)' : 'transparent', color: showLinearTrend ? '#d0bcff' : D.textMuted, cursor: 'pointer', fontFamily: D.body, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#d0bcff', display: 'inline-block' }} />
                {showLinearTrend ? 'Hide' : 'Show'} linear trend
              </button>
            )}
            {/* Reset legend — only in all-models mode */}
            {!ensembleMode && hasLegendFilter && (
              <button onClick={() => setActiveLegendKeys(new Set())}
                style={{ fontSize: 12, padding: '5px 12px', borderRadius: 4, border: '1px solid rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.08)', color: '#f87171', cursor: 'pointer', fontFamily: D.body, display: 'flex', alignItems: 'center', gap: 4 }}>
                <RotateCcw size={10} /> Reset lines
              </button>
            )}
          </div>
        </div>

        {/* Interactive legend — hidden in ensemble mode */}
        {!ensembleMode && (
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[
              { key: 'actual_price', label: 'Actual Price', color: C.actual.stroke, solid: true, wide: 2.5 },
              { key: 'latest_close_line', label: 'Latest Close', color: C.close.stroke, solid: false, wide: 1 },
              { key: 'forecast_adaptive', label: 'Adaptive Momentum (main)', color: C.adaptive.stroke, solid: true, wide: 2.5 },
              { key: 'forecast_momentum_10d', label: 'Momentum 10D', color: C.momentum.stroke, solid: false, wide: 1.5 },
              { key: 'forecast_naive', label: 'Naive', color: C.naive.stroke, solid: false, wide: 1.5 },
              { key: 'forecast_moving_average_30d', label: 'Moving Avg 30D', color: C.movavg.stroke, solid: false, wide: 1.5 },
              { key: 'forecast_drift', label: 'Drift Scenario', color: C.drift.stroke, solid: false, wide: 1 },
              { key: 'forecast_xgboost', label: 'XGBoost Direct', color: C.xgboost.stroke, solid: true, wide: 2, xgbOnly: true },
            ].map(({ key, label, color, solid, wide, ...rest }) => {
              // XGBoost-only: show greyed-out "unavailable" pill when data is absent
              if ((rest as any).xgbOnly && !xgboostAvailable) {
                return (
                  <div key={key}
                    title="XGBoost data is not available for this symbol"
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)', background: 'transparent', color: '#424754', cursor: 'not-allowed', fontFamily: D.body, userSelect: 'none' as const }}>
                    <svg width="16" height="4">
                      <line x1="0" y1="2" x2="16" y2="2" stroke="#424754" strokeWidth={1} strokeDasharray="3 2" />
                    </svg>
                    {label}
                    <span style={{ fontSize: 10, color: '#424754', marginLeft: 2 }}>· unavailable</span>
                  </div>
                )
              }
              const active = !hasLegendFilter || activeLegendKeys.has(key)
              return (
                <button key={key} onClick={() => toggleLegendKey(key)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px', borderRadius: 4, border: `1px solid ${active ? color + '35' : 'rgba(255,255,255,0.06)'}`, background: active ? color + '10' : 'transparent', color: active ? D.textSec : D.textMuted, opacity: active ? 1 : 0.4, cursor: 'pointer', fontFamily: D.body, transition: 'all 0.15s' }}>
                  <svg width="16" height="4">
                    <line x1="0" y1="2" x2="16" y2="2" stroke={color} strokeWidth={wide} strokeDasharray={solid ? '' : '4 2'} />
                  </svg>
                  {label}
                </button>
              )
            })}
            {/* Confidence band */}
            <button onClick={() => { toggleLegendKey('forecast_upper'); toggleLegendKey('forecast_lower') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px', borderRadius: 4, border: `1px solid rgba(173,198,255,0.2)`, background: 'rgba(173,198,255,0.05)', color: D.textSec, cursor: 'pointer', fontFamily: D.body }}>
              <span style={{ width: 12, height: 8, background: 'rgba(173,198,255,0.25)', borderRadius: 2, display: 'inline-block' }} />
              Confidence Band
            </button>
          </div>
        )}

        {/* Ensemble mode legend */}
        {ensembleMode && (
          <div style={{ padding: '12px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: D.textSec, fontFamily: D.body }}>
              <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={C.ensemble.stroke} strokeWidth={2.5} /></svg>
              Weighted Ensemble
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: D.textMuted, fontFamily: D.body }}>
              <svg width="20" height="4"><line x1="0" y1="2" x2="20" y2="2" stroke={C.actual.stroke} strokeWidth={2.5} /></svg>
              Actual Price
            </div>
            <span style={{ fontSize: 11, color: D.textMuted, fontFamily: D.mono, marginLeft: 8 }}>
              Constrained dynamic ensemble · Excludes XGBoost
            </span>
          </div>
        )}

        {/* The main chart */}
        <div style={{ padding: 4 }}>
          <ResponsiveContainer key={`forecast-${selectedSymbol}-${ensembleMode ? 'ens' : 'all'}`} width="100%" height={320}>
            <ComposedChart data={combinedData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="date" tick={{ fill: D.textMuted, fontSize: 10, fontFamily: D.mono }}
                tickFormatter={d => d?.slice(5)} interval={Math.max(1, Math.floor(combinedData.length / 10))} axisLine={false} />
              <YAxis tick={{ fill: D.textMuted, fontSize: 10, fontFamily: D.mono }}
                tickFormatter={v => `$${v.toFixed(0)}`} width={56} domain={combinedDomain} axisLine={false} />
              {splitDate && (
                <ReferenceLine x={splitDate} stroke="rgba(255,255,255,0.12)" strokeDasharray="6 3" strokeWidth={1}
                  label={{ value: '← History  |  Forecast →', position: 'insideTopLeft', fill: D.textMuted, fontSize: 10, dy: -4 }} />
              )}
              {horizonMarkerDate && horizonMarkerDate !== splitDate && (
                <ReferenceLine x={horizonMarkerDate} stroke={C.adaptive.stroke} strokeDasharray="4 2" strokeWidth={1} strokeOpacity={0.5}
                  label={{ value: `Day ${selectedHorizon}`, position: 'insideTopRight', fill: C.adaptive.stroke, fontSize: 9, dy: 8 }} />
              )}
              <ReferenceLine y={latestClose} stroke="rgba(255,255,255,0.08)" strokeDasharray="4 2" strokeWidth={1}
                label={{ value: `$${latestClose.toFixed(2)}`, position: 'insideTopRight', fill: D.textMuted, fontSize: 9 }} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                const isForecast = splitDate ? (label as string) > splitDate : false
                const filtered = payload.filter(p => p.value != null && p.dataKey !== 'latest_close_line' && p.dataKey !== 'forecast_upper' && p.dataKey !== 'forecast_lower')
                if (!filtered.length) return null
                const keyMap: Record<string,string> = {
                  actual_price: 'Actual Price', forecast_adaptive: 'Adaptive Momentum',
                  forecast_ensemble: 'Weighted Ensemble', forecast_xgboost: 'XGBoost Direct',
                  forecast_naive: 'Naive', forecast_moving_average_30d: 'Moving Avg 30D',
                  forecast_momentum_10d: 'Momentum 10D', forecast_drift: 'Drift Scenario',
                  forecast_linear_trend: 'Linear Trend',
                }
                return (
                  <div style={{ background: '#1e2020', border: `1px solid ${D.border}`, borderRadius: 6, padding: '10px 14px', fontSize: 12, fontFamily: D.mono, minWidth: 180 }}>
                    <div style={{ color: D.textMuted, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {label}
                      {isForecast && <span style={{ fontSize: 10, color: C.adaptive.stroke, background: 'rgba(173,198,255,0.1)', padding: '1px 5px', borderRadius: 3 }}>Forecast</span>}
                    </div>
                    {filtered.map(p => (
                      <div key={p.dataKey} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, color: p.color as string, marginBottom: 2 }}>
                        <span>{keyMap[p.dataKey as string] ?? p.dataKey}</span>
                        <span style={{ color: D.text }}>{formatCurrency(p.value as number)}</span>
                      </div>
                    ))}
                  </div>
                )
              }} />

              {/* Always show actual price */}
              <Line type="monotone" dataKey="actual_price" stroke={C.actual.stroke} strokeWidth={2.5} dot={false} connectNulls />

              {ensembleMode ? (
                /* ENSEMBLE MODE — only ensemble line */
                <Line type="monotone" dataKey="forecast_ensemble" stroke={C.ensemble.stroke} strokeWidth={2.5} dot={false} connectNulls />
              ) : (
                /* ALL MODELS MODE — full set */
                <>
                  {isVisible('latest_close_line') && <Line type="monotone" dataKey="latest_close_line" stroke={C.close.stroke} strokeWidth={1} strokeDasharray="3 3" dot={false} connectNulls />}
                  {isVisible('forecast_adaptive') && <Line type="monotone" dataKey="forecast_adaptive" stroke={C.adaptive.stroke} strokeWidth={2.5} dot={false} connectNulls />}
                  {isVisible('forecast_momentum_10d') && <Line type="monotone" dataKey="forecast_momentum_10d" stroke={C.momentum.stroke} strokeWidth={1.5} strokeDasharray="5 3" dot={false} strokeOpacity={0.7} connectNulls />}
                  {isVisible('forecast_naive') && <Line type="monotone" dataKey="forecast_naive" stroke={C.naive.stroke} strokeWidth={1.5} strokeDasharray="5 3" dot={false} strokeOpacity={0.75} connectNulls />}
                  {isVisible('forecast_moving_average_30d') && <Line type="monotone" dataKey="forecast_moving_average_30d" stroke={C.movavg.stroke} strokeWidth={1.5} strokeDasharray="5 3" dot={false} strokeOpacity={0.75} connectNulls />}
                  {isVisible('forecast_drift') && <Line type="monotone" dataKey="forecast_drift" stroke={C.drift.stroke} strokeWidth={1} strokeDasharray="3 3" dot={false} strokeOpacity={0.45} connectNulls />}
                  {xgboostAvailable && isVisible('forecast_xgboost') && <Line type="monotone" dataKey="forecast_xgboost" stroke={C.xgboost.stroke} strokeWidth={2} dot={false} strokeOpacity={0.9} connectNulls />}
                  {(isVisible('forecast_upper')) && <Area type="monotone" dataKey="forecast_upper" stroke="none" fill={C.band} fillOpacity={0.07} connectNulls />}
                  {(isVisible('forecast_lower')) && <Area type="monotone" dataKey="forecast_lower" stroke="none" fill={C.band} fillOpacity={0.07} connectNulls baseValue="dataMax" />}
                  {showLinearTrend && isVisible('forecast_linear_trend') && <Line type="monotone" dataKey="forecast_linear_trend" stroke={C.linear.stroke} strokeWidth={1.5} strokeDasharray="6 3" dot={false} connectNulls />}
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Row 3: Forecast Horizon slider ───────────────────────────────── */}
      <div style={{ ...card, padding: '16px 24px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: D.text, fontFamily: D.body, marginBottom: 2 }}>Forecast Horizon</h3>
          <p style={{ fontSize: 12, color: D.textMuted }}>Projecting path density for 1 to {maxHorizon} days</p>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 11, fontFamily: D.mono, color: D.textMuted }}>
            <span>Day 1</span>
            <span style={{ color: C.adaptive.stroke, fontWeight: 600 }}>Day {selectedHorizon} (Selected)</span>
            <span>Day {maxHorizon}</span>
          </div>
          <input type="range" min={1} max={maxHorizon} value={selectedHorizon}
            onChange={e => setSelectedHorizon(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: C.adaptive.stroke }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {[7, 14, 21, 30].filter(d => d <= maxHorizon).map(d => (
              <button key={d} onClick={() => setSelectedHorizon(d)}
                style={{ fontSize: 11, padding: '3px 10px', borderRadius: 3, border: `1px solid ${selectedHorizon === d ? C.adaptive.stroke : D.border}`, background: selectedHorizon === d ? 'rgba(173,198,255,0.1)' : 'transparent', color: selectedHorizon === d ? C.adaptive.stroke : D.textMuted, cursor: 'pointer', fontFamily: D.mono }}>
                {d}D
              </button>
            ))}
          </div>
        </div>
        {/* Signal alert */}
        {highDivergence && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.25)', borderRadius: 6, padding: '10px 16px' }}>
            <AlertTriangle size={16} style={{ color: '#fb923c', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 10, fontFamily: D.mono, color: '#fb923c', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>Signal Alert</div>
              <div style={{ fontSize: 12, color: D.textSec, fontFamily: D.body }}>High Divergence Warning</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Row 4: Forecast Snapshot table ───────────────────────────────── */}
      {selectedRow && (
        <div style={card}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${D.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: D.text, fontFamily: D.body }}>
              Forecast Snapshot — Day {selectedHorizon}
            </h3>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: D.textMuted, background: 'transparent', border: `1px solid ${D.border}`, padding: '5px 12px', borderRadius: 4, cursor: 'pointer', fontFamily: D.body }}>
              <Download size={11} /> Export Data
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${D.border}` }}>
                  {['Model Identity', 'Target Price', 'Lower Bound (95%)', 'Upper Bound (95%)', 'Confidence Score', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontFamily: D.mono, color: D.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {snapshotRows.map(row => {
                  if (row.price == null) return null
                  const upside = latestClose > 0 ? ((row.price - latestClose) / latestClose * 100) : 0
                  const mape = company?.best_model_mape ?? 3
                  const statusColor = row.status === 'STABLE' ? '#4edea3' : row.status === 'HIGH VAR' ? '#f87171' : D.textMuted
                  return (
                    <tr key={row.key} style={{ borderBottom: `1px solid ${D.border}`, background: row.isMain ? 'rgba(173,198,255,0.03)' : 'transparent' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {row.isMain && <span style={{ fontSize: 12, color: C.adaptive.stroke }}>✦</span>}
                          <span style={{ fontSize: 14, fontWeight: row.isMain ? 600 : 400, color: row.isMain ? C.adaptive.stroke : D.textSec, fontFamily: D.mono }}>{row.label}</span>
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 14, fontFamily: D.mono, color: D.text }}>{formatCurrency(row.price)}</td>
                      <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: D.mono, color: D.textMuted }}>
                        {row.lower != null ? formatCurrency(row.lower) : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, fontFamily: D.mono, color: D.textMuted }}>
                        {row.upper != null ? formatCurrency(row.upper) : '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <ConfidenceBar mape={mape} />
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ fontSize: 11, fontFamily: D.mono, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}35`, padding: '3px 8px', borderRadius: 3 }}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
