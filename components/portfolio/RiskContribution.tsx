'use client'

import type { HoldingMetrics } from '@/lib/risk'
import { S, glass, labelStyle, fmtPct } from './tokens'

export type ContributionMode = 'vol' | 'tail'

interface Props {
  holdings: HoldingMetrics[]
  mode: ContributionMode
  onMode: (m: ContributionMode) => void
  tailCount: number
  confidence: number
  hovered: string | null
  onHover: (s: string | null) => void
}

/** Weight next to share of risk for every holding. The gap is the insight. */
export default function RiskContribution({ holdings, mode, onMode, tailCount, confidence, hovered, onHover }: Props) {
  const share = (h: HoldingMetrics) => (mode === 'vol' ? h.riskPercent : h.tailPercent)
  const rows = [...holdings].sort((a, b) => (share(b) || 0) - (share(a) || 0))
  const max = Math.max(0.0001, ...rows.map(r => Math.max(r.weight, share(r) || 0)))
  const undefinedShares = rows.every(r => !Number.isFinite(share(r)))
  const gap = [...rows].filter(r => Number.isFinite(share(r))).sort((a, b) => share(b) - b.weight - (share(a) - a.weight))[0]
  const label = mode === 'vol' ? 'of the risk' : 'of the bad-day losses'

  return (
    <div style={glass({ padding: '22px 24px' })}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>Where the risk comes from</div>
          <div style={{ fontSize: 12, color: S.textMuted, marginTop: 2, maxWidth: 440, lineHeight: 1.5 }}>
            A stock's share of risk is its weight times its volatility times how closely it moves with the rest of the portfolio.
          </div>
        </div>
        <div role="group" aria-label="Risk measure" style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: 9999, padding: 3 }}>
          {([['vol', 'Volatility'], ['tail', 'Bad days']] as const).map(([v, t]) => (
            <button className="pf-tap" key={v} aria-pressed={mode === v} onClick={() => onMode(v)}
              style={{ minHeight: 32, padding: '0 14px', borderRadius: 9999, border: 'none', cursor: 'pointer', fontFamily: S.mono, fontSize: 12, fontWeight: 600, background: mode === v ? `${S.primary}26` : 'transparent', color: mode === v ? S.primary : S.textMuted }}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 11, fontFamily: S.mono, margin: '14px 0 10px', color: S.textMuted }}>
        <span><span style={{ color: S.outline }}>■</span> Weight</span>
        <span><span style={{ color: S.primary }}>■</span> Share {label}</span>
      </div>

      {undefinedShares ? (
        <p style={{ fontSize: 13, color: S.textMuted }}>The portfolio had no variation in this window, so risk shares are not defined.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map(r => {
            const s = share(r)
            const on = hovered === r.symbol
            return (
              <li key={r.symbol} onMouseEnter={() => onHover(r.symbol)} onMouseLeave={() => onHover(null)}
                style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 10, alignItems: 'center', opacity: hovered && !on ? 0.45 : 1, transition: 'opacity .15s' }}>
                <span style={{ fontFamily: S.mono, fontWeight: 700, fontSize: 13, color: S.textPrimary }}>{r.symbol}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Bar value={r.weight} max={max} color={S.outline} text={fmtPct(r.weight)} />
                  <Bar value={Number.isFinite(s) ? Math.max(0, s) : 0} max={max} color={S.primary} text={fmtPct(s)} bold />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {gap && (
        <p style={{ fontSize: 13, color: S.textSecondary, lineHeight: 1.6, margin: '16px 0 0' }}>
          {Math.abs(share(gap) - gap.weight) < 0.02
            ? `Risk shares are close to the weights, so no single stock is carrying much more than its size.`
            : `${gap.symbol} is ${fmtPct(gap.weight)} of the money but ${fmtPct(share(gap))} ${label}.`}
        </p>
      )}
      <p style={{ fontSize: 12, color: S.textMuted, lineHeight: 1.55, margin: '8px 0 0' }}>
        {mode === 'vol'
          ? 'Volatility shares add up to 100% of the portfolio\'s volatility.'
          : `Bad days are the ${tailCount} worst days for the portfolio (the worst 1 in ${Math.round(1 / (1 - confidence))}). Shares show who lost the most on those days, and add up to 100% of the expected shortfall.`}
      </p>
    </div>
  )
}

function Bar({ value, max, color, text, bold }: { value: number; max: number; color: string; text: string; bold?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ flex: 1, height: bold ? 8 : 5, background: 'rgba(255,255,255,0.05)', borderRadius: 9999 }}>
        <div style={{ width: `${(value / max) * 100}%`, height: '100%', background: color, borderRadius: 9999, transition: 'width .3s ease' }} />
      </div>
      <span style={{ ...labelStyle, textTransform: 'none', width: 48, textAlign: 'right', color: bold ? S.textPrimary : S.textMuted, fontSize: 11 }}>{text}</span>
    </div>
  )
}
