'use client'

import type { Metrics } from '@/lib/risk'
import { S, glass, labelStyle, fmtPct } from './tokens'

const SECTOR_COLORS = [S.primary, S.bronze, S.warning, S.positive, S.outline]

function Stat({ label, value, explain }: { label: string; value: string; explain: string }) {
  return (
    <div title={explain}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: S.textPrimary, margin: '4px 0 2px' }}>{value}</div>
      <div style={{ fontSize: 11, color: S.textMuted, lineHeight: 1.45 }}>{explain}</div>
    </div>
  )
}

export default function Diversification({ m }: { m: Metrics }) {
  const num = (x: number, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a')
  return (
    <div style={glass({ padding: '22px 24px' })}>
      <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary, marginBottom: 14 }}>Concentration and diversification</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 18 }}>
        <Stat label="Effective holdings" value={num(m.effectiveHoldings, 1)} explain={`Equal-sized positions that would give the same concentration (1 divided by HHI of ${num(m.hhi, 3)}).`} />
        <Stat label="Top 1 / top 3" value={`${fmtPct(m.top1, 0)} / ${fmtPct(m.top3, 0)}`} explain="Share of the portfolio in the largest holding and in the three largest." />
        <Stat label="Diversification ratio" value={num(m.diversificationRatio)} explain="Weighted average of each stock's volatility divided by the portfolio's. 1.0 means no benefit from mixing." />
        <Stat label="Average correlation" value={num(m.avgCorrelation)} explain={m.mostCorrelated ? `Weighted average between holdings. Closest pair: ${m.mostCorrelated.a} and ${m.mostCorrelated.b} at ${m.mostCorrelated.corr.toFixed(2)}.` : 'Needs at least two stocks.'} />
      </div>
      <div style={{ ...labelStyle, margin: '22px 0 10px' }}>Sector weights</div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {m.sectors.map((s, i) => (
          <li key={s.sector} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: S.textSecondary, width: 150, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sector}</span>
            <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 9999 }}>
              <div style={{ width: `${s.weight * 100}%`, height: '100%', borderRadius: 9999, background: SECTOR_COLORS[i] ?? S.outline }} />
            </div>
            <span style={{ fontFamily: S.mono, fontSize: 12, color: S.textMuted, width: 44, textAlign: 'right' }}>{fmtPct(s.weight)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
