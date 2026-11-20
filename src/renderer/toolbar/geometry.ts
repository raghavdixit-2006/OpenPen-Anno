import type { DockPosition } from '../../shared/ipc'

/**
 * Toolbar geometry for the collapse morph. The window itself is owned by the
 * main process (`src/main/toolbarWindow.ts`); these values mirror it so the
 * renderer can fold the visible bar into the exact spot the collapsed tab's
 * visible sliver occupies. Keep both files in sync.
 *
 * The cross-axis headroom is transparent window space for the dock
 * magnification and label pills. The visible bar surface stays exactly the
 * same size; only the window around it grew on the inward-facing side.
 */
export const EXPANDED_WINDOW = {
  horizontal: { width: 800, height: 124 },
  // A 56px single-column rail plus 144px of inward transparent headroom for
  // popped-out tiles and label pills.
  vertical: { width: 208, height: 680 }
} as const

/** Padding between the window edge and the visible bar surface (`p-2`). */
export const EXPANDED_INSET = 8

/**
 * Visible rail surface. Horizontal docks keep the 784×44 bar; side docks are an
 * ultra-thin 56×664 strip. The rest of the vertical window is inward-facing
 * headroom.
 */
export const BAR_SIZE = {
  horizontal: {
    width: EXPANDED_WINDOW.horizontal.width - EXPANDED_INSET * 2,
    height: 44
  },
  vertical: {
    width: 56,
    height: EXPANDED_WINDOW.vertical.height - EXPANDED_INSET * 2
  }
} as const

const TILE_SIZE = 32
const TILE_GAP = 6

/**
 * Tool tiles inside the tools group: one 32px row in horizontal docks and one
 * 32px column in side docks. The group has `p-1` and `gap-1.5`; keep these in
 * sync with App.tsx and DockTile.tsx.
 */
export const TOOL_TILE = {
  size: TILE_SIZE,
  gap: TILE_GAP,
  padding: 4,
  step: TILE_SIZE + TILE_GAP
} as const

/** Centre of a tool tile in the tools-group's local coordinates. */
export function tileCentre(index: number, vertical: boolean): { x: number; y: number } {
  const offset = TOOL_TILE.padding + TOOL_TILE.size / 2
  return vertical
    ? { x: offset, y: offset + index * TOOL_TILE.step }
    : { x: offset + index * TOOL_TILE.step, y: offset }
}

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
  if (dock === 'left' || dock === 'right') {
    return {
      scaleX: TAB_SLIVER / BAR_SIZE.vertical.width,
      scaleY: TAB_SIZE / BAR_SIZE.vertical.height,
      originX: dock === 'left' ? 0 : 100,
      originY: 50,
      offsetX: dock === 'left' ? -EXPANDED_INSET : EXPANDED_INSET,
      offsetY: 0
    }
  }

  return {
    scaleX: TAB_SIZE / BAR_SIZE.horizontal.width,
    scaleY: TAB_SLIVER / BAR_SIZE.horizontal.height,
    originX: 50,
    originY: dock === 'top' ? 0 : 100,
    offsetX: 0,
    offsetY: dock === 'top' ? -EXPANDED_INSET : EXPANDED_INSET
  }
}
