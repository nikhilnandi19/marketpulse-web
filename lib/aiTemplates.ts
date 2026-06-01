/**
 * aiTemplates.ts — Deterministic, data-grounded analysis templates.
 *
 * All functions are pure: input data → markdown string.
 * No external API calls, no AI, no randomness.
 *
 * Language rules:
 *   - Use "model indicates", "forecast suggests", "classified as", "may reflect"
 *   - Never use "buy", "sell", "guaranteed", "price will go up/fall"
 *   - Always end with educational disclaimer
 */

import type { CompanySummary, SectorSummary, SignalSnapshot } from '@/lib/types'
import { formatPercent, formatCurrency } from '@/lib/formatters'

// ─── Local formatting helpers ─────────────────────────────────────────────────

/** Safe number with fixed decimals — returns '—' for null/undefined/NaN */
function safeN(v: number | null | undefined, dec = 1): string {
  if (v == null || !isFinite(v)) return '—'
  return v.toFixed(dec)
}

/** Standard educational disclaimer appended to every section */
const DISCLAIMER =
  '\n---\n' +
  '*Educational analysis only. Not investment advice. ' +
  'MarketPulse outputs are generated from statistical models and historical data. ' +
  'They do not guarantee future price movements or returns.*'

// ─── Internal helper: normalise risk label ────────────────────────────────────

function riskNorm(risk: string | null | undefined): 'high' | 'mod' | 'low' | 'unknown' {
  const v = (risk ?? '').toLowerCase()
  if (v.includes('high'))                      return 'high'
  if (v.includes('mod') || v.includes('medium')) return 'mod'
  if (v.includes('low'))                       return 'low'
  return 'unknown'
}

// ─── Section A: Signal Explanation ───────────────────────────────────────────

export function explainSignal(company: CompanySummary): string {
  const {
    symbol, final_signal, forecast_signal, fundamental_label,
    review_reason, forecast_30d_upside_pct, risk_level, model_reliability,
  } = company

  const signalDescriptions: Record<string, string> = {
    'Potential Opportunity':
      `MarketPulse classifies **${symbol}** as **Potential Opportunity**. ` +
      `The adaptive momentum model forecasts a 30-day upside of **${formatPercent(forecast_30d_upside_pct)}**, ` +
      `model reliability is within acceptable bounds, and no significant fundamental concerns override the signal.` +
      (riskNorm(risk_level) === 'high'
        ? ` However, ${symbol} also carries a **High Risk** classification — the upside signal should be interpreted cautiously given elevated volatility.`
        : ''),

    'Stable Watchlist':
      `MarketPulse classifies **${symbol}** as **Stable Watchlist**. ` +
      `The 30-day forecast indicates **${formatPercent(forecast_30d_upside_pct)}** expected movement — ` +
      `positive or near-neutral, but below the threshold for an Opportunity classification. ` +
      `No significant fundamental red flags are detected. The model may suggest monitoring rather than acting on this name near-term.`,

    'High Volatility Speculative':
      `MarketPulse classifies **${symbol}** as **High Volatility Speculative**. ` +
      `The model detects annualized volatility significantly above the sector median, which reduces forecast confidence. ` +
      `The 30-day forecast upside is **${formatPercent(forecast_30d_upside_pct)}**, ` +
      `but the elevated risk profile means outcomes may vary considerably from the model projection.`,

    'Needs Further Review':
      `MarketPulse flags **${symbol}** as **Needs Further Review**. ` +
      (review_reason
        ? `The recorded reason is: *${review_reason}*. `
        : `The system detected anomalies or conflicting signals preventing a confident classification. `) +
      `This label indicates the model output should be treated with heightened caution.`,

    'Weak Fundamentals / Negative Forecast':
      `MarketPulse classifies **${symbol}** as **Weak Fundamentals / Negative Forecast**. ` +
      `The adaptive model projects **${formatPercent(forecast_30d_upside_pct)}** over 30 days, ` +
      `suggesting a negative or subpar expected return. ` +
      `Fundamental indicators may be below sector benchmarks. ` +
      `This classification reflects model-detected downside pressure based on historical price patterns and fundamentals.`,
  }

  const lead =
    signalDescriptions[final_signal] ??
    `MarketPulse assigns **${symbol}** the signal: **${final_signal || '—'}**.`

  return [
    `## Signal Explanation — ${symbol}`,
    '',
    lead,
    '',
    '**Supporting data:**',
    `- Final Signal: ${final_signal || '—'}`,
    `- Forecast Signal: ${forecast_signal || '—'}`,
    `- Fundamental Label: ${fundamental_label || '—'}`,
    `- 30D Forecast Upside: ${formatPercent(forecast_30d_upside_pct)}`,
    `- Risk Level: ${risk_level || '—'}`,
    `- Model Reliability: ${model_reliability || '—'}`,
    ...(review_reason ? [`- Review Reason: ${review_reason}`] : []),
    DISCLAIMER,
  ].join('\n')
}

// ─── Section B: Forecast View ─────────────────────────────────────────────────

export function explainForecast(company: CompanySummary): string {
  const {
    symbol, latest_price, forecast_30d_price, forecast_30d_upside_pct,
    dashboard_forecast_method, best_model_name, best_model_mape, forecast_30d_date,
  } = company

  const direction = (forecast_30d_upside_pct ?? 0) >= 0 ? 'upside' : 'downside'
  const magnitude = Math.abs(forecast_30d_upside_pct ?? 0)

  const magnitudeNote =
    magnitude < 2
      ? `This is a relatively flat forecast, suggesting the model sees limited near-term directional momentum for ${symbol}.`
      : magnitude < 10
        ? `This is a moderate forecast signal. The model shows some directional conviction, ` +
          `but the magnitude is within a range that may be sensitive to model error and market noise.`
        : `This is a substantial forecast deviation. Forecasts of this magnitude carry higher uncertainty ` +
          `and should be considered alongside model reliability and risk level before interpretation.`

  return [
    `## Forecast View — ${symbol}`,
    '',
    `The model projects a 30-day forecast price of **${formatCurrency(forecast_30d_price)}** ` +
      `from a latest close of **${formatCurrency(latest_price)}**, ` +
      `implying **${formatPercent(forecast_30d_upside_pct)}** ${direction}.`,
    '',
    magnitudeNote,
    '',
    '**Forecast details:**',
    `- Latest Close: ${formatCurrency(latest_price)}`,
    `- 30D Forecast Price: ${formatCurrency(forecast_30d_price)}`,
    `- Forecast Upside: ${formatPercent(forecast_30d_upside_pct)}`,
    `- Forecast Method: ${dashboard_forecast_method || '—'}`,
    `- Best Model: ${best_model_name || '—'}`,
    `- Model MAPE: ${safeN(best_model_mape, 2)}%`,
    ...(forecast_30d_date ? [`- Target Date: ${forecast_30d_date}`] : []),
    DISCLAIMER,
  ].join('\n')
}

// ─── Section C: Risk View ─────────────────────────────────────────────────────

export function explainRisk(company: CompanySummary): string {
  const {
    symbol, risk_level, annualized_volatility_pct,
    sector_median_volatility_pct, sector_relative_risk, final_signal,
  } = company

  const norm = riskNorm(risk_level)

  const secMed = sector_median_volatility_pct && isFinite(sector_median_volatility_pct)
    ? sector_median_volatility_pct : null

  const riskDescriptions: Record<string, string> = {
    high:
      `**${symbol}** is classified as **High Risk**. ` +
      `Annualized volatility is **${safeN(annualized_volatility_pct)}%**` +
      (secMed ? `, compared to a sector median of **${safeN(secMed)}%**` : '') +
      `. This level of price variability means model forecasts carry greater uncertainty — ` +
      `an unexpected market event or model error could significantly affect actual outcomes.`,
    mod:
      `**${symbol}** is classified as **Moderate Risk** with annualized volatility of ` +
      `**${safeN(annualized_volatility_pct)}%**` +
      (secMed ? ` (sector median: **${safeN(secMed)}%**)` : '') +
      `. Forecast confidence is reasonable but remains sensitive to broader market shifts.`,
    low:
      `**${symbol}** is classified as **Lower Risk** with annualized volatility of ` +
      `**${safeN(annualized_volatility_pct)}%**` +
      (secMed ? ` (sector median: **${safeN(secMed)}%**)` : '') +
      `. Lower volatility generally means model forecasts have a narrower error band, ` +
      `though forecast uncertainty is never eliminated.`,
    unknown:
      `**${symbol}** has risk level **${risk_level || 'Unavailable'}**. ` +
      `Annualized volatility is **${safeN(annualized_volatility_pct)}%**.`,
  }

  const volDiff =
    annualized_volatility_pct != null && secMed != null
      ? annualized_volatility_pct - secMed
      : null

  return [
    `## Risk View — ${symbol}`,
    '',
    riskDescriptions[norm],
    '',
    '**Risk data:**',
    `- Risk Level: ${risk_level || '—'}`,
    `- Annualized Volatility: ${safeN(annualized_volatility_pct)}%`,
    ...(secMed != null ? [`- Sector Median Volatility: ${safeN(secMed)}%`] : []),
    ...(volDiff !== null
      ? [`- Volatility vs Sector: ${volDiff >= 0 ? '+' : ''}${volDiff.toFixed(1)}%`]
      : []),
    `- Sector Relative Risk: ${sector_relative_risk || '—'}`,
    `- Signal: ${final_signal || '—'}`,
    DISCLAIMER,
  ].join('\n')
}

// ─── Section D: Model Reliability ────────────────────────────────────────────

export function explainReliability(company: CompanySummary): string {
  const { symbol, model_reliability, best_model_mape, best_model_name, dashboard_forecast_method } = company

  const mape = best_model_mape != null && isFinite(best_model_mape) ? best_model_mape : null

  const mapeNote =
    mape == null    ? 'MAPE data is unavailable for this company.' :
    mape < 1        ? `MAPE of **${safeN(mape, 2)}%** is exceptionally low, indicating very tight recent forecast error.` :
    mape < 2        ? `MAPE of **${safeN(mape, 2)}%** is strong, indicating low recent forecast error.` :
    mape < 5        ? `MAPE of **${safeN(mape, 2)}%** is acceptable, within a typical range for statistical price models.` :
    mape < 10       ? `MAPE of **${safeN(mape, 2)}%** is elevated — the model may have struggled with recent price patterns.` :
                      `MAPE of **${safeN(mape, 2)}%** is high, which may reduce confidence in the 30-day forecast.`

  const reliabilityContext: Record<string, string> = {
    'Very Strong Reliability':
      `Model reliability is rated **Very Strong Reliability** for ${symbol}. The model has demonstrated excellent historical accuracy in its recent backtesting window.`,
    'Strong Reliability':
      `Model reliability is rated **Strong Reliability** for ${symbol}. The best-performing model has demonstrated consistent forecast accuracy in the recent test window.`,
    'Acceptable Reliability':
      `Model reliability is rated **Acceptable Reliability** for ${symbol}. Forecasts are usable but carry moderate uncertainty — combine with volatility and risk context when interpreting.`,
    'High Error':
      `Model reliability is rated **High Error** for ${symbol}. The best-performing model has shown meaningful deviations from actual prices in the recent test window. Treat forecast numbers with extra caution.`,
    'Very High Error':
      `Model reliability is rated **Very High Error** for ${symbol}. Forecasts have carried significant error recently. The 30-day forecast should be treated as directional guidance only, not a precise price target.`,
  }

  const reliabilityDesc =
    reliabilityContext[model_reliability ?? ''] ??
    `Model reliability is classified as **${model_reliability || '—'}** for ${symbol}.`

  return [
    `## Model Reliability — ${symbol}`,
    '',
    reliabilityDesc,
    '',
    mapeNote,
    '',
    '**Reliability data:**',
    `- Model Reliability: ${model_reliability || '—'}`,
    `- Best Model: ${best_model_name || '—'}`,
    `- Model MAPE: ${safeN(mape, 2)}%`,
    `- Forecast Method: ${dashboard_forecast_method || '—'}`,
    '',
    '**What MAPE means:**',
    '- MAPE (Mean Absolute Percentage Error) measures average absolute forecast error as a percentage of actual price',
    '- Lower MAPE indicates tighter recent forecast accuracy in the backtesting window',
    '- Below 2% is considered strong; 2–5% is acceptable; above 5% is elevated',
    '- MAPE reflects the recent test window and may not predict future accuracy',
    DISCLAIMER,
  ].join('\n')
}

// ─── Section E: Sector Context ────────────────────────────────────────────────

export function explainSectorContext(
  company: CompanySummary,
  sector: SectorSummary | null,
): string {
  const { symbol, sector: sectorName, forecast_30d_upside_pct, annualized_volatility_pct } = company

  if (!sector) {
    return [
      `## Sector Context — ${symbol}`,
      '',
      `Sector comparison is unavailable for **${symbol}** (${sectorName || 'Unknown sector'}). ` +
        `Sector-level aggregates may not be loaded or ${sectorName} is not represented in the current sector summary.`,
      DISCLAIMER,
    ].join('\n')
  }

  const {
    sector: sectorLabel,
    avg_forecast_30d_upside_pct,
    avg_annualized_volatility_pct,
    avg_model_mape,
    number_of_companies,
    potential_opportunity_count,
    stable_watchlist_count,
    high_volatility_speculative_count,
    weak_negative_count,
    needs_further_review_count,
  } = sector

  const upsideDiff =
    forecast_30d_upside_pct != null && avg_forecast_30d_upside_pct != null
      ? forecast_30d_upside_pct - avg_forecast_30d_upside_pct
      : null

  const volDiff =
    annualized_volatility_pct != null && avg_annualized_volatility_pct != null
      ? annualized_volatility_pct - avg_annualized_volatility_pct
      : null

  const upsideComparison =
    upsideDiff !== null
      ? `**${symbol}**'s 30D forecast upside of **${formatPercent(forecast_30d_upside_pct)}** is ` +
        `**${upsideDiff >= 0 ? '+' : ''}${upsideDiff.toFixed(1)}%** relative to the ` +
        `**${sectorLabel}** sector average of **${formatPercent(avg_forecast_30d_upside_pct)}**.`
      : 'Forecast upside comparison to sector is unavailable.'

  const volComparison =
    volDiff !== null
      ? `Annualized volatility of **${safeN(annualized_volatility_pct)}%** is ` +
        `**${volDiff >= 0 ? '+' : ''}${volDiff.toFixed(1)}%** vs the sector average of ` +
        `**${safeN(avg_annualized_volatility_pct)}%**.`
      : 'Volatility comparison to sector is unavailable.'

  return [
    `## Sector Context — ${symbol} vs ${sectorLabel}`,
    '',
    upsideComparison,
    '',
    volComparison,
    '',
    `**${sectorLabel} sector breakdown:**`,
    `- Companies tracked: ${number_of_companies ?? '—'}`,
    `- Sector avg 30D upside: ${formatPercent(avg_forecast_30d_upside_pct)}`,
    `- Sector avg volatility: ${safeN(avg_annualized_volatility_pct)}%`,
    `- Sector avg MAPE: ${safeN(avg_model_mape, 2)}%`,
    `- Potential Opportunity: ${potential_opportunity_count ?? '—'}`,
    `- Stable Watchlist: ${stable_watchlist_count ?? '—'}`,
    `- High Vol Speculative: ${high_volatility_speculative_count ?? '—'}`,
    `- Weak / Negative: ${weak_negative_count ?? '—'}`,
    `- Needs Review: ${needs_further_review_count ?? '—'}`,
    DISCLAIMER,
  ].join('\n')
}

// ─── Section F: Watchlist Context ────────────────────────────────────────────

export function explainWatchlistContext(
  company: CompanySummary,
  isWatched: boolean,
  snapshots: SignalSnapshot[],
): string {
  const { symbol, company_name } = company

  const companySnaps = snapshots.filter(s => s.symbol === symbol)
  const latestSnap =
    companySnaps.length > 0
      ? [...companySnaps].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date))[0]
      : null

  const watchStatus = isWatched
    ? `**${symbol} (${company_name})** is currently in your **Watchlist**. ` +
      `You are actively tracking this company's signals, forecasts, and risk profile over time.`
    : `**${symbol} (${company_name})** is **not currently in your Watchlist**. ` +
      `Add it via the Company Explorer or Watchlist tabs to track it over time.`

  const snapshotLines: string[] = []
  if (latestSnap) {
    snapshotLines.push('', '**Signal tracking data:**')
    snapshotLines.push(`- Total signal snapshots recorded: ${companySnaps.length}`)
    snapshotLines.push(`- Latest snapshot date: ${latestSnap.snapshot_date}`)
    snapshotLines.push(`- Outcome status: ${latestSnap.outcome_status || '—'}`)
    snapshotLines.push(
      latestSnap.return_5d_pct !== null
        ? `- 5-day actual return: ${formatPercent(latestSnap.return_5d_pct)}`
        : '- 5-day outcome: Pending',
    )
    snapshotLines.push(
      latestSnap.return_30d_pct !== null
        ? `- 30-day actual return: ${formatPercent(latestSnap.return_30d_pct)}`
        : '- 30-day outcome: Pending (not yet elapsed)',
    )
  } else {
    snapshotLines.push('', 'Signal tracking snapshots are not yet available for this company.')
  }

  return [
    `## Watchlist Context — ${symbol}`,
    '',
    watchStatus,
    ...snapshotLines,
    DISCLAIMER,
  ].join('\n')
}

// ─── Section G: Stock Memo ────────────────────────────────────────────────────

export function generateStockMemo(
  company: CompanySummary,
  sector: SectorSummary | null,
  isWatched: boolean,
  snapshots: SignalSnapshot[],
): string {
  const {
    symbol, company_name, sector: sectorName, final_signal,
    forecast_30d_upside_pct, risk_level, model_reliability,
    best_model_mape, annualized_volatility_pct,
    latest_price, forecast_30d_price, dashboard_forecast_method,
    review_reason,
  } = company

  const companySnaps = snapshots.filter(s => s.symbol === symbol)
  const norm   = riskNorm(risk_level)
  const mape   = best_model_mape != null && isFinite(best_model_mape) ? best_model_mape : null
  const upside = forecast_30d_upside_pct != null && isFinite(forecast_30d_upside_pct) ? forecast_30d_upside_pct : null
  const vol    = annualized_volatility_pct != null && isFinite(annualized_volatility_pct) ? annualized_volatility_pct : null

  // ── Bull case: derive from positive signals
  const bullPoints: string[] = []
  if (upside !== null && upside > 0)
    bullPoints.push(`Adaptive model forecasts **${formatPercent(upside)}** 30-day upside`)
  if (final_signal === 'Potential Opportunity' || final_signal === 'Stable Watchlist')
    bullPoints.push(`MarketPulse signal is classified as **${final_signal}**`)
  if (model_reliability === 'Strong Reliability' || model_reliability === 'Very Strong Reliability')
    bullPoints.push(`Model reliability rated **${model_reliability}**${mape !== null ? ` with MAPE ${safeN(mape, 2)}%` : ''}`)
  if (norm === 'low')
    bullPoints.push('Lower Risk classification indicates historically lower price variability')
  if (sector && (sector.potential_opportunity_count ?? 0) > 3)
    bullPoints.push(`${sectorName} sector has ${sector.potential_opportunity_count} Potential Opportunity companies`)
  if (bullPoints.length === 0)
    bullPoints.push('No material positive signals detected in the current model output')

  // ── Bear case: derive from negative signals
  const bearPoints: string[] = []
  if (upside !== null && upside < 0)
    bearPoints.push(`Model projects negative 30-day return of **${formatPercent(upside)}**`)
  if (norm === 'high')
    bearPoints.push(`High Risk classification — annualized volatility **${safeN(vol)}%**`)
  if (model_reliability === 'High Error' || model_reliability === 'Very High Error')
    bearPoints.push(`Model reliability rated **${model_reliability}**${mape !== null ? ` (MAPE: ${safeN(mape, 2)}%)` : ''} — forecast confidence is limited`)
  if (final_signal === 'Weak Fundamentals / Negative Forecast')
    bearPoints.push('Signal classified as **Weak Fundamentals / Negative Forecast**')
  if (final_signal === 'Needs Further Review')
    bearPoints.push(`Signal flagged **Needs Further Review**${review_reason ? `: ${review_reason}` : ''}`)
  if (final_signal === 'High Volatility Speculative')
    bearPoints.push('High Volatility Speculative classification — elevated price swings reduce forecast reliability')
  if (companySnaps.length === 0)
    bearPoints.push('No signal tracking snapshots yet — forward return accuracy cannot be assessed')
  if (bearPoints.length === 0)
    bearPoints.push('No material negative signals detected in the current model output')

  // ── Summary lines
  const forecastLine =
    `Latest close **${formatCurrency(latest_price)}** → 30D target **${formatCurrency(forecast_30d_price)}** (**${formatPercent(upside)}**). ` +
    `Method: ${dashboard_forecast_method || '—'}.`

  const reliabilityLine =
    mape !== null
      ? `${model_reliability || '—'}, MAPE **${safeN(mape, 2)}%**. ` +
        (mape < 2 ? 'Strong model accuracy.' : mape < 5 ? 'Acceptable model accuracy.' : 'Elevated model error — treat forecast as directional guidance.')
      : `${model_reliability || '—'}. MAPE unavailable.`

  return [
    `## Stock Memo — ${symbol}`,
    '',
    `**Company:** ${company_name} (${symbol})`,
    `**Sector:** ${sectorName || '—'}`,
    `**Watchlist:** ${isWatched ? '★ Currently in Watchlist' : 'Not in Watchlist'}`,
    '',
    `**Current MarketPulse Signal:** ${final_signal || '—'}`,
    '',
    `**Forecast View:** ${forecastLine}`,
    '',
    `**Risk View:** ${risk_level || '—'}, annualized volatility **${safeN(vol)}%**.`,
    '',
    `**Reliability View:** ${reliabilityLine}`,
    '',
    '**Bull Case:**',
    ...bullPoints.map(p => `- ${p}`),
    '',
    '**Bear Case:**',
    ...bearPoints.map(p => `- ${p}`),
    '',
    '**Key Caveats:**',
    '- Forecasts are based on historical price momentum and may not reflect recent earnings, macro events, or news',
    '- Model MAPE reflects past error rate in the backtesting window, not future accuracy',
    '- Risk classification uses historical volatility, which may understate forward-looking risk',
    `- Signal tracking: ${companySnaps.length > 0 ? `${companySnaps.length} snapshot(s) recorded` : 'no snapshots yet'}`,
    ...(sector
      ? [`- Sector (${sectorName}): avg upside ${formatPercent(sector.avg_forecast_30d_upside_pct)}, avg vol ${safeN(sector.avg_annualized_volatility_pct)}%`]
      : []),
    '',
    '---',
    '**⚠ Disclaimer:** This is an educational model summary only. MarketPulse does not provide investment advice. ' +
      'Do not interpret this memo as a recommendation to buy, sell, or hold any security. ' +
      'All forecasts carry uncertainty and should be evaluated alongside qualitative research and professional financial advice.',
  ].join('\n')
}

// ─── Question router ──────────────────────────────────────────────────────────

/**
 * Maps a free-form question string to a section mode ID.
 * Used to route defaultQuestion from page.tsx to the right analysis section.
 */
export function routeQuestion(question: string): string {
  const q = question.toLowerCase()
  if (/signal|classif|opportunit|weak|stable|specul|review/.test(q)) return 'signal'
  if (/forecast|upside|downside|price|30.?day|predict/.test(q))       return 'forecast'
  if (/risk|volatil/.test(q))                                          return 'risk'
  if (/reliab|mape|error|model\s+acc/.test(q))                        return 'reliability'
  if (/sector|peer|compar|industry|benchmark/.test(q))                 return 'sector'
  if (/watchlist|track|watch|portfolio/.test(q))                       return 'watchlist'
  if (/memo|summar|brief|overview|thesis|case/.test(q))                return 'memo'
  return 'signal'
}
