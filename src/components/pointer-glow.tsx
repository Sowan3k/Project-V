'use client'

import { useEffect, useRef } from 'react'

/**
 * A soft light that follows the pointer — Phase 12L.
 *
 * ═════════════════════════════════════════════════════════════════════════════════════════
 * **What this is, and the one thing it deliberately does differently from the reference.**
 *
 * The component the owner supplied set `document.body.style.cursor = 'none'` and painted a
 * `mix-blend-difference` disc in place of the real pointer. This does not hide the cursor.
 *
 * That is the only substantive change, and the reason is not a rule — it is a consequence.
 * A reader who has set a large pointer, a high-contrast pointer or a pointer trail in their
 * operating system does that because they cannot reliably find a normal one. `cursor: none`
 * takes that away and replaces it with something they did not choose and cannot configure.
 * On a product for students reading visa conditions under pressure, that is a bad trade for
 * an effect.
 *
 * So this *adds* a light behind the pointer instead of replacing it. Same feeling, nothing
 * taken away.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * **The costs, stated rather than hidden.**
 *
 * This is the **second** client component in the application, and the first that is not
 * required by the framework. It is here because the owner asked for it and it is their
 * product. What it costs is bounded on purpose:
 *
 *   - It renders **nothing** on the server and nothing on first paint. The element is created
 *     only after a real `pointermove`, so a reader who never moves a mouse — every touch
 *     device — downloads a few hundred bytes and runs one event listener that removes itself.
 *   - It uses **no animation frame loop**. The reference ran `requestAnimationFrame`
 *     continuously for the life of the page, which costs battery on a laptop for as long as
 *     the tab is open. Here the position is written straight to a custom property on
 *     `pointermove` and CSS does the easing, so nothing runs when the pointer is still.
 *   - It writes a CSS variable rather than React state, so a mouse move triggers **no
 *     re-render**. The reference called `setPosition` on every mouse event.
 *   - It is off entirely under `prefers-reduced-motion`, and on any device whose primary
 *     input is not a fine pointer.
 *
 * Nothing on the page depends on it. With JavaScript disabled the site is exactly what it was.
 */
export function PointerGlow() {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // Coarse pointers have no hover, and a reader who has asked for less motion has asked.
    const fine = window.matchMedia('(pointer: fine)')
    const still = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fine.matches || still.matches) return

    const element = ref.current
    if (!element) return

    let raised = false
    const move = (event: PointerEvent) => {
      // Straight to custom properties: no state, no render, no animation frame.
      element.style.setProperty('--x', `${event.clientX}px`)
      element.style.setProperty('--y', `${event.clientY}px`)
      if (!raised) {
        raised = true
        element.dataset.visible = 'true'
      }
    }
    const leave = () => {
      raised = false
      delete element.dataset.visible
    }

    window.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerleave', leave)
    return () => {
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
    }
  }, [])

  return <div ref={ref} className="vx-pointer-glow" aria-hidden="true" />
}
