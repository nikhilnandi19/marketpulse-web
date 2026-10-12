'use client'

import { LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { useId } from 'react'
import { R, S, inset } from './tokens'

/**
 * Segmented control with a pill that slides between options.
 *
 * Motion recipe (kept here so the landing page can reuse it):
 *  - The pill is one shared element (Motion `layoutId`), so it slides and resizes between
 *    options of different widths using transforms only, never animating width or left.
 *  - Spring with bounce 0 (critically damped, no overshoot) and a 0.3s perceptual duration.
 *    Springs keep their velocity when interrupted, so tapping a second option mid-slide
 *    redirects the pill smoothly instead of snapping.
 *  - Label colour fades in 200ms on the strong ease-out curve while the pill passes.
 *  - Press: scale(0.97) over 160ms. Hover is gated to real pointers, so touch never sticks.
 *  - Reduced motion: the pill jumps, the colour fade stays, nothing scales.
 */
export const SEG_SPRING = { type: 'spring', duration: 0.3, bounce: 0 } as const

export const SEG_CSS = `
.pf-seg-btn{color:${S.textMuted};transition:color .2s cubic-bezier(.23,1,.32,1),transform .16s cubic-bezier(.23,1,.32,1)}
.pf-seg-btn[aria-pressed="true"]{color:${S.primary}}
.pf-seg-btn:active{transform:scale(.97)}
@media (hover:hover) and (pointer:fine){.pf-seg-btn[aria-pressed="false"]:hover{color:${S.textPrimary}}}
.pf-seg-btn:focus-visible{outline:2px solid ${S.primary};outline-offset:2px}
@media (prefers-reduced-motion:reduce){.pf-seg-btn{transition:color .2s ease}.pf-seg-btn:active{transform:none}}
`

interface Props<T extends string | number> {
  ariaLabel: string
  value: T
  options: { value: T; text: string }[]
  onChange: (v: T) => void
  minWidth?: number
  padX?: number
}

export default function SegmentedControl<T extends string | number>({ ariaLabel, value, options, onChange, minWidth = 44, padX = 12 }: Props<T>) {
  const group = useId()
  const reduce = useReducedMotion()
  const innerR = inset(R.control, 3)
  return (
    <LayoutGroup id={group}>
      <div role="group" aria-label={ariaLabel} style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.05)', borderRadius: R.control, padding: 3 }}>
        {options.map(o => {
          const on = o.value === value
          return (
            <button
              key={String(o.value)}
              type="button"
              className="pf-tap pf-seg-btn"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              style={{ position: 'relative', minHeight: 32, minWidth, padding: `0 ${padX}px`, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: S.mono, fontSize: 12, fontWeight: 600, borderRadius: innerR }}
            >
              {on && (
                <motion.span
                  layoutId="pill"
                  aria-hidden
                  transition={reduce ? { duration: 0 } : SEG_SPRING}
                  style={{ position: 'absolute', inset: 0, zIndex: 0, background: `${S.primary}26`, borderRadius: innerR }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{o.text}</span>
            </button>
          )
        })}
      </div>
    </LayoutGroup>
  )
}
