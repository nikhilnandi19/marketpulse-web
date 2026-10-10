import { MAX_HOLDINGS, WINDOWS, type WindowKey } from './config'

/** What a share link carries. Weights are percents; omitted means equal weight. */
export interface SharedPortfolio {
  holdings: { symbol: string; weight?: number }[]
  window: WindowKey
  confidence: 0.95 | 0.99
  size: number
}

export interface DecodeResult {
  /** True if the hash looks like a share link at all. */
  isShare: boolean
  value: SharedPortfolio | null
  /** Plain-English notes about anything that could not be read. */
  problems: string[]
}

const PREFIX = 'portfolio?'
const SYMBOL = /^[A-Z0-9][A-Z0-9.\-]{0,9}$/
const MAX_SIZE = 1e12

const unique = (xs: string[]) => xs.filter((x, i) => xs.indexOf(x) === i)

export function isShareHash(hash: string): boolean {
  return hash.replace(/^#/, '').startsWith(PREFIX)
}

/** Build the part after "#" for a link. No server storage: everything is in the URL. */
export function encodeShare(p: SharedPortfolio): string {
  const custom = p.holdings.some(h => h.weight !== undefined)
  const h = p.holdings
    .map(x => (custom ? `${x.symbol}~${Number((x.weight ?? 0).toFixed(4))}` : x.symbol))
    .join(',')
  return `${PREFIX}h=${h}&w=${p.window}&c=${Math.round(p.confidence * 100)}&s=${p.size}`
}

/** Read a share hash. Never throws. Bad pieces are skipped and reported. */
export function decodeShare(hash: string): DecodeResult {
  const raw = hash.replace(/^#/, '')
  if (!raw.startsWith(PREFIX)) return { isShare: false, value: null, problems: [] }
  const problems: string[] = []
  let params: URLSearchParams
  try {
    params = new URLSearchParams(raw.slice(PREFIX.length))
  } catch {
    return { isShare: true, value: null, problems: ['The link could not be read.'] }
  }

  const entries = (params.get('h') ?? '').split(',').filter(Boolean)
  const seen = new Set<string>()
  const holdings: { symbol: string; weight?: number }[] = []
  let withWeight = 0
  for (const e of entries) {
    const [symRaw, wRaw] = e.split('~')
    const symbol = (symRaw ?? '').trim().toUpperCase()
    if (!SYMBOL.test(symbol)) {
      problems.push('Some tickers in the link were not valid and were skipped.')
      continue
    }
    if (seen.has(symbol)) continue
    let weight: number | undefined
    if (wRaw !== undefined) {
      const n = Number(wRaw)
      if (Number.isFinite(n) && n >= 0 && n <= 1000) {
        weight = n
        withWeight++
      } else problems.push(`The weight for ${symbol} was not valid, so equal weights are used.`)
    }
    seen.add(symbol)
    holdings.push({ symbol, weight })
  }
  if (holdings.length > MAX_HOLDINGS) {
    problems.push(`The link had more than ${MAX_HOLDINGS} stocks. Only the first ${MAX_HOLDINGS} were kept.`)
    holdings.length = MAX_HOLDINGS
  }
  if (holdings.length === 0) {
    return { isShare: true, value: null, problems: [...unique(problems), 'The link did not contain any valid stocks.'] }
  }
  // Mixed or broken weights: fall back to equal weight rather than guess.
  const allWeighted = withWeight === holdings.length
  const usable = allWeighted ? holdings : holdings.map(h => ({ symbol: h.symbol }))
  if (!allWeighted && withWeight > 0) problems.push('Weights were incomplete, so equal weights are used.')
  if (allWeighted && holdings.reduce((a, h) => a + (h.weight ?? 0), 0) <= 0) {
    return { isShare: true, value: null, problems: [...unique(problems), 'The weights in the link add up to zero.'] }
  }

  const wKey = params.get('w') ?? ''
  const window: WindowKey = wKey in WINDOWS ? (wKey as WindowKey) : '2Y'
  if (params.has('w') && !(wKey in WINDOWS)) problems.push('The window in the link was not valid, so 2Y is used.')

  const confidence = params.get('c') === '99' ? 0.99 : 0.95
  const sizeNum = Number(params.get('s'))
  const size = Number.isFinite(sizeNum) && sizeNum > 0 && sizeNum <= MAX_SIZE ? sizeNum : 100_000
  if (params.has('s') && !(sizeNum > 0 && sizeNum <= MAX_SIZE)) problems.push('The portfolio size in the link was not valid, so $100,000 is used.')

  return { isShare: true, value: { holdings: usable, window, confidence, size }, problems: unique(problems) }
}
