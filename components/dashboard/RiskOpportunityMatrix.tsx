'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { RotateCcw, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react'
import type { CompanySummary } from '@/lib/types'

interface Props {
  companies: CompanySummary[]
  onSelectCompany: (c: CompanySummary) => void
}

const ALL = 'All'

const D = {
  bg:        '#121414',
  lowest:    '#0c0f0f',
  surface:   '#1a1c1c',
  container: '#1e2020',
  highest:   '#282a2b',
  border:    'rgba(66,71,84,0.2)',
  borderHi:  'rgba(66,71,84,0.45)',
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

const SIGNAL_COLORS: Record<string, string> = {
  'Potential Opportunity':                    '#d0bcff',
  'Stable Watchlist':                         '#4edea3',
  'High Volatility Speculative':              '#adc6ff',
  'Needs Further Review':                     '#f59e0b',
  'Weak Fundamentals / Negative Forecast':    '#ffb4ab',
}

const SIGNAL_LEGEND: Array<{ key: string; label: string }> = [
  { key: 'Potential Opportunity',                 label: 'Strong Buy (Signal+)' },
  { key: 'Stable Watchlist',                      label: 'Accumulate' },
  { key: 'High Volatility Speculative',           label: 'Market Neutral' },
  { key: 'Needs Further Review',                  label: 'Underperform' },
  { key: 'Weak Fundamentals / Negative Forecast', label: 'Sell / High Risk' },
]

const selectStyle: React.CSSProperties = {
  width: '100%', background: D.bg, border: `1px solid ${D.borderHi}`,
  color: D.text, borderRadius: 4, padding: '8px 12px',
  fontSize: 12, fontFamily: D.mono, outline: 'none', cursor: 'pointer',
  appearance: 'none' as const,
}

interface TooltipState {
  c: CompanySummary
  x: number  // px from left of SVG container
  y: number  // px from top of SVG container
}

export default function RiskOpportunityMatrix({ companies, onSelectCompany }: Props) {
  const [filterSector, setFilterSector]     = useState(ALL)
  const [filterSignal, setFilterSignal]     = useState(ALL)
  const [filterRisk, setFilterRisk]         = useState<'All'|'Low'|'Med'|'High'>('All')
  const [upsideMinInput, setUpsideMinInput] = useState('')
  const [upsideMaxInput, setUpsideMaxInput] = useState('')
  const [upsideMin, setUpsideMin]           = useState('')
  const [upsideMax, setUpsideMax]           = useState('')
  const [tooltip, setTooltip]               = useState<TooltipState | null>(null)
  const [svgSize, setSvgSize]               = useState({ w: 800, h: 520 })

  // Zoom: pan offset and scale — all in data-space fractions
  const [zoomScale, setZoomScale]   = useState(1)
  const [panOffset, setPanOffset]   = useState({ x: 0, y: 0 })

  const svgRef  = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Track real SVG pixel size
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSvgSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const riskMap = (r: string) =>
    r === 'Low Risk' ? 'Low' : r === 'Moderate Risk' ? 'Med' : 'High'

  const sectorOptions = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.sector))).sort()], [companies])
  const signalOptions = useMemo(() => [ALL, ...Array.from(new Set(companies.map(c => c.final_signal))).sort()], [companies])

  const filtered = useMemo(() => companies.filter(c => {
    if (filterSector !== ALL && c.sector !== filterSector) return false
    if (filterSignal !== ALL && c.final_signal !== filterSignal) return false
    if (filterRisk !== 'All' && riskMap(c.risk_level) !== filterRisk) return false
    if (upsideMin !== '' && c.forecast_30d_upside_pct < parseFloat(upsideMin)) return false
    if (upsideMax !== '' && c.forecast_30d_upside_pct > parseFloat(upsideMax)) return false
    return true
  }), [companies, filterSector, filterSignal, filterRisk, upsideMin, upsideMax])

  const applyUpside = () => { setUpsideMin(upsideMinInput); setUpsideMax(upsideMaxInput) }
  const resetFilters = () => {
    setFilterSector(ALL); setFilterSignal(ALL); setFilterRisk('All')
    setUpsideMinInput(''); setUpsideMaxInput('')
    setUpsideMin(''); setUpsideMax('')
    setZoomScale(1); setPanOffset({ x: 0, y: 0 })
  }

  // Data extents — computed from ALL companies (not filtered) so axes stay stable
  const [xMin, xMax] = useMemo(() => {
    const xs = companies.map(c => c.forecast_30d_upside_pct)
    const mn = Math.min(...xs), mx = Math.max(...xs)
    const pad = (mx - mn) * 0.06
    return [mn - pad, mx + pad]
  }, [companies])

  const [yMin, yMax] = useMemo(() => {
    const ys = companies.map(c => c.annualized_volatility_pct)
    const mn = Math.min(...ys), mx = Math.max(...ys)
    const pad = (mx - mn) * 0.06
    return [Math.max(0, mn - pad), mx + pad]
  }, [companies])

  // Median volatility for horizontal dashed line
  const medianVol = useMemo(() => {
    const sorted = [...companies].map(c => c.annualized_volatility_pct).sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] ?? 30
  }, [companies])

  // Padding inside the SVG for axis labels
  const PAD = { top: 24, right: 24, bottom: 32, left: 40 }

  // Convert data value → SVG pixel coordinate (within padded plot area)
  const toSvgX = useCallback((v: number) => {
    const plotW = svgSize.w - PAD.left - PAD.right
    const frac = (v - xMin) / (xMax - xMin)
    return PAD.left + frac * plotW * zoomScale + panOffset.x
  }, [svgSize.w, xMin, xMax, zoomScale, panOffset.x])

  const toSvgY = useCallback((v: number) => {
    const plotH = svgSize.h - PAD.top - PAD.bottom
    const frac = 1 - (v - yMin) / (yMax - yMin)
    return PAD.top + frac * plotH * zoomScale + panOffset.y
  }, [svgSize.h, yMin, yMax, zoomScale, panOffset.y])

  // Grid tick values
  const xTicks = useMemo(() => {
    const range = xMax - xMin
    const step = range > 40 ? 10 : range > 20 ? 5 : 2
    const ticks: number[] = []
    for (let v = Math.ceil(xMin / step) * step; v <= xMax; v += step) ticks.push(v)
    return ticks
  }, [xMin, xMax])

  const yTicks = useMemo(() => {
    const range = yMax - yMin
    const step = range > 100 ? 20 : range > 50 ? 10 : 5
    const ticks: number[] = []
    for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) ticks.push(v)
    return ticks
  }, [yMin, yMax])

  const zeroSvgX  = toSvgX(0)
  const medianSvgY = toSvgY(medianVol)

  // Point radius — slightly larger so they're visible
  const R = 4

  const Label = ({ children }: { children: React.ReactNode }) => (
    <div style={{ fontSize: 10, fontFamily: D.mono, color: D.textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
      {children}
    </div>
  )

  return (
    <div style={{ fontFamily: D.body }}>

      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 'clamp(1.8rem,4vw,2.5rem)', fontWeight: 700, letterSpacing: '-0.03em', color: D.text, margin: '0 0 8px', lineHeight: 1.2 }}>
          Risk{' '}
          <span style={{ background: 'linear-gradient(90deg, #f59e0b, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Matrix
          </span>
        </h1>
        <p style={{ color: D.textMuted, fontSize: 15, margin: 0, lineHeight: 1.6 }}>
          Forecast upside vs. annualized volatility — each point = one company — color = final signal
        </p>
      </div>

      {/* ── Layout: 260px sidebar + flex chart ──────────────────────────── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
        <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Filters card */}
          <div style={{ background: D.lowest, border: `1px solid ${D.border}`, borderRadius: 4, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 10, fontFamily: D.mono, color: D.text, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600 }}>Filters</span>
              <span style={{ fontSize: 10, fontFamily: D.mono, color: D.primary }}>Showing {filtered.length} companies</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Sector */}
              <div>
                <Label>Sector</Label>
                <select value={filterSector} onChange={e => setFilterSector(e.target.value)} style={selectStyle}>
                  {sectorOptions.map(o => <option key={o} value={o} style={{ background: D.container }}>{o}</option>)}
                </select>
              </div>

              {/* Signal */}
              <div>
                <Label>Signal</Label>
                <select value={filterSignal} onChange={e => setFilterSignal(e.target.value)} style={selectStyle}>
                  {signalOptions.map(o => <option key={o} value={o} style={{ background: D.container }}>{o}</option>)}
                </select>
              </div>

              {/* Risk Level toggle group */}
              <div>
                <Label>Risk Level</Label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {(['All','Low','Med','High'] as const).map(r => (
                    <button key={r} onClick={() => setFilterRisk(r)}
                      style={{
                        flex: 1, padding: '6px 0', fontSize: 11, fontFamily: D.mono,
                        border: `1px solid ${filterRisk === r ? D.primary : D.borderHi}`,
                        background: filterRisk === r ? `${D.primary}20` : 'transparent',
                        color: filterRisk === r ? D.primary : D.textMuted,
                        borderRadius: 3, cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upside Range */}
              <div>
                <Label>Upside % Range</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input type="number" placeholder="Min" value={upsideMinInput}
                    onChange={e => setUpsideMinInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyUpside()}
                    style={{ ...selectStyle, flex: 1, width: 0, padding: '8px 8px', textAlign: 'center' }} />
                  <span style={{ color: D.borderHi, fontSize: 14 }}>-</span>
                  <input type="number" placeholder="Max" value={upsideMaxInput}
                    onChange={e => setUpsideMaxInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && applyUpside()}
                    style={{ ...selectStyle, flex: 1, width: 0, padding: '8px 8px', textAlign: 'center' }} />
                </div>
              </div>

              {/* Apply + Reset */}
              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                <button onClick={applyUpside}
                  style={{ flex: 1, background: D.primary, color: '#002e6a', padding: '9px 0', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontFamily: D.mono, fontWeight: 700, letterSpacing: '0.04em' }}>
                  Apply Filters
                </button>
                <button onClick={resetFilters} title="Reset all filters"
                  style={{ width: 38, border: `1px solid ${D.borderHi}`, background: 'transparent', color: D.textMuted, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RotateCcw size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Legend card */}
          <div style={{ background: D.lowest, border: `1px solid ${D.border}`, borderRadius: 4, padding: 20 }}>
            <div style={{ fontSize: 10, fontFamily: D.mono, color: D.text, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600, marginBottom: 14 }}>
              Legend
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {SIGNAL_LEGEND.map(({ key, label }) => {
                const color = SIGNAL_COLORS[key]
                const count = filtered.filter(c => c.final_signal === key).length
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontFamily: D.mono, color: D.textSec, flex: 1 }}>{label}</span>
                    <span style={{ fontSize: 10, fontFamily: D.mono, color: D.textMuted }}>{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── CHART AREA ──────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, background: D.lowest, border: `1px solid ${D.border}`, borderRadius: 4, padding: 20, position: 'relative' }}>

          {/* Chart header: axis pills + zoom controls */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['X: Forecast 30D Upside %', 'Y: Annualized Volatility %'].map(t => (
                <div key={t} style={{ fontSize: 10, fontFamily: D.mono, color: D.textSec, background: D.bg, border: `1px solid ${D.borderHi}`, padding: '5px 12px', borderRadius: 3 }}>
                  {t}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { icon: <ZoomIn size={15} />, fn: () => { setZoomScale(z => Math.min(z + 0.4, 4)) } },
                { icon: <ZoomOut size={15} />, fn: () => { setZoomScale(z => Math.max(z - 0.4, 0.6)); setPanOffset({ x: 0, y: 0 }) } },
                { icon: <RefreshCw size={15} />, fn: () => { setZoomScale(1); setPanOffset({ x: 0, y: 0 }) } },
              ].map(({ icon, fn }, i) => (
                <button key={i} onClick={fn}
                  style={{ width: 34, height: 34, border: `1px solid ${D.borderHi}`, background: 'transparent', color: D.textMuted, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* SVG scatter plot container */}
          <div
            ref={wrapRef}
            style={{ position: 'relative', background: D.bg, border: `1px solid ${D.border}`, borderRadius: 2, overflow: 'hidden' }}
            onMouseLeave={() => setTooltip(null)}
          >
            <svg
              ref={svgRef}
              width="100%"
              height={520}
              style={{ display: 'block', cursor: 'crosshair', overflow: 'visible' }}
            >
              {/* ── Grid lines ───────────────────────────────────────── */}
              {xTicks.map(v => {
                const sx = toSvgX(v)
                if (sx < PAD.left || sx > svgSize.w - PAD.right) return null
                return (
                  <g key={`xg-${v}`}>
                    <line x1={sx} y1={PAD.top} x2={sx} y2={svgSize.h - PAD.bottom} stroke="#1a1c1c" strokeWidth={1} />
                    <text x={sx} y={svgSize.h - PAD.bottom + 14} textAnchor="middle" fill={D.textMuted} fontSize={9} fontFamily={D.mono}>{v}%</text>
                  </g>
                )
              })}
              {yTicks.map(v => {
                const sy = toSvgY(v)
                if (sy < PAD.top || sy > svgSize.h - PAD.bottom) return null
                return (
                  <g key={`yg-${v}`}>
                    <line x1={PAD.left} y1={sy} x2={svgSize.w - PAD.right} y2={sy} stroke="#1a1c1c" strokeWidth={1} />
                    <text x={PAD.left - 6} y={sy + 3} textAnchor="end" fill={D.textMuted} fontSize={9} fontFamily={D.mono}>{v}%</text>
                  </g>
                )
              })}

              {/* ── Clip path so points don't overflow plot area ──── */}
              <defs>
                <clipPath id="plot-clip">
                  <rect x={PAD.left} y={PAD.top} width={svgSize.w - PAD.left - PAD.right} height={svgSize.h - PAD.top - PAD.bottom} />
                </clipPath>
              </defs>

              {/* ── Reference lines (dashed) ──────────────────────── */}
              <g clipPath="url(#plot-clip)">
                {/* Vertical: zero upside */}
                <line x1={zeroSvgX} y1={PAD.top} x2={zeroSvgX} y2={svgSize.h - PAD.bottom}
                  stroke="#333535" strokeWidth={1} strokeDasharray="4,3" />
                {/* Horizontal: median volatility */}
                <line x1={PAD.left} y1={medianSvgY} x2={svgSize.w - PAD.right} y2={medianSvgY}
                  stroke="#333535" strokeWidth={1} strokeDasharray="4,3" />
              </g>

              {/* ── Data points ──────────────────────────────────── */}
              <g clipPath="url(#plot-clip)">
                {filtered.map(c => {
                  const sx = toSvgX(c.forecast_30d_upside_pct)
                  const sy = toSvgY(c.annualized_volatility_pct)
                  const color = SIGNAL_COLORS[c.final_signal] ?? D.textSec
                  return (
                    <circle
                      key={c.symbol}
                      cx={sx} cy={sy} r={R}
                      fill={color} fillOpacity={0.8}
                      style={{ cursor: 'pointer', transition: 'r 0.12s' }}
                      onMouseEnter={e => {
                        // Get position relative to SVG element
                        const svgEl = svgRef.current!
                        const svgRect = svgEl.getBoundingClientRect()
                        setTooltip({
                          c,
                          x: sx,
                          y: sy,
                        })
                      }}
                      onMouseLeave={() => setTooltip(null)}
                      onClick={() => onSelectCompany(c)}
                    />
                  )
                })}
              </g>

              {/* ── Quadrant corner labels ───────────────────────── */}
              <text x={PAD.left + 8} y={PAD.top + 14} fill={D.textMuted} fontSize={9} fontFamily={D.mono} style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                LOW UPSIDE / LOW VOLATILITY
              </text>
              <text x={svgSize.w - PAD.right - 8} y={PAD.top + 14} fill="#005236" fontSize={9} fontFamily={D.mono} textAnchor="end" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                ● HIGH UPSIDE / LOW VOLATILITY
              </text>
              <text x={PAD.left + 8} y={svgSize.h - PAD.bottom - 8} fill={D.error} fontSize={9} fontFamily={D.mono} style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                LOW UPSIDE / HIGH VOLATILITY
              </text>
              <text x={svgSize.w - PAD.right - 8} y={svgSize.h - PAD.bottom - 8} fill={D.textMuted} fontSize={9} fontFamily={D.mono} textAnchor="end" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                HIGH UPSIDE / HIGH VOLATILITY
              </text>
            </svg>

            {/* ── Tooltip (positioned over SVG) ─────────────────── */}
            {tooltip && (() => {
              const { c, x, y } = tooltip
              const tipW = 180
              const tipH = 120
              // Flip left if too close to right edge
              const left = x + 14 + tipW > svgSize.w ? x - tipW - 14 : x + 14
              // Flip up if too close to bottom
              const top  = y + tipH > svgSize.h - PAD.bottom ? y - tipH - 8 : y + 8
              return (
                <div style={{
                  position: 'absolute',
                  left, top,
                  pointerEvents: 'none',
                  zIndex: 20,
                  background: D.highest,
                  border: `1px solid ${D.borderHi}`,
                  borderRadius: 4,
                  padding: '10px 14px',
                  minWidth: tipW,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: D.mono, color: D.primary, marginBottom: 2 }}>{c.symbol}</div>
                  <div style={{ fontSize: 10, fontFamily: D.mono, color: D.textMuted, marginBottom: 8, lineHeight: 1.4 }}>{c.company_name}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '3px 14px', fontSize: 11, fontFamily: D.mono }}>
                    <span style={{ color: D.textMuted }}>Upside</span>
                    <span style={{ color: c.forecast_30d_upside_pct >= 0 ? D.tertiary : D.error, textAlign: 'right' }}>
                      {c.forecast_30d_upside_pct >= 0 ? '+' : ''}{c.forecast_30d_upside_pct.toFixed(1)}%
                    </span>
                    <span style={{ color: D.textMuted }}>Volatility</span>
                    <span style={{ color: D.text, textAlign: 'right' }}>{c.annualized_volatility_pct.toFixed(1)}%</span>
                    <span style={{ color: D.textMuted }}>MAPE</span>
                    <span style={{ color: D.text, textAlign: 'right' }}>{c.best_model_mape.toFixed(1)}%</span>
                    <span style={{ color: D.textMuted }}>Risk</span>
                    <span style={{ color: D.text, textAlign: 'right' }}>{riskMap(c.risk_level)}</span>
                  </div>
                  <div style={{ marginTop: 7, paddingTop: 7, borderTop: `1px solid ${D.border}`, fontSize: 9, fontFamily: D.mono, color: D.textMuted }}>
                    Click to explore forecast →
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Axis labels below chart */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
            <span style={{ fontSize: 9, fontFamily: D.mono, color: D.textMuted }}>← Negative Upside</span>
            <span style={{ fontSize: 9, fontFamily: D.mono, color: D.textMuted }}>X — 30D Forecast Upside %  ·  Y — Annualized Volatility %  ·  {filtered.length} companies</span>
            <span style={{ fontSize: 9, fontFamily: D.mono, color: D.textMuted }}>Positive Upside →</span>
          </div>
        </div>
      </div>
    </div>
  )
}
