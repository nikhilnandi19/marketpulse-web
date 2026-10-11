'use client'

import { useEffect, useState } from 'react'

/** True on phone-sized screens. Starts false so server and first client render match. */
export function useNarrow(maxWidth = 720): boolean {
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${maxWidth}px)`)
    const update = () => setNarrow(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [maxWidth])
  return narrow
}
