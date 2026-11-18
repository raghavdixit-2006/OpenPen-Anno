import { getStroke } from 'perfect-freehand'
import type { Point, StrokeStyle } from './types'

/** Highlighter nibs are wider than the pen at the same UI size. */
export const HIGHLIGHTER_WIDTH_SCALE = 2.4

/** Visual diameter of a stroke, in CSS pixels. This is the widest it gets. */
export function brushWidth(style: StrokeStyle): number {
  return style.tool === 'highlighter' ? style.width * HIGHLIGHTER_WIDTH_SCALE : style.width
}

/**
 * The pen tapers with pressure and keeps rounded caps. The highlighter stays
 * nearly constant-width with flat ends, like a chisel marker.
 */
const PEN_OPTIONS = {
  thinning: 0.6,
  smoothing: 0.5,
  streamline: 0.45,
  start: { cap: true },
  end: { cap: true }
} as const

const HIGHLIGHTER_OPTIONS = {
  thinning: 0.05,
  smoothing: 0.35,
  streamline: 0.6,
  start: { cap: false },
  end: { cap: false }
} as const

/**
 * perfect-freehand's `size` is the diameter at pressure 0.5 and grows to
 * `size * (1 + thinning)` at full pressure. Dividing here keeps the slider
 * honest: `style.width` is the thickest the line can get, not its mid value.
 */
function outlineSize(style: StrokeStyle): number {
  const thinning =
    style.tool === 'highlighter' ? HIGHLIGHTER_OPTIONS.thinning : PEN_OPTIONS.thinning
  return brushWidth(style) / (1 + thinning)
}

/**
 * Builds the filled polygon that outlines a stroke. `perfect-freehand` smooths
 * the raw pointer samples and converts pressure into width, so the renderer
 * only has to fill the result.
 *
 * Pressure always comes from the points themselves: real stylus pressure, or
 * the synthetic velocity value from `VelocityPressure` for a mouse. The
 * library's own simulation is disabled because it barely reacts to speed.
 * `complete` is false while the stroke is still being drawn, which keeps the
 * tail from tapering on every frame.
 */
export function strokeOutline(
  points: readonly Point[],
  style: StrokeStyle,
  complete = true
): number[][] {
  if (points.length === 0) return []

  const input = points.map((point) => [point.x, point.y, point.pressure])
  const base = style.tool === 'highlighter' ? HIGHLIGHTER_OPTIONS : PEN_OPTIONS

  return getStroke(input, {
    ...base,
    size: outlineSize(style),
    simulatePressure: false,
    last: complete
  })
}
