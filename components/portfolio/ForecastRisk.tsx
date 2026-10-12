'use client'

import { useMemo } from 'react'
import { CartesianGrid, ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { forecastRiskSummary, type ForecastRiskPoint, type Metrics, type Reliability } from '@/lib/risk'
import type { CompanySummary } from '@/lib/types'
import { S, R, inset, glass, labelStyle, fmtPct } from './tokens'

const STROKE: Record<Reliability, { color: string; dash?: string; width: number; text: string }> = {
  strong: { color: S.positive, width: 2.5, text: 'Strong (error under 2%)' },
  acceptable: { color: S.warning, width: 2.5, text: 'Acceptable (2 to 5%)' },
  high_error: { color: S.negative, dash: '4 3', width: 2.5, text: 'High error (over 5%)' },
  unknown: { color: S.outline, dash: '2 3', width: 2, text: 'Unknown' },
}

const signed = (x: number, d = 1) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${x.toFixed(d)}%` : 'n/a')

interface Dot { x: number; y: number; z: number; p: ForecastRiskPoint }

function Bubble(props: { cx?: number; cy?: number; size?: number; payload?: Dot }) {
  const { cx = 0, cy = 0, size = 100, payload } = props
  if (!payload) return null
  const st = STROKE[payload.p.reliability]
  const r = Math.sqrt(size / Math.PI)
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={S.primary} fillOpacity={0.3} stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} />
      <text x={cx + r + 4} y={cy + 4} fill={S.textPrimary} fontSize={11} fontFamily={S.mono} fontWeight={700}>{payload.p.symbol}</text>
    </g>
  )
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Dot }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload.p
  return (
    <div style={{ ...glass({ padding: '8px 12px', borderRadius: R.control }), fontSize: 12, fontFamily: S.mono, color: S.textPrimary }}>
      <div style={{ fontWeight: 700 }}>{p.symbol}</div>
      <div>Weight {fmtPct(p.weight)}</div>
      <div>Share of risk {fmtPct(p.riskShare)}</div>
      <div>30-day forecast {signed(p.forecastUpsidePct)}</div>
      <div>Model error {p.mapePct.toFixed(1)}% ({STROKE[p.reliability].text.split(' (')[0].toLowerCase()})</div>
    </div>
  )
}

/** The model's forecast next to each holding's share of historical risk. Never combined into one score. */
export default function ForecastRisk({ m, byTicker }: { m: Metrics; byTicker: Record<string, CompanySummary> }) {
  const { summary, skipped } = useMemo(() => {
    const rows = m.holdings.flatMap(h => {
      const c = byTicker[h.symbol]
      if (!c || !Number.isFinite(h.riskPercent) || !Number.isFinite(c.forecast_30d_upside_pct)) return []
      return [{ symbol: h.symbol, weight: h.weight, riskShare: h.riskPercent, forecastUpsidePct: c.forecast_30d_upside_pct, mapePct: c.best_model_mape }]
    })
    return { summary: forecastRiskSummary(rows), skipped: m.holdings.length - rows.length }
  }, [m, byTicker])

  const dots: Dot[] = summary.points.map(p => ({ x: p.riskShare * 100, y: p.forecastUpsidePct, z: p.weight * 100, p }))
  if (dots.length < 2) {
    return (
      <div style={glass({ padding: '22px 24px' })}>
        <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>Model forecast next to risk share</div>
        <p style={{ fontSize: 13, color: S.textMuted }}>Needs at least two stocks with a model forecast.</p>
      </div>
    )
  }

  const split = summary.equalShare * 100
  const xMax = Math.ceil((Math.max(...dots.map(d => d.x), split * 1.6) * 1.1) / 5) * 5
  const ys = dots.map(d => d.y)
  const pad = Math.max(1, (Math.max(0, ...ys) - Math.min(0, ...ys)) * 0.12)
  const yMin = Math.floor((Math.min(0, ...ys) - pad) / 5) * 5
  const yMax = Math.ceil((Math.max(0, ...ys, summary.weightedUpsidePct) + pad) / 5) * 5
  const qLabel = (value: string, position: 'insideTopLeft' | 'insideTopRight' | 'insideBottomLeft' | 'insideBottomRight') => ({ value, position, fill: S.textMuted, fontSize: 11, fontFamily: S.mono })
  const hotCorner = summary.points.filter(p => p.quadrant === 'high_risk_down').map(p => p.symbol)

  return (
    <div style={glass({ padding: '22px 24px' })}>
      <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>Model forecast next to risk share</div>
      <p style={{ fontSize: 12, color: S.textMuted, margin: '2px 0 12px', lineHeight: 1.55, maxWidth: 700 }}>
        Each bubble is a stock. Across is its share of the portfolio's volatility, up is the dashboard model's 30-day forecast, size is its weight, and the outline shows how accurate the model has been on that stock.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, fontFamily: S.mono, color: S.textMuted, marginBottom: 6 }}>
        {(['strong', 'acceptable', 'high_error'] as Reliability[]).map(r => (
          <span key={r}><span style={{ color: STROKE[r].color }}>{STROKE[r].dash ? '◌' : '●'}</span> {STROKE[r].text}</span>
        ))}
      </div>
      <div>
        <p style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
          {`Scatter chart of ${dots.length} stocks. Portfolio weighted 30-day model forecast ${signed(summary.weightedUpsidePct)}. ${hotCorner.length ? `${hotCorner.join(', ')} carry more than an equal share of risk with a negative forecast.` : 'No stock carries more than an equal share of risk with a negative forecast.'} A table of values follows the chart.`}
        </p>
        <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart margin={{ top: 10, right: 84, bottom: 24, left: 4 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.06)" />
            <ReferenceArea x1={0} x2={split} y1={0} y2={yMax} fill="none" label={qLabel('Low risk share, positive forecast', 'insideTopLeft')} />
            <ReferenceArea x1={split} x2={xMax} y1={0} y2={yMax} fill="none" label={qLabel('High risk share, positive forecast', 'insideTopRight')} />
            <ReferenceArea x1={0} x2={split} y1={yMin} y2={0} fill="none" label={qLabel('Low risk share, negative forecast', 'insideBottomLeft')} />
            <ReferenceArea x1={split} x2={xMax} y1={yMin} y2={0} fill={S.negative} fillOpacity={0.06} label={qLabel('High risk share, negative forecast', 'insideBottomRight')} />
            <XAxis type="number" dataKey="x" domain={[0, xMax]} name="Share of risk" tick={{ fill: S.textMuted, fontSize: 11, fontFamily: S.mono }} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`} label={{ value: 'Share of portfolio volatility', position: 'insideBottom', offset: -14, fill: S.textMuted, fontSize: 11 }} />
            <YAxis type="number" dataKey="y" domain={[yMin, yMax]} name="Forecast" tick={{ fill: S.textMuted, fontSize: 11, fontFamily: S.mono }} axisLine={false} tickLine={false} width={44}
              tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
            <ZAxis type="number" dataKey="z" range={[90, 700]} />
            <ReferenceLine x={split} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.25)" />
            <ReferenceLine y={summary.weightedUpsidePct} stroke={S.primary} strokeDasharray="6 4" label={{ value: `Portfolio ${signed(summary.weightedUpsidePct)}`, position: 'right', fill: S.primary, fontSize: 11, fontFamily: S.mono }} />
            <Tooltip content={<Tip />} cursor={false} />
            <Scatter data={dots} shape={<Bubble />} isAnimationActive={false} />
          </ScatterChart>
        </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', margin: '4px 0 10px' }}>
        <div>
          <div style={labelStyle}>Portfolio forecast (weighted)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: summary.weightedUpsidePct >= 0 ? S.positive : S.negative }}>{signed(summary.weightedUpsidePct)}</div>
        </div>
        <div>
          <div style={labelStyle}>Model error (weighted)</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: S.textPrimary }}>{summary.weightedMapePct.toFixed(1)}%</div>
        </div>
        <div>
          <div style={labelStyle}>Dashed line</div>
          <div style={{ fontSize: 12, color: S.textMuted, maxWidth: 220, lineHeight: 1.5 }}>The weighted forecast. The vertical line is an equal share of risk ({split.toFixed(1)}%).</div>
        </div>
      </div>

      {hotCorner.length > 0 && (
        <p style={{ fontSize: 13, color: S.textSecondary, lineHeight: 1.6, margin: '0 0 10px' }}>
          {hotCorner.join(', ')} {hotCorner.length === 1 ? 'sits' : 'sit'} in the high risk share, negative forecast corner.
        </p>
      )}
      {skipped > 0 && <p style={{ fontSize: 12, color: S.textMuted, margin: '0 0 10px' }}>{skipped} {skipped === 1 ? 'stock is' : 'stocks are'} not shown because the model has no forecast or the stock is left out of the risk numbers.</p>}

      <div role="note" style={{ fontSize: 12, color: S.textMuted, lineHeight: 1.6, borderTop: `1px solid ${S.divider}`, paddingTop: 12 }}>
        The forecasts come from simple statistical models, and their average error is on the Signal Performance and Forecast pages. They are noisy and often wrong. This panel shows the model's view next to historical risk. It is not a recommendation, and forecast and risk are deliberately not combined into one score.
      </div>

      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: 'pointer', fontSize: 12, color: S.textSecondary }}>Show the values as a table</summary>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, fontSize: 12, fontFamily: S.mono, color: S.textSecondary }}>
            <thead><tr>{['Stock', 'Weight', 'Risk share', '30D forecast', 'Model error', 'Reliability'].map(h => <th key={h} style={{ ...labelStyle, textAlign: 'left', padding: '6px 10px', fontWeight: 500 }}>{h}</th>)}</tr></thead>
            <tbody>
              {summary.points.map(p => (
                <tr key={p.symbol} style={{ borderTop: `1px solid ${S.divider}` }}>
                  <td style={{ padding: '6px 10px', color: S.textPrimary, fontWeight: 700 }}>{p.symbol}</td>
                  <td style={{ padding: '6px 10px' }}>{fmtPct(p.weight)}</td>
                  <td style={{ padding: '6px 10px' }}>{fmtPct(p.riskShare)}</td>
                  <td style={{ padding: '6px 10px' }}>{signed(p.forecastUpsidePct)}</td>
                  <td style={{ padding: '6px 10px' }}>{p.mapePct.toFixed(1)}%</td>
                  <td style={{ padding: '6px 10px' }}>{STROKE[p.reliability].text.split(' (')[0]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
