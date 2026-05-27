'use client'

import { useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { SectorSummary } from '@/lib/types'

interface Props {
  sectors: SectorSummary[]
  onNavigateToExplorer?: (sector: string) => void
}

const ALL = 'All'

// Stitch exact colors from design system
const D = {
  bg: '#121414', card: '#1a1c1c', elevated: '#1e2020',
  border: 'rgba(255,255,255,0.08)',
  text: '#e2e2e2', textSec: '#c2c6d6', textMuted: '#8c909f',
  mono: 'JetBrains Mono, monospace', body: 'Inter, system-ui, sans-serif',
}

// Signal composition colors — exact from Stitch screenshot
const SIGNAL_KEYS = [
  { key: 'stable_watchlist_count',            label: 'Stable Watchlist',      color: '#adc6ff' },
  { key: 'potential_opportunity_count',       label: 'Potential Opportunity', color: '#4edea3' },
  { key: 'needs_further_review_count',        label: 'Needs Review',          color: '#d0bcff' },
  { key: 'high_volatility_speculative_count', label: 'High Vol Speculative',  color: '#fb923c' },
  { key: 'weak_negative_count',               label: 'Weak Negative',         color: '#f87171' },
]

// 2×2 chart configs — colors match Stitch screenshot exactly
const CHARTS = [
  {
    key: 'avg_forecast_30d_upside_pct',
    label: 'AVG 30D FORECAST UPSIDE',
    icon: '↗',
    color: '#adc6ff',        // periwinkle blue — top left chart
    fmt: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
    bottomLeft: 'Sectors',
    bottomRight: (data: SectorSummary[]) => {
      if (!data.length) return ''
      const max = data.reduce((p, c) => c.avg_forecast_30d_upside_pct > p.avg_forecast_30d_upside_pct ? c : p, data[0])
      return `High: ${max.sector?.split(' ')[0]}`
    },
  },
  {
    key: 'avg_annualized_volatility_pct',
    label: 'AVG ANNUALIZED VOLATILITY',
    icon: '~',
    color: '#d0bcff',        // lighter purple — top right chart
    fmt: (v: number) => `${v.toFixed(1)}%`,
    bottomLeft: 'Sectors',
    bottomRight: (data: SectorSummary[]) => {
      if (!data.length) return ''
      const max = data.reduce((p, c) => c.avg_annualized_volatility_pct > p.avg_annualized_volatility_pct ? c : p, data[0])
      return `High: ${max.sector?.split(' ')[0]}`
    },
  },
  {
    key: 'avg_model_mape',
    label: 'AVG MODEL MAPE',
    icon: '◎',
    color: '#8b5cf6',        // deeper purple — bottom left chart (matches Stitch)
    fmt: (v: number) => `${v.toFixed(2)}%`,
    bottomLeft: 'Sectors',
    bottomRight: () => 'Error Margin (Lower is better)',
  },
  {
    key: 'avg_profit_margin_pct',
    label: 'AVG PROFIT MARGIN',
    icon: '▫',
    color: '#4edea3',        // teal green — bottom right chart
    fmt: (v: number) => `${v.toFixed(1)}%`,
    bottomLeft: 'Sectors',
    bottomRight: (data: SectorSummary[]) => {
      if (!data.length) return ''
      const valid = data.filter(d => d.avg_profit_margin_pct != null)
      if (!valid.length) return ''
      const max = valid.reduce((p, c) => c.avg_profit_margin_pct > p.avg_profit_margin_pct ? c : p, valid[0])
      return `High: ${max.sector?.split(' ')[0]}`
    },
  },
]

const card = { background: '#1a1c1c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }

export default function SectorComparison({ sectors, onNavigateToExplorer }: Props) {
  const [filterSector, setFilterSector] = useState(ALL)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const sectorOptions = [ALL, ...sectors.map(s => s.sector).sort()]

  const data = useMemo(() =>
    (filterSector === ALL ? sectors : sectors.filter(s => s.sector === filterSector))
      .sort((a, b) => a.sector.localeCompare(b.sector))
  , [sectors, filterSector])

  const handleBarClick = (chartData: any) => {
    const sector = chartData?.activePayload?.[0]?.payload?.sector
    if (sector && onNavigateToExplorer) onNavigateToExplorer(sector)
  }

  return (
    <div style={{ fontFamily: D.body }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 'clamp(1.8rem, 4vw, 2.5rem)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.2, color: D.text, fontFamily: D.body, marginBottom: 8 }}>
          Sector Comparison
        </h1>
        <p style={{ fontSize: 15, color: D.textMuted, lineHeight: 1.6 }}>
          Aggregate metrics across S&P 500 sectors.{onNavigateToExplorer && ' Click any bar to explore that sector\'s companies.'}
        </p>
      </div>

      {/* 2×2 chart grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {CHARTS.map(cfg => {
          const vals = data.map(d => (d as any)[cfg.key] as number).filter(v => v != null)
          const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
          const maxVal = vals.length ? Math.max(...vals) : 0

          return (
            <div key={cfg.key} style={card}>
              {/* Card header */}
              <div style={{ padding: '18px 20px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontFamily: D.mono, color: D.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    {cfg.label}
                  </span>
                  <span style={{ fontSize: 14, color: D.textMuted }}>{cfg.icon}</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 600, color: cfg.color, fontFamily: D.body, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 4 }}>
                  {cfg.fmt(avg)}
                </div>
              </div>

              {/* Bar chart */}
              <div style={{ padding: '8px 0 0' }}>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart
                    data={data}
                    barSize={20}
                    margin={{ top: 4, right: 16, bottom: 28, left: 16 }}
                    onClick={handleBarClick}
                    style={{ cursor: onNavigateToExplorer ? 'pointer' : 'default' }}>
                    <XAxis
                      dataKey="sector"
                      tick={{ fill: D.textMuted, fontSize: 9, fontFamily: D.mono }}
                      angle={-35}
                      textAnchor="end"
                      height={32}
                      interval={0}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div style={{ background: '#1e2020', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6, padding: '8px 12px', fontSize: 12, fontFamily: D.mono }}>
                            <div style={{ color: D.textMuted, marginBottom: 4 }}>{payload[0].payload.sector}</div>
                            <div style={{ color: cfg.color, fontWeight: 600 }}>{cfg.fmt(payload[0].value as number)}</div>
                            {onNavigateToExplorer && <div style={{ color: D.textMuted, fontSize: 10, marginTop: 4 }}>Click to explore →</div>}
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey={cfg.key} radius={[2, 2, 0, 0]}>
                      {data.map((d, i) => {
                        const val = (d as any)[cfg.key] as number
                        const isMax = val === maxVal
                        // Stitch: highest bar full opacity, others ~40% — creates the visual hierarchy
                        return <Cell key={i} fill={cfg.color} fillOpacity={isMax ? 0.95 : 0.35} />
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Card footer */}
              <div style={{ padding: '0 20px 14px', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11, color: D.textMuted, fontFamily: D.mono }}>{cfg.bottomLeft}</span>
                <span style={{ fontSize: 11, color: D.textMuted, fontFamily: D.mono }}>{cfg.bottomRight(data)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Final Signal Composition — horizontal stacked bars */}
      <div style={card}>
        <div style={{ padding: '20px 24px' }}>
          {/* Header row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, color: D.text, fontFamily: D.body, letterSpacing: '-0.02em', marginBottom: 4 }}>
                Final Signal Composition by Sector
              </h3>
              <p style={{ fontSize: 13, color: D.textMuted, fontFamily: D.body, lineHeight: 1.5, maxWidth: 420 }}>
                Weighting of predictive classifications across the S&P 500 universe.
              </p>
            </div>
            {/* Legend — exact Stitch layout: colored squares + mono labels */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', alignItems: 'center' }}>
              {SIGNAL_KEYS.map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontFamily: D.mono, color: D.textSec }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stacked bar rows — sorted by total count descending */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[...data]
              .sort((a, b) => {
                const ta = SIGNAL_KEYS.reduce((s, { key }) => s + ((a as any)[key] ?? 0), 0)
                const tb = SIGNAL_KEYS.reduce((s, { key }) => s + ((b as any)[key] ?? 0), 0)
                return tb - ta
              })
              .map(sector => {
                const total = SIGNAL_KEYS.reduce((s, { key }) => s + ((sector as any)[key] ?? 0), 0)
                if (!total) return null
                return (
                  <div key={sector.sector}
                    onClick={() => onNavigateToExplorer?.(sector.sector)}
                    style={{ cursor: onNavigateToExplorer ? 'pointer' : 'default' }}>
                    {/* Label row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontFamily: D.mono, color: D.textSec, fontWeight: 500 }}>
                        {sector.sector}
                      </span>
                      <span style={{ fontSize: 12, fontFamily: D.mono, color: D.textMuted }}>
                        {total} Entities
                      </span>
                    </div>
                    {/* Horizontal stacked bar */}
                    <div style={{ display: 'flex', height: 28, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                      {SIGNAL_KEYS.map(({ key, color }) => {
                        const count = (sector as any)[key] ?? 0
                        const pct = total > 0 ? (count / total) * 100 : 0
                        if (pct < 0.5) return null
                        return (
                          <div
                            key={key}
                            style={{ width: `${pct}%`, background: color, transition: 'opacity 0.15s' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.75'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                            title={`${SIGNAL_KEYS.find(s => s.key === key)?.label}: ${count}`}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
