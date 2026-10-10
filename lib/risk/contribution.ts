import { TRADING_DAYS } from './config'
import { covMatrix, mean } from './stats'
import { tailIndices } from './varES'

/** Annualized sample covariance matrix of daily returns (one row per asset). */
export function annualCovariance(returns: number[][]): number[][] {
  return covMatrix(returns).map(row => row.map(v => v * TRADING_DAYS))
}

/** Portfolio volatility sigma_p = sqrt(w' Sigma w). */
export function portfolioVol(sigma: number[][], w: number[]): number {
  let s = 0
  for (let i = 0; i < w.length; i++) for (let j = 0; j < w.length; j++) s += w[i] * sigma[i][j] * w[j]
  return Math.sqrt(Math.max(0, s))
}

export interface RiskContribution {
  vol: number
  /** Marginal contribution: (Sigma w)_i / sigma_p. */
  marginal: number[]
  /** w_i * marginal_i. These add up exactly to vol (Euler decomposition). */
  contribution: number[]
  /** contribution_i / vol. These add up to 1. NaN when vol is zero. */
  percent: number[]
}

/**
 * Where the volatility comes from. A stock's share of risk is its weight times its
 * volatility times how closely it moves with the rest of the portfolio.
 */
export function riskContributions(sigma: number[][], w: number[]): RiskContribution {
  const vol = portfolioVol(sigma, w)
  const n = w.length
  const marginal = new Array<number>(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let j = 0; j < n; j++) s += sigma[i][j] * w[j]
    marginal[i] = vol > 0 ? s / vol : NaN
  }
  const contribution = marginal.map((m, i) => w[i] * m)
  const percent = contribution.map(c => (vol > 0 ? c / vol : NaN))
  return { vol, marginal, contribution, percent }
}

export interface TailContribution {
  es: number
  tailCount: number
  /** ES_i = -w_i * mean(r_i on the portfolio's bad days). These add up exactly to es. */
  contribution: number[]
}

/** Who hurts you on the bad days: each holding's share of the portfolio's expected shortfall. */
export function tailContributions(returns: number[][], w: number[], rp: number[], confidence: number): TailContribution {
  const idx = tailIndices(rp, confidence)
  const contribution = returns.map((row, i) => -w[i] * mean(idx.map(t => row[t])))
  const es = -mean(idx.map(t => rp[t]))
  return { es, tailCount: idx.length, contribution }
}
