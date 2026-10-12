'use client'

import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { shadedPeriods, type GrowthPaths, type Metrics } from '@/lib/risk'
import { S, R, glass, fmtDate, fmtPct } from './tokens'
import SegmentedControl from './SegmentedControl'

const tick = { fill: S.textMuted, fontSize: 11, fontFamily: S.mono }
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (d: string) => `${MONTHS[parseInt(d.slice(5, 7), 10) - 1]} ${d.slice(2, 4)}`
const nn = (x: number) => (Number.isFinite(x) ? x : null)

function Tip({ active, payload, label, fmt }: { active?: boolean; payload?: { name: string; value: number | null }[]; label?: string; fmt: (v: number) => string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ ...glass({ padding: '8px 12px', borderRadius: R.control }), fontSize: 12, fontFamily: S.mono, color: S.textPrimary }}>
      <div style={{ color: S.textMuted, marginBottom: 4 }}>{label ? fmtDate(label) : ''}</div>
      {payload.map(p => <div key={p.name}>{p.name}: {p.value == null ? 'n/a' : fmt(p.value)}</div>)}
    </div>
  )
}

export function RollingCorrelationChart({ m, growth }: { m: Metrics; growth: GrowthPaths }) {
  const data = useMemo(() => m.dates.map((d, i) => ({ d, corr: nn(m.rolling.avgCorr60[i]) })), [m])
  // Shade stretches where SPY was 10% or more below its high within this window.
  const shades = useMemo(
    () => shadedPeriods(growth.benchmarkDd, -0.1).map(p => ({ x1: growth.dates[Math.max(1, p.start)], x2: growth.dates[p.end] })).filter(p => p.x1 <= p.x2),
    [growth],
  )
  const available = data.some(p => p.corr !== null)
  return (
    <div style={glass({ padding: '22px 24px' })}>
      <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>Average correlation, 60-day rolling</div>
      <div style={{ fontSize: 12, color: S.textMuted, margin: '2px 0 10px', lineHeight: 1.5 }}>
        Shaded areas are times SPY was 10% or more below its high within this window. Correlations often rise there.
      </div>
      {!available ? (
        <p style={{ fontSize: 13, color: S.textMuted }}>Needs at least two stocks and 60 days of history.</p>
      ) : (
        <div role="img" aria-label={`Rolling 60-day average correlation, from ${fmtPct(data.find(p => p.corr !== null)!.corr!, 0)} at the start to ${fmtPct(data[data.length - 1].corr ?? NaN, 0)} at the end.`}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              {shades.map(s => <ReferenceArea key={s.x1} x1={s.x1} x2={s.x2} fill={S.negative} fillOpacity={0.12} stroke="none" />)}
              <XAxis dataKey="d" tickFormatter={shortDate} minTickGap={60} tick={tick} axisLine={false} tickLine={false} />
              <YAxis tick={tick} axisLine={false} tickLine={false} width={40} domain={[-0.2, 1]} tickFormatter={(v: number) => v.toFixed(1)} />
              <Tooltip content={<Tip fmt={v => v.toFixed(2)} />} />
              <Line name="Average correlation" type="monotone" dataKey="corr" stroke={S.primary} strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export function RollingVolChart({ m }: { m: Metrics }) {
  const [win, setWin] = useState<21 | 63>(63)
  const data = useMemo(
    () => m.dates.map((d, i) => ({ d, port: nn(win === 21 ? m.rolling.vol21[i] : m.rolling.vol63[i]), bench: nn(win === 21 ? m.rolling.benchVol21[i] : m.rolling.benchVol63[i]) })),
    [m, win],
  )
  return (
    <div style={glass({ padding: '22px 24px' })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>Rolling volatility</div>
        <SegmentedControl ariaLabel="Rolling window" value={win} onChange={setWin} minWidth={52} padX={14}
          options={[{ value: 21 as 21 | 63, text: '21-day' }, { value: 63 as 21 | 63, text: '63-day' }]} />
      </div>
      <div style={{ fontSize: 12, color: S.textMuted, margin: '2px 0 8px', lineHeight: 1.5 }}>Annualized volatility over the last {win} trading days, portfolio against SPY.</div>
      <div style={{ display: 'flex', gap: 16, fontSize: 12, fontFamily: S.mono, marginBottom: 6 }}>
        <span style={{ color: S.primary }}>● Portfolio</span><span style={{ color: S.textMuted }}>● SPY</span>
      </div>
      <div role="img" aria-label={`Rolling ${win}-day volatility. Latest: portfolio ${fmtPct(data[data.length - 1]?.port ?? NaN)}, SPY ${fmtPct(data[data.length - 1]?.bench ?? NaN)}.`}>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="d" tickFormatter={shortDate} minTickGap={60} tick={tick} axisLine={false} tickLine={false} />
            <YAxis tick={tick} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
            <Tooltip content={<Tip fmt={v => fmtPct(v)} />} />
            <Line name="Portfolio" type="monotone" dataKey="port" stroke={S.primary} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line name="SPY" type="monotone" dataKey="bench" stroke={S.textMuted} strokeWidth={1.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
