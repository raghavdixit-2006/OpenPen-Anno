import type { DockPosition } from '../../shared/ipc'

/**
 * Toolbar geometry for the collapse morph. The window itself is owned by the
 * main process (`src/main/toolbarWindow.ts`); these values mirror it so the
 * renderer can fold the visible bar into the exact spot the collapsed tab's
 * visible sliver occupies. Keep both files in sync.
 */
export const EXPANDED_WINDOW = {
  horizontal: { width: 800, height: 60 },
  // Wide enough to keep a shadow margin around the 88px bar surface (8px
  // inset each side).
  vertical: { width: 104, height: 416 }
} as const

/**
 * Uniform collapsed window: the 48px tab (plus shadow room) centred in a
 * 64px box. The tab tucks behind the screen edge, leaving only its sliver
 * visible; hovering pops it flush.
 */
export const COLLAPSED_WINDOW = { width: 64, height: 64 } as const

/** The collapsed glass tab: a rounded square that tucks behind the edge. */
export const TAB_SIZE = 48

/** How much of the tab stays visible while tucked (the hover target). */
export const TAB_SLIVER = 12

/** Distance the tab slides behind the screen edge: flush minus sliver. */
export const TAB_TUCK = TAB_SIZE - TAB_SLIVER

/** Padding between the window edge and the visible bar surface (`p-2`). */
const EXPANDED_INSET = 8

export interface DockMorph {
  /** Scale applied to the bar so it matches the tucked tab's sliver. */
  scaleX: number
  scaleY: number
  /** Transform origin, in percentages of the bar's own box. */
  originX: number
  originY: number
  /** Final nudge in px, so the folded bar lands on the sliver's footprint. */
  offsetX: number
  offsetY: number
}

/**
 * The bar folds into the tucked tab's visible sliver (TAB_SIZE long axis,
 * TAB_SLIVER thick, flush to the screen edge), so the hand-off is pixel-exact
 * in both window shapes: the sliver sits at the same screen spot whether the
 * window is collapsed or expanded (both flush to the edge, centred on the
 * long axis). The bar surface sits EXPANDED_INSET inside its window while the
 * sliver is flush, so the fold also slides the bar the full inset toward the
 * docked edge (the origin stays on that edge).
 */
export function dockMorph(dock: DockPosition): DockMorph {
  const insetSlide = EXPANDED_INSET

  if (dock === 'left' || dock === 'right') {
    const barWidth = EXPANDED_WINDOW.vertical.width - EXPANDED_INSET * 2
    const barHeight = EXPANDED_WINDOW.vertical.height - EXPANDED_INSET * 2
    return {
      scaleX: TAB_SLIVER / barWidth,
      scaleY: TAB_SIZE / barHeight,
      originX: dock === 'left' ? 0 : 100,
      originY: 50,
      offsetX: dock === 'left' ? -insetSlide : insetSlide,
      offsetY: 0
    }
  }

  const barWidth = EXPANDED_WINDOW.horizontal.width - EXPANDED_INSET * 2
  const barHeight = EXPANDED_WINDOW.horizontal.height - EXPANDED_INSET * 2
  return {
    scaleX: TAB_SIZE / barWidth,
    scaleY: TAB_SLIVER / barHeight,
    originX: 50,
    originY: dock === 'top' ? 0 : 100,
    offsetX: 0,
    offsetY: dock === 'top' ? -insetSlide : insetSlide
  }
}
