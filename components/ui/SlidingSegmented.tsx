'use client'

import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useId, type CSSProperties, type ReactNode } from 'react'

/**
 * Segmented control whose selected pill slides between options.
 * Same motion recipe as components/portfolio/SegmentedControl.tsx:
 *  - one shared pill (Motion `layoutId`): transforms only, resizes between unequal options
 *  - spring with bounce 0 (no overshoot), 0.3s, interruptible mid-flight
 *  - label colour fades via CSS (.sl-seg-btn in globals.css); press scales to 0.97
 *  - reduced motion: the pill jumps, the colour fade stays
 * If `value` matches no option, no pill is drawn (e.g. a slider sitting between presets).
 */
const SPRING = { type: 'spring', duration: 0.3, bounce: 0 } as const

export interface SegOption<T> {
  value: T
  label: ReactNode
  /** Text colour when selected (defaults to the control's `on`). */
  on?: string
  /** Pill fill when selected (defaults to the control's `pill`). */
  pill?: string
}

interface Props<T extends string | number> {
  ariaLabel: string
  value: T
  options: SegOption<T>[]
  onChange: (v: T) => void
  fontFamily?: string
  fontSize?: number
  minHeight?: number
  padX?: number
  on?: string
  off?: string
  hover?: string
  pill?: string
  frame?: string
  frameRadius?: number
}

export default function SlidingSegmented<T extends string | number>({
  ariaLabel, value, options, onChange,
  fontFamily, fontSize = 12, minHeight = 26, padX = 10,
  on = '#adc6ff', off = '#8c909f', hover = '#e2e2e2',
  pill = 'rgba(173,198,255,0.15)', frame = 'rgba(255,255,255,0.05)', frameRadius = 12,
}: Props<T>) {
  const group = useId()
  const reduce = useReducedMotion()
  const innerRadius = Math.max(frameRadius - 3, 8)
  return (
    <LayoutGroup id={group}>
      <div role="group" aria-label={ariaLabel} style={{ display: 'inline-flex', background: frame, borderRadius: frameRadius, padding: 3 }}>
        {options.map(o => {
          const selected = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              className="sl-seg-btn"
              aria-pressed={selected}
              onClick={() => onChange(o.value)}
              style={{
                '--seg-on': o.on ?? on, '--seg-off': off, '--seg-hover': hover, '--seg-focus': on,
                position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6, minHeight, padding: `0 ${padX}px`,
                border: 'none', background: 'transparent', cursor: 'pointer', fontFamily, fontSize, fontWeight: 500, borderRadius: innerRadius,
              } as CSSProperties}
            >
              {selected && (
                <motion.span
                  layoutId="pill"
                  aria-hidden
                  transition={reduce ? { duration: 0 } : SPRING}
                  style={{ position: 'absolute', inset: 0, zIndex: 0, background: o.pill ?? pill, borderRadius: innerRadius }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{o.label}</span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
