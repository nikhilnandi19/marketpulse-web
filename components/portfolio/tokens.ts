import type { CSSProperties } from 'react'

// Same Graphite Obsidian tokens as the other redesigned tabs.
export const S = {
  surface: 'rgba(32, 31, 38, 0.65)',
  border: 'rgba(255,255,255,0.10)',
  borderTop: 'rgba(255,255,255,0.20)',
  divider: 'rgba(255,255,255,0.05)',
  primary: '#c6c0ff',
  bronze: '#CD7F32',
  positive: '#b0fbca',
  negative: '#ffb4ab',
  warning: '#fabc42',
  outline: '#928f9f',
  textPrimary: '#e5e1eb',
  textSecondary: '#c8c4d5',
  textMuted: '#928f9f',
  mono: 'JetBrains Mono, monospace',
  body: 'Inter, sans-serif',
}

export function glass(extra: CSSProperties = {}): CSSProperties {
  return {
    background: S.surface,
    backdropFilter: 'blur(32px)',
    WebkitBackdropFilter: 'blur(32px)',
    border: `1px solid ${S.border}`,
    borderTop: `1px solid ${S.borderTop}`,
    borderLeft: `1px solid ${S.borderTop}`,
    boxShadow: '0 40px 60px -15px rgba(0,0,0,0.5)',
    borderRadius: 16,
    ...extra,
  }
}

export const labelStyle: CSSProperties = {
  fontSize: 10,
  fontFamily: S.mono,
  color: S.textMuted,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
}

/** Fraction to percent text, e.g. 0.1234 -> "12.3%". NaN shows "n/a". */
export function fmtPct(x: number | null | undefined, digits = 1): string {
  if (x == null || !Number.isFinite(x)) return 'n/a'
  return `${(x * 100).toFixed(digits)}%`
}

export function fmtMoney(x: number): string {
  if (!Number.isFinite(x)) return 'n/a'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(x)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2024-10-07" -> "Oct 7, 2024" without time-zone shifts. */
export function fmtDate(iso: string | undefined): string {
  if (!iso) return 'n/a'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

export function pctColor(v: number | null | undefined): string {
  return v == null ? S.textMuted : v >= 0 ? S.positive : S.negative
}
