'use client'

import { FLAGS, type RiskFlag } from '@/lib/risk'
import { S, R, glass, labelStyle } from './tokens'

export default function Flags({ flags, hovered, onHover }: { flags: RiskFlag[]; hovered: string | null; onHover: (s: string | null) => void }) {
  return (
    <div style={glass({ padding: '22px 24px' })}>
      <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>Worth noticing</div>
      <div style={{ fontSize: 12, color: S.textMuted, margin: '2px 0 14px', lineHeight: 1.5 }}>
        Plain observations from fixed thresholds. They describe the portfolio, they are not advice.
      </div>
      {flags.length === 0 ? (
        <p style={{ fontSize: 13, color: S.textSecondary, lineHeight: 1.6, margin: 0 }}>
          Nothing crossed the thresholds: no holding above {FLAGS.singleHolding * 100}%, no sector above {FLAGS.singleSector * 100}%, top three at most {FLAGS.topThree * 100}%, average correlation at most {FLAGS.avgCorrelation}, no stock with more than {FLAGS.riskShareMultiple}x its weight in risk, and volatility within {FLAGS.volVsBenchmark}x SPY.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {flags.map(f => (
            <li key={f.id} tabIndex={0} onMouseEnter={() => onHover(f.symbols[0] ?? null)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(f.symbols[0] ?? null)} onBlur={() => onHover(null)}
              style={{ borderLeft: `3px solid ${S.warning}`, background: `${S.warning}0d`, borderRadius: `0 ${R.min}px ${R.min}px 0`, padding: '10px 14px', outlineOffset: 2, opacity: hovered && f.symbols.length && !f.symbols.includes(hovered) ? 0.5 : 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: S.textPrimary }}>{f.title}</div>
              <div style={{ fontSize: 12, color: S.textMuted, lineHeight: 1.5, marginTop: 2 }}>{f.detail}</div>
            </li>
          ))}
        </ul>
      )}
      <div style={{ ...labelStyle, marginTop: 14 }}>{flags.length} {flags.length === 1 ? 'observation' : 'observations'}</div>
    </div>
  )
}
