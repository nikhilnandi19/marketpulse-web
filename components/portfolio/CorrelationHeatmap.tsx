'use client'

import { useMemo, useRef, useState } from 'react'
import { S, glass, labelStyle } from './tokens'

interface Props {
  symbols: string[]
  corr: number[][]
  sectorOf: Record<string, string>
  hovered: string | null
  onHover: (s: string | null) => void
}

/** Blue for negative, orange for positive, dark for zero. Safe for common color blindness, and every cell shows its number. */
function cellColor(v: number): string {
  if (!Number.isFinite(v)) return 'rgba(255,255,255,0.04)'
  const a = Math.min(1, Math.abs(v)) * 0.85
  return v >= 0 ? `rgba(240,140,50,${a})` : `rgba(80,150,230,${a})`
}

export default function CorrelationHeatmap({ symbols, corr, sectorOf, hovered, onHover }: Props) {
  // Group by sector, then alphabetical, so clusters of related stocks sit together.
  const order = useMemo(
    () => symbols.map((_, i) => i).sort((a, b) => (sectorOf[symbols[a]] || 'Unknown').localeCompare(sectorOf[symbols[b]] || 'Unknown') || symbols[a].localeCompare(symbols[b])),
    [symbols, sectorOf],
  )
  const n = order.length
  const [focus, setFocus] = useState<[number, number]>([0, 0])
  const [pair, setPair] = useState<{ a: string; b: string; v: number } | null>(null)
  const grid = useRef<HTMLDivElement>(null)

  const size = n > 16 ? 34 : n > 10 ? 42 : 52
  const font = n > 16 ? 9 : 11

  const move = (r: number, c: number, dr: number, dc: number) => {
    const nr = Math.max(0, Math.min(n - 1, r + dr))
    const nc = Math.max(0, Math.min(n - 1, c + dc))
    setFocus([nr, nc])
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-r="${nr}"][data-c="${nc}"]`)?.focus())
  }

  if (n < 2) return <div style={glass({ padding: 24 })}><div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>Correlation</div><p style={{ fontSize: 13, color: S.textMuted }}>Add at least two stocks to see how they move together.</p></div>

  return (
    <div style={glass({ padding: '22px 24px' })}>
      <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>How the stocks move together</div>
      <div style={{ fontSize: 12, color: S.textMuted, margin: '2px 0 14px', lineHeight: 1.5, maxWidth: 620 }}>
        Correlation runs from -1 to 1. Near 1 means two stocks rise and fall together. Correlations tend to rise in sell-offs, so diversification helps least when it is needed most. Grouped by sector.
      </div>
      <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
        <div ref={grid} role="grid" aria-label="Correlation matrix of daily returns" style={{ display: 'inline-grid', gridTemplateColumns: `64px repeat(${n}, ${size}px)`, gap: 2 }}>
          <div />
          {order.map(ci => (
            <div key={`h${ci}`} role="columnheader" style={{ ...labelStyle, fontSize: 9, textAlign: 'center', paddingBottom: 4, color: hovered === symbols[ci] ? S.primary : S.textMuted, fontWeight: hovered === symbols[ci] ? 700 : 400 }}>
              {symbols[ci]}
            </div>
          ))}
          {order.map((ri, r) => (
            <div key={`r${ri}`} role="row" style={{ display: 'contents' }}>
              <div role="rowheader" style={{ ...labelStyle, fontSize: 10, display: 'flex', alignItems: 'center', color: hovered === symbols[ri] ? S.primary : S.textSecondary, fontWeight: hovered === symbols[ri] ? 700 : 400 }}>{symbols[ri]}</div>
              {order.map((ci, c) => {
                const v = corr[ri][ci]
                const text = Number.isFinite(v) ? v.toFixed(2) : 'n/a'
                const active = r === focus[0] && c === focus[1]
                return (
                  <div key={`c${ci}`} role="gridcell" data-r={r} data-c={c} tabIndex={active ? 0 : -1}
                    aria-label={`${symbols[ri]} and ${symbols[ci]}: correlation ${text}`}
                    onMouseEnter={() => { setPair({ a: symbols[ri], b: symbols[ci], v }); onHover(symbols[ri]) }}
                    onMouseLeave={() => { setPair(null); onHover(null) }}
                    onFocus={() => { setFocus([r, c]); setPair({ a: symbols[ri], b: symbols[ci], v }) }}
                    onKeyDown={e => {
                      const d: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }
                      if (d[e.key]) { e.preventDefault(); move(r, c, d[e.key][0], d[e.key][1]) }
                    }}
                    style={{ height: size * 0.72, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, background: ri === ci ? 'rgba(255,255,255,0.07)' : cellColor(v), fontFamily: S.mono, fontSize: font, color: ri === ci ? S.textMuted : '#fff', outlineOffset: 1 }}>
                    {text}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: S.mono, fontSize: 10, color: S.textMuted }}>
          <span>-1</span>
          <div aria-hidden style={{ width: 120, height: 8, borderRadius: 4, background: 'linear-gradient(90deg, rgba(80,150,230,0.85), rgba(255,255,255,0.06), rgba(240,140,50,0.85))' }} />
          <span>+1</span>
        </div>
        <div aria-live="polite" style={{ fontSize: 12, fontFamily: S.mono, color: S.textSecondary, minHeight: 18 }}>
          {pair ? `${pair.a} and ${pair.b}: ${Number.isFinite(pair.v) ? pair.v.toFixed(2) : 'n/a'}` : 'Hover or use the arrow keys to read a pair.'}
        </div>
      </div>
    </div>
  )
}
