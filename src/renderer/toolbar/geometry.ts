import type { DockPosition } from '../../shared/ipc'

/**
 * Toolbar geometry for the collapse morph. The window itself is owned by the
 * main process (`src/main/toolbarWindow.ts`); these values mirror it so the
 * renderer can fold the visible bar into the exact spot the collapsed glassy
 * handle occupies. Keep both files in sync.
 */
export const EXPANDED_WINDOW = {
  horizontal: { width: 920, height: 80 },
  // Wide enough to keep a shadow margin around the 88px bar surface (8px
  // inset each side).
  vertical: { width: 104, height: 680 }
} as const

/** Uniform collapsed window: the 56px glassy circle centred in a 64px box. */
export const COLLAPSED_WINDOW = { width: 64, height: 64 } as const

/** Padding between the window edge and the visible bar surface (`p-2`). */
const EXPANDED_INSET = 8

/** The glassy circle handle is the fold target. */
const CIRCLE = 56

/** Gap between the circle and the screen edge (its window inset). */
const CIRCLE_INSET = 4

export interface DockMorph {
  /** Scale applied to the bar so it matches the collapsed circle. */
  scaleX: number
  scaleY: number
  /** Transform origin, in percentages of the bar's own box. */
  originX: number
  originY: number
  /** Final nudge in px, so the folded bar lands on the circle's footprint. */
  offsetX: number
  offsetY: number
}

/**
 * The bar folds into the circle's exact footprint. Both window shapes are
 * flush to their work-area edge (margin 0 in `toolbarWindow.ts`) and centred
 * on the long axis, so the circle's anchored spot is the same screen position
 * in both window sizes and the hand-off at the resize never jumps. The circle
 * box sits `CIRCLE_INSET` from the edge while the bar surface sits
 * `EXPANDED_INSET` inside its window, so the fold also slides the bar that
 * remaining inset toward the docked edge (the origin stays on that edge).
 */
export function dockMorph(dock: DockPosition): DockMorph {
  const insetSlide = EXPANDED_INSET - CIRCLE_INSET

  if (dock === 'left' || dock === 'right') {
    const barWidth = EXPANDED_WINDOW.vertical.width - EXPANDED_INSET * 2
    const barHeight = EXPANDED_WINDOW.vertical.height - EXPANDED_INSET * 2
    return {
      scaleX: CIRCLE / barWidth,
      scaleY: CIRCLE / barHeight,
      originX: dock === 'left' ? 0 : 100,
      originY: 50,
      offsetX: dock === 'left' ? -insetSlide : insetSlide,
      offsetY: 0
    }
  }

  const barWidth = EXPANDED_WINDOW.horizontal.width - EXPANDED_INSET * 2
  const barHeight = EXPANDED_WINDOW.horizontal.height - EXPANDED_INSET * 2
  return {
    scaleX: CIRCLE / barWidth,
    scaleY: CIRCLE / barHeight,
    originX: 50,
    originY: dock === 'top' ? 0 : 100,
    offsetX: 0,
    offsetY: dock === 'top' ? -insetSlide : insetSlide
  }
}
