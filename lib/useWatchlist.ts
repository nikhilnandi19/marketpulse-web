'use client'

/**
 * useWatchlist — localStorage-backed ticker watchlist.
 *
 * Storage:
 *   key   : "mp_watchlist_v1"
 *   value : JSON array of uppercase ticker strings, e.g. ["AAPL","NVDA","RL"]
 *
 * SSR-safety:
 *   localStorage is ONLY accessed inside useEffect (after mount) and in
 *   event-handler callbacks. It is never touched at module scope or during
 *   the initial render, so there is no hydration mismatch.
 */

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'mp_watchlist_v1'

function normalize(symbol: string): string {
  return symbol.trim().toUpperCase()
}

function readStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Filter out non-string or empty entries; normalize the rest
    return Array.from(new Set(parsed.filter((s): s is string => typeof s === 'string' && s.trim() !== '').map(normalize)))
  } catch {
    // Malformed JSON or security error — reset silently
    return []
  }
}

function writeStorage(symbols: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols))
  } catch {
    // Storage quota or security error — ignore silently
  }
}

export interface WatchlistHook {
  /** Ordered list of uppercase ticker symbols in the watchlist. */
  symbols: string[]
  /** True once the hook has read from localStorage (prevents SSR flash). */
  mounted: boolean
  /** Add a symbol if not present; remove it if already present. */
  toggle: (symbol: string) => void
  /** Add a symbol. Normalises to uppercase. No-op if already present. */
  add: (symbol: string) => void
  /** Remove a symbol. No-op if not present. */
  remove: (symbol: string) => void
  /** Returns true if the symbol is currently in the watchlist. */
  isWatched: (symbol: string) => boolean
  /** Remove all symbols from the watchlist. */
  clear: () => void
}

export function useWatchlist(): WatchlistHook {
  const [symbols, setSymbols] = useState<string[]>([])
  const [mounted, setMounted]  = useState(false)

  // Read from localStorage only after the first client-side render
  useEffect(() => {
    setSymbols(readStorage())
    setMounted(true)
  }, [])

  const updateSymbols = useCallback((next: string[]) => {
    // Deduplicate before writing
    const deduped = Array.from(new Set(next))
    setSymbols(deduped)
    writeStorage(deduped)
  }, [])

  const toggle = useCallback((symbol: string) => {
    const sym = normalize(symbol)
    setSymbols(prev => {
      const next = prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
      const deduped = Array.from(new Set(next))
      writeStorage(deduped)
      return deduped
    })
  }, [])

  const add = useCallback((symbol: string) => {
    const sym = normalize(symbol)
    setSymbols(prev => {
      if (prev.includes(sym)) return prev
      const next = [...prev, sym]
      writeStorage(next)
      return next
    })
  }, [])

  const remove = useCallback((symbol: string) => {
    const sym = normalize(symbol)
    setSymbols(prev => {
      const next = prev.filter(s => s !== sym)
      writeStorage(next)
      return next
    })
  }, [])

  const isWatched = useCallback(
    (symbol: string) => symbols.includes(normalize(symbol)),
    [symbols]
  )

  const clear = useCallback(() => {
    updateSymbols([])
  }, [updateSymbols])

  return { symbols, mounted, toggle, add, remove, isWatched, clear }
}
