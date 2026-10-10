/**
 * Stress-test windows. Dates are closing-basis peaks and troughs of the S&P 500.
 * The benchmark here is SPY, so tests check that SPY's own peak and trough land
 * within one trading day of these dates.
 */

export interface Scenario {
  id: string
  name: string
  /** Close the replay starts from (the peak close, or the close before a single bad day). */
  start: string
  /** Close the replay ends on (the trough close). */
  end: string
  kind: 'drawdown' | 'single_day'
  blurb: string
}

export const SCENARIOS: Scenario[] = [
  { id: 'q4_2018', name: 'Q4 2018 selloff', start: '2018-09-20', end: '2018-12-24', kind: 'drawdown', blurb: 'Rate-hike fears and trade war worries.' },
  { id: 'covid_2020', name: 'COVID crash', start: '2020-02-19', end: '2020-03-23', kind: 'drawdown', blurb: 'The fastest 30% fall on record.' },
  { id: 'bear_2022', name: '2022 rate bear market', start: '2022-01-03', end: '2022-10-12', kind: 'drawdown', blurb: 'Inflation and sharply higher interest rates.' },
  { id: 'tariff_2025', name: '2025 tariff selloff', start: '2025-02-19', end: '2025-04-08', kind: 'drawdown', blurb: 'New US tariffs and trade policy shock.' },
  // The worst day is 2020-03-16. The previous close is the starting point so the replay is that day's move.
  { id: 'worst_day', name: 'Worst single day', start: '2020-03-13', end: '2020-03-16', kind: 'single_day', blurb: 'Largest one-day fall in the window.' },
]

export interface ScenarioCheck {
  ok: boolean
  /** Dates found in the benchmark near the configured ones. */
  foundStart: string
  foundEnd: string
  /** Trading-day distance between configured and found dates. */
  startShift: number
  endShift: number
}

/**
 * Check a scenario against the benchmark series. For a drawdown scenario we look for the
 * highest close near the start and the lowest close near the end. For a single-day scenario
 * we look for the worst daily return near the end date. `radius` is the search distance in days.
 */
export function checkScenario(dates: string[], bench: (number | null)[], s: Scenario, radius = 10): ScenarioCheck {
  const si = dates.indexOf(s.start)
  const ei = dates.indexOf(s.end)
  if (si < 0 || ei < 0) return { ok: false, foundStart: '', foundEnd: '', startShift: NaN, endShift: NaN }
  const range = (c: number) => {
    const out: number[] = []
    for (let i = Math.max(1, c - radius); i <= Math.min(dates.length - 1, c + radius); i++) if (bench[i] != null) out.push(i)
    return out
  }
  let foundStartIdx = si
  let foundEndIdx = ei
  if (s.kind === 'drawdown') {
    foundStartIdx = range(si).reduce((b, i) => ((bench[i] as number) > (bench[b] as number) ? i : b), si)
    foundEndIdx = range(ei).reduce((b, i) => ((bench[i] as number) < (bench[b] as number) ? i : b), ei)
  } else {
    const ret = (i: number) => (bench[i] as number) / (bench[i - 1] as number) - 1
    foundEndIdx = range(ei).filter(i => bench[i - 1] != null).reduce((b, i) => (ret(i) < ret(b) ? i : b), ei)
    foundStartIdx = foundEndIdx - 1
  }
  const startShift = foundStartIdx - si
  const endShift = foundEndIdx - ei
  return {
    ok: Math.abs(startShift) <= 1 && Math.abs(endShift) <= 1,
    foundStart: dates[foundStartIdx],
    foundEnd: dates[foundEndIdx],
    startShift,
    endShift,
  }
}
