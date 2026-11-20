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

/** Pointer-follow spring for the dock-style proximity magnification. */
export const MAGNIFY_SPRING = { stiffness: 420, damping: 30, mass: 0.5 } as const

/** Tool tiles get press feedback only; their hover scale is the dock bell. */
export const tileTapProps = {
  whileTap: { scale: 0.94 },
  transition: TAP_SPRING
} as const

const MAGNIFY_SPAN_STEPS = 3
const MAGNIFY_SCALE = 0.18
const MAGNIFY_POP = 8

/** Smooth 1 → 0 falloff over three tile centres. */
function magnificationInfluence(distance: number, step: number): number {
  return Math.max(0, 1 - distance / (step * MAGNIFY_SPAN_STEPS))
}

/**
 * 1.18x at the pointer, ~1.08x next door, ~1.02x two tiles away, and 1x beyond.
 * The gentler bell keeps magnified neighbours clear of each other inside the
 * 6px tile gap. Motion values feed this per tile, so pointer movement never
 * re-renders React.
 */
export function magnificationScale(distance: number, step: number): number {
  const influence = magnificationInfluence(distance, step)
  return 1 + MAGNIFY_SCALE * influence * influence
}

/** Cross-axis lift away from the docked edge: 8px at the pointer, fading out. */
export function magnificationPop(distance: number, step: number): number {
  return MAGNIFY_POP * Math.pow(magnificationInfluence(distance, step), 0.75)
}

/**
 * Distance from the tile's rest edge to the pill's near edge: half the hovered
 * growth, plus the pop-out, plus an 8px gap. Reduced motion pins the tile at
 * rest, so only the gap remains.
 */
export function labelPillOffset(tileSize: number, reduceMotion: boolean): number {
  return reduceMotion ? 8 : (tileSize * MAGNIFY_SCALE) / 2 + MAGNIFY_POP + 8
}

/**
 * Floating tool label. CSS positions it on the inward side of the tile; this
 * only animates it in/out. Reduced motion keeps the fade and still shows the
 * static pill on hover.
 */
export function labelPillVariants(dock: DockPosition, reduceMotion: boolean): Variants {
  const towardTile =
    dock === 'bottom'
      ? { y: 4 }
      : dock === 'top'
        ? { y: -4 }
        : dock === 'left'
          ? { x: -4 }
          : { x: 4 }

  return {
    initial: reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, ...towardTile },
    animate: {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      transition: reduceMotion
        ? { duration: 0.1, ease: 'easeOut' }
        : { type: 'spring', stiffness: 520, damping: 30 }
    },
    exit: reduceMotion
      ? { opacity: 0, transition: { duration: 0.1, ease: 'easeIn' } }
      : {
          opacity: 0,
          scale: 0.92,
          ...towardTile,
          transition: { duration: 0.12, ease: 'easeIn' }
        }
  }
}

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
