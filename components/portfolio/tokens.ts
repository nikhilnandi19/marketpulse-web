import type { CSSProperties } from 'react'

// Same Graphite Obsidian tokens as the other redesigned tabs.
export const S = {
  border: 'rgba(255,255,255,0.10)',
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

/**
 * Corner radii follow one rule, like SwiftUI's ConcentricRectangle: a shape sitting inside
 * another takes the outer radius minus the gap between them, never going below R.min.
 *   panel   - glass cards and sections
 *   control - inputs, buttons, notices, popovers, the frame of a segmented control
 *   min     - the smallest radius, used for items nested deep inside a panel
 */
export const R = { panel: 20, control: 12, min: 8, cell: 6 }
export const inset = (outer: number, gap: number) => Math.max(outer - gap, R.min)

/**
 * Glass panel, same texture as the Learn, Overview and Explorer tabs. The background and blur
 * read CSS variables so the page can swap to a solid surface for reduced transparency.
 */
export function glass(extra: CSSProperties = {}): CSSProperties {
  return {
    background: 'var(--pf-glass-bg, rgba(255,255,255,0.04))',
    backdropFilter: 'var(--pf-glass-blur, blur(24px))',
    WebkitBackdropFilter: 'var(--pf-glass-blur, blur(24px))',
    boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08), 0 22px 44px -28px rgba(4,8,9,0.95)',
    borderRadius: R.panel,
    ...extra,
  }
}

export const labelStyle: CSSProperties = {
  fontSize: 11,
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
