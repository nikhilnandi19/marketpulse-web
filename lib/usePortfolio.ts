'use client'

/**
 * usePortfolio: weights, window and settings for the Portfolio page, plus the
 * risk analysis computed in a Web Worker.
 *
 * Storage:
 *   Tickers   : still the watchlist key "mp_watchlist_v1" (see useWatchlist), so old
 *               watchlists keep working and the bookmark buttons elsewhere stay in sync.
 *   Everything else: "mp_portfolio_v1" = { weights, window, confidence, size }.
 *     weights is { TICKER: percent }. A ticker with no entry gets the average of the
 *     entered weights (or an equal share if none were entered).
 *
 * localStorage is only touched after mount.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DEFAULT_WINDOW, WINDOWS, type Holding, type WindowKey } from '@/lib/risk'
import { loadPriceFile, loadRiskBase, type RiskMeta } from '@/lib/riskData'
import type { AnalysisPayload, FromWorker, ToWorker } from '@/workers/riskMessages'

const STORAGE_KEY = 'mp_portfolio_v1'
const DEBOUNCE_MS = 150

export type Confidence = 0.95 | 0.99

interface Stored {
  weights: Record<string, number>
  window: WindowKey
  confidence: Confidence
  size: number
}

const DEFAULTS: Stored = { weights: {}, window: DEFAULT_WINDOW, confidence: 0.95, size: 100_000 }

function readStored(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const p = JSON.parse(raw)
    const weights: Record<string, number> = {}
    if (p && typeof p.weights === 'object' && p.weights) {
      for (const [k, v] of Object.entries(p.weights)) {
        if (typeof v === 'number' && Number.isFinite(v) && v >= 0) weights[k.toUpperCase()] = v
      }
    }
    return {
      weights,
      window: p.window in WINDOWS ? p.window : DEFAULTS.window,
      confidence: p.confidence === 0.99 ? 0.99 : 0.95,
      size: typeof p.size === 'number' && p.size > 0 ? p.size : DEFAULTS.size,
    }
  } catch {
    return DEFAULTS
  }
}

function writeStored(s: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch {
    // Quota or privacy mode: the page still works, it just will not remember.
  }
}

export type DataStatus = 'loading' | 'ready' | 'unavailable'

export interface PortfolioHook {
  settings: Stored
  /** Weight shown for each ticker before scaling to 100%, in percent. */
  rawWeights: Record<string, number>
  setWeight: (symbol: string, percent: number) => void
  setWindow: (w: WindowKey) => void
  setConfidence: (c: Confidence) => void
  setSize: (n: number) => void
  setEqualWeights: () => void
  setInverseVolWeights: () => void
  analysis: AnalysisPayload | null
  /** True while a new result is being computed. */
  computing: boolean
  dataStatus: DataStatus
  meta: RiskMeta | null
  /** Tickers on the page that have no price file at all. */
  noFile: string[]
  error: string | null
}

export function usePortfolio(symbols: string[], sectorOf: Record<string, string>): PortfolioHook {
  const [settings, setSettings] = useState<Stored>(DEFAULTS)
  const [loaded, setLoaded] = useState(false)
  const [analysis, setAnalysis] = useState<AnalysisPayload | null>(null)
  const [computing, setComputing] = useState(false)
  const [dataStatus, setDataStatus] = useState<DataStatus>('loading')
  const [meta, setMeta] = useState<RiskMeta | null>(null)
  const [noFile, setNoFile] = useState<string[]>([])
  const [filesVersion, setFilesVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const sentFiles = useRef<Set<string>>(new Set())
  const requestId = useRef(0)
  const latestApplied = useRef(0)

  useEffect(() => {
    setSettings(readStored())
    setLoaded(true)
  }, [])

  const update = useCallback((patch: Partial<Stored>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      writeStored(next)
      return next
    })
  }, [])

  // Start the worker and load the calendar + benchmark once.
  useEffect(() => {
    const worker = new Worker(new URL('../workers/risk.worker.ts', import.meta.url))
    workerRef.current = worker
    worker.onmessage = (e: MessageEvent<FromWorker>) => {
      const msg = e.data
      if (msg.id < latestApplied.current) return // a newer result already arrived
      latestApplied.current = msg.id
      if (msg.type === 'result') {
        setAnalysis(msg.payload)
        setError(null)
      } else {
        setError(msg.message)
      }
      if (msg.id === requestId.current) setComputing(false)
    }
    let cancelled = false
    loadRiskBase().then(base => {
      if (cancelled) return
      if (!base) {
        setDataStatus('unavailable')
        return
      }
      setMeta(base.meta)
      const m: ToWorker = { type: 'base', dates: base.dates, benchmark: base.benchmark }
      worker.postMessage(m)
      setDataStatus('ready')
    })
    return () => {
      cancelled = true
      worker.terminate()
      workerRef.current = null
      sentFiles.current = new Set()
    }
  }, [])

  // Fetch price files for tickers we have not loaded yet and hand them to the worker.
  const key = symbols.join(',')
  useEffect(() => {
    if (dataStatus !== 'ready' || !workerRef.current) return
    let cancelled = false
    const need = symbols.filter(s => !sentFiles.current.has(s))
    Promise.all(symbols.map(s => loadPriceFile(s).then(f => [s, f] as const))).then(results => {
      if (cancelled || !workerRef.current) return
      setNoFile(results.filter(([, f]) => f === null).map(([s]) => s))
      const fresh = results.filter(([s, f]) => f && need.includes(s)).map(([, f]) => f!)
      if (fresh.length) {
        const m: ToWorker = { type: 'files', files: fresh }
        workerRef.current.postMessage(m)
        fresh.forEach(f => sentFiles.current.add(f.symbol))
      }
      setFilesVersion(v => v + 1)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, dataStatus])

  // Tickers with no entry get the average of the entered weights, or an equal share if none were entered.
  const rawWeights = useMemo(() => {
    const entered = symbols.map(s => settings.weights[s]).filter((v): v is number => v !== undefined)
    const fallback = entered.length ? entered.reduce((a, b) => a + b, 0) / entered.length : 100 / Math.max(1, symbols.length)
    const out: Record<string, number> = {}
    for (const s of symbols) out[s] = settings.weights[s] ?? fallback
    return out
  }, [symbols, settings.weights])

  const holdingsKey = symbols.map(s => `${s}:${rawWeights[s]}`).join(',')
  useEffect(() => {
    if (!loaded || dataStatus !== 'ready' || filesVersion === 0 || !workerRef.current) return
    if (symbols.length === 0) {
      setAnalysis(null)
      setComputing(false)
      return
    }
    setComputing(true)
    const timer = setTimeout(() => {
      const holdings: Holding[] = symbols.map(symbol => ({ symbol, weight: rawWeights[symbol] }))
      const id = ++requestId.current
      const m: ToWorker = { type: 'analyze', id, holdings, opts: { window: settings.window, confidence: settings.confidence, sectorOf } }
      workerRef.current?.postMessage(m)
    }, DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingsKey, settings.window, settings.confidence, loaded, dataStatus, filesVersion])

  const setWeight = useCallback(
    (symbol: string, percent: number) => {
      const v = Number.isFinite(percent) ? Math.max(0, percent) : 0
      // Entering one weight pins every visible weight so the others do not jump around.
      const pinned: Record<string, number> = { ...rawWeights, ...settings.weights, [symbol]: v }
      for (const s of symbols) if (pinned[s] === undefined) pinned[s] = rawWeights[s]
      update({ weights: pinned })
    },
    [rawWeights, settings.weights, symbols, update],
  )

  const setEqualWeights = useCallback(() => update({ weights: {} }), [update])

  const setInverseVolWeights = useCallback(() => {
    const hs = analysis?.metrics?.holdings
    if (!hs || hs.length === 0) return
    const inv = hs.map(h => (h.annVol > 0 ? 1 / h.annVol : 0))
    const total = inv.reduce((a, b) => a + b, 0)
    if (!(total > 0)) return
    // Keep every visible weight where it is, then re-split only the included stocks'
    // combined weight by inverse volatility. The total shown stays the same as before.
    const next: Record<string, number> = { ...rawWeights }
    const pool = hs.reduce((a, h) => a + (rawWeights[h.symbol] ?? 0), 0)
    hs.forEach((h, i) => (next[h.symbol] = Math.round(((inv[i] / total) * pool) * 100) / 100))
    update({ weights: next })
  }, [analysis, rawWeights, update])

  return {
    settings,
    rawWeights,
    setWeight,
    setWindow: w => update({ window: w }),
    setConfidence: c => update({ confidence: c }),
    setSize: n => update({ size: n > 0 ? n : DEFAULTS.size }),
    setEqualWeights,
    setInverseVolWeights,
    analysis,
    computing,
    dataStatus,
    meta,
    noFile,
    error,
  }
}
