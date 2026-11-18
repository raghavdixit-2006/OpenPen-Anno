import type { Variants } from 'motion/react'
import { TAB_TUCK, type DockMorph } from './geometry'
import type { DockPosition } from '../../shared/ipc'

/**
 * All toolbar animation definitions live here, separate from the annotation
 * engine (`src/engine`) which stays free of React and animation concerns.
 *
 * Variant names match the two toolbar states: `expanded` (control bar) and
 * `collapsed` (tucked glass tab). AnimatePresence runs the exit while both
 * surfaces coexist, so the folds crossfade in place.
 */

/** Shared hover/press feedback for every toolbar button. */
export const TAP_SPRING = { type: 'spring', stiffness: 420, damping: 26 } as const

export const tapProps = {
  whileHover: { scale: 1.08 },
  whileTap: { scale: 0.9 },
  transition: TAP_SPRING
} as const

const INSTANT = { duration: 0 }

/**
 * Individual controls. On expand they stagger into view (orchestrated by the
 * surface variant's `staggerChildren`); on collapse they fade out together
 * before the shell folds.
 */
export const CONTROL_VARIANTS: Variants = {
  expanded: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 420, damping: 30 }
  },
  collapsed: {
    opacity: 0,
    y: 5,
    scale: 0.96,
    transition: { duration: 0.13, ease: 'easeOut' }
  }
}

/**
 * The control bar folds into the tucked tab's sliver footprint
 * (`geometry.ts`). Expansion is a spring; the collapse is a tween so the
 * window resize that follows `onExitComplete` happens at a predictable time.
 */
export function surfaceVariants(morph: DockMorph, reduceMotion: boolean): Variants {
  return {
    expanded: {
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      transition: reduceMotion
        ? INSTANT
        : {
            type: 'spring',
            stiffness: 230,
            damping: 24,
            mass: 0.9,
            opacity: { duration: 0.32, ease: 'easeOut' },
            delayChildren: 0.1,
            staggerChildren: 0.024
          }
    },
    collapsed: {
      x: morph.offsetX,
      y: morph.offsetY,
      scaleX: morph.scaleX,
      scaleY: morph.scaleY,
      opacity: 0,
      transition: reduceMotion
        ? INSTANT
        : {
            duration: 0.42,
            ease: [0.4, 0, 0.2, 1],
            opacity: { duration: 0.4, ease: 'easeIn' }
          }
    }
  }
}

/**
 * The collapsed glass tab fades in, tucked behind the screen edge, under the
 * folding bar and out beneath the growing one. `centre` carries the long-axis
 * centring as Motion x/y values ('-50%'), because Motion writes its own
 * transform and would clobber CSS translate classes; the anchor classes only
 * pin the docked edge. The tab's own tuck/pop states live in
 * `tabTuckVariants` so this wrapper never animates its position.
 */
export interface TabCentre {
  x?: string
  y?: string
}

export function tabVariants(centre: TabCentre, reduceMotion: boolean): Variants {
  const x = centre.x ?? 0
  const y = centre.y ?? 0
  return {
    visible: {
      opacity: 1,
      scale: 1,
      x,
      y,
      transition: reduceMotion ? INSTANT : { duration: 0.2, ease: 'easeOut', delay: 0.24 }
    },
    hidden: {
      opacity: 0,
      scale: 0.92,
      x,
      y,
      transition: reduceMotion ? INSTANT : { duration: 0.15, ease: 'easeIn' }
    }
  }
}

/**
 * The collapsed tab hides TAB_TUCK px behind the screen edge (only a
 * TAB_SLIVER stays visible as the hover target) and pops out flush with the
 * edge when hovered. The whole tab is the click target, so there is no
 * separate chevron island. Reduced motion keeps the tab fully visible and
 * still: no tuck, no pop.
 */
export function tabTuckVariants(dock: DockPosition, reduceMotion: boolean): Variants {
  const pop = { type: 'spring', stiffness: 300, damping: 22 } as const
  const tuck = reduceMotion ? 0 : TAB_TUCK
  const offset =
    dock === 'top'
      ? { x: 0, y: -tuck }
      : dock === 'left'
        ? { x: -tuck, y: 0 }
        : dock === 'right'
          ? { x: tuck, y: 0 }
          : { x: 0, y: tuck }
  return {
    tucked: { ...offset, transition: reduceMotion ? INSTANT : pop },
    popped: { x: 0, y: 0, transition: reduceMotion ? INSTANT : pop }
  }
}

/** The chevron spins into place on mount and nudges toward its action on hover. */
export function chevronSpin(
  direction: 'in' | 'out',
  reduceMotion: boolean
): {
  initial: false | { rotate: number; scale: number }
  animate: { rotate: number; scale: number }
  whileHover: { rotate: number }
  transition: { type: 'spring'; stiffness: number; damping: number }
} {
  const from = direction === 'in' ? -110 : 110
  return {
    initial: reduceMotion ? false : { rotate: from, scale: 0.5 },
    animate: { rotate: 0, scale: 1 },
    whileHover: { rotate: direction === 'in' ? -14 : 14 },
    transition: { type: 'spring', stiffness: 320, damping: 19 }
  } as const
}
