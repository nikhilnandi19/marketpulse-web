import type { PriceFile } from '@/lib/risk'

export interface RiskMeta {
  exported_at: string
  source: string
  methodology_version: string
  benchmark: string
  first_date: string
  last_date: string
  symbols_skipped: Record<string, string>
}

const BASE = '/data/risk'
const cache = new Map<string, Promise<PriceFile | null>>()

async function getJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/${path}`)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

export async function loadRiskBase(): Promise<{ dates: string[]; benchmark: PriceFile; meta: RiskMeta } | null> {
  const [dates, benchmark, meta] = await Promise.all([
    getJSON<string[]>('calendar.json'),
    getJSON<PriceFile>('benchmark.json'),
    getJSON<RiskMeta>('meta.json'),
  ])
  return dates && benchmark && meta ? { dates, benchmark, meta } : null
}

/** One ticker's adjusted closes. Null if the file does not exist. Cached per session. */
export function loadPriceFile(symbol: string): Promise<PriceFile | null> {
  let p = cache.get(symbol)
  if (!p) {
    p = getJSON<PriceFile>(`prices/${encodeURIComponent(symbol)}.json`)
    cache.set(symbol, p)
  }
  return p
}
