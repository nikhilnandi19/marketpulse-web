'use client'

import { useMemo, useState } from 'react'
import { marketShock, reverseStress, sectorShock, SCENARIOS, type Metrics, type ScenarioResult } from '@/lib/risk'
import { S, R, inset, glass, labelStyle, fmtPct, fmtDate, fmtMoney, pctColor } from './tokens'

interface Props {
  scenarios: ScenarioResult[]
  m: Metrics | null
  sectorOf: Record<string, string>
  size: number
  windowLabel: string
}

const signed = (x: number, d = 1) => (Number.isFinite(x) ? `${x >= 0 ? '+' : ''}${(x * 100).toFixed(d)}%` : 'n/a')
const money = (x: number, size: number) => `${x < 0 ? '-' : '+'}${fmtMoney(Math.abs(x) * size)}`

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={glass({ padding: '22px 24px' })}>
      <div style={{ fontSize: 16, fontWeight: 600, color: S.textPrimary }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: S.textMuted, margin: '2px 0 14px', lineHeight: 1.55, maxWidth: 640 }}>{sub}</div>}
      {children}
    </div>
  )
}

function ScenarioCard({ r, size }: { r: ScenarioResult; size: number }) {
  const cfg = SCENARIOS.find(s => s.id === r.id)
  const single = cfg?.kind === 'single_day'
  return (
    <div style={glass({ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 })}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: S.textPrimary }}>{r.name}</div>
          {r.status === 'partial' && (
            <span style={{ fontSize: 10, fontFamily: S.mono, color: S.warning, background: `${S.warning}18`, border: `1px solid ${S.warning}35`, borderRadius: R.min, padding: '1px 8px', whiteSpace: 'nowrap' }}>
              Partial · {fmtPct(r.coverage, 0)} covered
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, fontFamily: S.mono, color: S.textMuted, marginTop: 2 }}>
          {single ? `${fmtDate(r.end)}, close to close` : `${fmtDate(r.start)} to ${fmtDate(r.end)}`}
        </div>
        <div style={{ fontSize: 12, color: S.textMuted, marginTop: 2 }}>{cfg?.blurb}</div>
      </div>

      {r.status === 'unavailable' ? (
        <p style={{ fontSize: 13, color: S.textMuted, lineHeight: 1.55, margin: 0 }}>Not shown. {r.reason}</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={labelStyle}>Your portfolio</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: pctColor(r.portfolioReturn), letterSpacing: '-0.02em' }}>{signed(r.portfolioReturn!)}</div>
              <div style={{ fontSize: 12, fontFamily: S.mono, color: S.textMuted }}>{money(r.portfolioReturn!, size)}</div>
            </div>
            <div>
              <div style={labelStyle}>SPY</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: pctColor(r.benchmarkReturn), letterSpacing: '-0.02em' }}>{signed(r.benchmarkReturn!)}</div>
            </div>
          </div>
          {!single && (
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 12, color: S.textSecondary }}>
              <span>Worst day <b style={{ fontFamily: S.mono, color: S.negative }}>{signed(r.worstDay!.value)}</b> <span style={{ color: S.textMuted }}>on {fmtDate(r.worstDay!.date)}</span></span>
              <span>Max drawdown <b style={{ fontFamily: S.mono, color: S.negative }}>{fmtPct(r.maxDrawdown!)}</b></span>
            </div>
          )}
          {r.topLosers.length > 0 && (
            <div>
              <div style={{ ...labelStyle, marginBottom: 6 }}>Biggest losses</div>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {r.topLosers.map(h => (
                  <li key={h.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: S.mono, color: S.textSecondary }}>
                    <span><b style={{ color: S.textPrimary }}>{h.symbol}</b> {signed(h.ret, 0)}</span>
                    <span>{signed(h.contribution)} of portfolio</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.excluded.length > 0 && (
            <div style={{ fontSize: 12, color: S.warning, lineHeight: 1.5 }}>
              Left out, no prices on both dates: {r.excluded.join(', ')}. The other weights were scaled up to 100%.
            </div>
          )}
          {r.carriedDays > 0 && <div style={{ fontSize: 11, color: S.textMuted }}>{r.carriedDays} missing prices inside the window used the last known price.</div>}
        </>
      )}
    </div>
  )
}

export default function StressTests({ scenarios, m, sectorOf, size, windowLabel }: Props) {
  const [shock, setShock] = useState(-10)
  const [target, setTarget] = useState(-20)
  const [sector, setSector] = useState<string>('')
  const [sectorPct, setSectorPct] = useState(-20)

  const weights = useMemo(() => m?.holdings.map(h => h.weight) ?? [], [m])
  const symbols = useMemo(() => m?.holdings.map(h => h.symbol) ?? [], [m])
  const betas = useMemo(() => m?.holdings.map(h => h.beta) ?? [], [m])
  const betasOk = betas.every(Number.isFinite)

  const ms = useMemo(() => (m && betasOk ? marketShock(symbols, weights, betas, shock / 100) : null), [m, betasOk, symbols, weights, betas, shock])
  const rev = m && Number.isFinite(m.beta) ? reverseStress(target / 100, m.beta) : null

  // Stocks with no sector in the data cannot be shocked by sector.
  const sectors = m?.sectors.map(s => s.sector).filter(x => x !== 'Unknown') ?? []
  const activeSector = sectors.includes(sector) ? sector : sectors[0]
  const ss = useMemo(
    () => (m && activeSector ? sectorShock(symbols, weights, sectorOf, activeSector, sectorPct / 100) : null),
    [m, activeSector, symbols, weights, sectorOf, sectorPct],
  )

  const shown = scenarios.filter(s => s.status !== 'unavailable' || true)

  return (
    <section aria-labelledby="stress-title" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 id="stress-title" style={{ fontSize: 20, fontWeight: 700, color: S.textPrimary, margin: 0, letterSpacing: '-0.02em' }}>Stress tests</h2>
        <p style={{ fontSize: 13, color: S.textMuted, margin: '6px 0 0', maxWidth: 720, lineHeight: 1.6 }}>
          How your current mix would have done in real sell-offs, and rough what-ifs. Replays use your weights at the start of each window, buy and hold, with no rebalancing. Returns include dividends and are compared with SPY, an ETF that tracks the S&P 500.
        </p>
      </div>

      <div role="note" style={{ fontSize: 13, color: S.textSecondary, lineHeight: 1.6, background: `${S.warning}10`, border: `1px solid ${S.warning}30`, borderRadius: R.control, padding: '10px 14px' }}>
        <b style={{ color: S.textPrimary }}>Survivorship bias.</b> The stocks here are today's S&P 500 members. Companies that were removed or failed since then are not included, so these replays make past sell-offs look milder than they were for someone holding the index at the time.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 16 }}>
        {shown.map(r => <ScenarioCard key={r.id} r={r} size={size} />)}
      </div>

      {m && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(420px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
          <Panel title="If the market falls" sub={`A rough estimate: portfolio beta times the market move. It assumes each stock's beta, measured over the last ${windowLabel}, holds. In real crises betas often change, so compare it with the replays above.`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <label htmlFor="shock" style={labelStyle}>SPY falls</label>
              <input id="shock" type="range" min={-30} max={-5} step={5} value={shock} onChange={e => setShock(Number(e.target.value))}
                aria-valuetext={`SPY falls ${Math.abs(shock)} percent`} style={{ flex: '1 1 160px', minHeight: 44, accentColor: S.primary }} />
              <span style={{ fontFamily: S.mono, fontSize: 15, fontWeight: 700, color: S.negative, width: 48 }}>{shock}%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: S.mono, fontSize: 10, color: S.textMuted, margin: '-4px 0 12px', padding: '0 62px 0 52px' }}>
              <span>-30</span><span>-20</span><span>-10</span><span>-5</span>
            </div>
            {ms ? (
              <>
                <div style={{ fontSize: 14, color: S.textSecondary, lineHeight: 1.6 }}>
                  Estimated portfolio move: <b style={{ fontFamily: S.mono, fontSize: 20, color: S.negative }}>{signed(ms.estimatedMove)}</b>{' '}
                  <span style={{ fontFamily: S.mono, color: S.textMuted }}>({money(ms.estimatedMove, size)})</span>
                  <div style={{ fontSize: 12, color: S.textMuted }}>Portfolio beta {ms.portfolioBeta.toFixed(2)}</div>
                </div>
                <ul style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[...ms.perHolding].sort((a, b) => a.contribution - b.contribution).map((h, i) => (
                    <li key={h.symbol} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontFamily: S.mono, color: S.textSecondary }}>
                      <span><b style={{ color: S.textPrimary }}>{h.symbol}</b> <span style={{ color: S.textMuted }}>beta {betas[symbols.indexOf(h.symbol)].toFixed(2)}</span></span>
                      <span>{signed(h.contribution)}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p style={{ fontSize: 13, color: S.textMuted }}>Beta could not be computed for every holding in this window.</p>}

            <div style={{ borderTop: `1px solid ${S.divider}`, marginTop: 18, paddingTop: 16 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={labelStyle}>Reverse stress</span>
                {[-10, -20, -30].map(t => (
                  <button className="pf-tap" key={t} aria-pressed={target === t} onClick={() => setTarget(t)}
                    style={{ minHeight: 36, minWidth: 52, borderRadius: R.control, border: `1px solid ${S.border}`, cursor: 'pointer', fontFamily: S.mono, fontSize: 12, fontWeight: 600, background: target === t ? `${S.primary}26` : 'transparent', color: target === t ? S.primary : S.textMuted }}>
                    {t}%
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 13, color: S.textSecondary, lineHeight: 1.6, margin: '10px 0 0' }}>
                {rev !== null
                  ? <>A market fall of about <b style={{ fontFamily: S.mono, color: S.negative }}>{(rev * 100).toFixed(1)}%</b> would take this portfolio down {Math.abs(target)}%, if beta holds.</>
                  : 'This portfolio has a beta of zero or below, so no market fall in this simple model would produce that loss.'}
              </p>
            </div>
          </Panel>

          <Panel title="If one sector falls" sub="Applies the fall directly to the holdings in that sector and leaves every other stock unchanged.">
            {sectors.length === 0 ? <p style={{ fontSize: 13, color: S.textMuted }}>No sectors available.</p> : (
              <>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label htmlFor="sector-pick" style={labelStyle}>Sector</label>
                  <select className="pf-tap" id="sector-pick" value={activeSector} onChange={e => setSector(e.target.value)}
                    style={{ minHeight: 40, fontFamily: S.body, fontSize: 13, color: S.textPrimary, background: 'rgba(255,255,255,0.06)', border: `1px solid ${S.border}`, borderRadius: R.control, padding: '0 10px' }}>
                    {sectors.map(s => <option key={s} value={s} style={{ background: '#201f26' }}>{s}</option>)}
                  </select>
                  {[-10, -20, -30].map(t => (
                    <button className="pf-tap" key={t} aria-pressed={sectorPct === t} onClick={() => setSectorPct(t)}
                      style={{ minHeight: 36, minWidth: 52, borderRadius: R.control, border: `1px solid ${S.border}`, cursor: 'pointer', fontFamily: S.mono, fontSize: 12, fontWeight: 600, background: sectorPct === t ? `${S.primary}26` : 'transparent', color: sectorPct === t ? S.primary : S.textMuted }}>
                      {t}%
                    </button>
                  ))}
                </div>
                {ss && (
                  <div style={{ fontSize: 14, color: S.textSecondary, lineHeight: 1.7, marginTop: 14 }}>
                    {activeSector} is {fmtPct(ss.affectedWeight)} of the portfolio ({ss.perHolding.map(h => h.symbol).join(', ')}).
                    <br />
                    A {Math.abs(sectorPct)}% fall there moves the portfolio by <b style={{ fontFamily: S.mono, fontSize: 20, color: S.negative }}>{signed(ss.impact)}</b>{' '}
                    <span style={{ fontFamily: S.mono, color: S.textMuted }}>({money(ss.impact, size)})</span>.
                  </div>
                )}
              </>
            )}
          </Panel>
        </div>
      )}
    </section>
  )
}
