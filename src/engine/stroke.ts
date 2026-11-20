import { brushWidth } from './outline'
import type { Bounds, Point, Stroke, StrokeStyle } from './types'

export const PEN_STYLE: StrokeStyle = {
  tool: 'pen',
  color: '#ff2d2d',
  width: 4,
  opacity: 1
}

let nextStrokeId = 0

/**
 * Creates a frozen-in-practice stroke. Points and style are copied so later
 * mutations of the caller's arrays cannot reach the history.
 */
export function createStroke(points: readonly Point[], style: StrokeStyle = PEN_STYLE): Stroke {
  return {
    id: `stroke-${++nextStrokeId}`,
    kind: 'freehand',
    points: points.map((point) => ({ ...point })),
    style: { ...style }
  }
}

/** Immutable append, handy for callers that model in-progress strokes as values. */
export function appendPoint(stroke: Stroke, point: Point): Stroke {
  return { ...stroke, points: [...stroke.points, { ...point }] }
}

/** Bounds including half the brush width, or null for a stroke without points. */
export function getStrokeBounds(stroke: Stroke): Bounds | null {
  if (stroke.points.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of stroke.points) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }

  const pad = brushWidth(stroke.style) / 2
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad }
}

/** Points closer than this are redundant for rendering and erasing. */
export function isDistinctPoint(previous: Point | undefined, next: Point, epsilon = 0.01): boolean {
  if (!previous) return true
  return Math.abs(previous.x - next.x) > epsilon || Math.abs(previous.y - next.y) > epsilon
}

function distanceSquared(a: Point, b: Point): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function distanceToSegmentSquared(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return distanceSquared(point, start)

  const projection = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared
  const t = Math.max(0, Math.min(1, projection))
  const closestX = start.x + t * dx
  const closestY = start.y + t * dy
  const offsetX = point.x - closestX
  const offsetY = point.y - closestY
  return offsetX * offsetX + offsetY * offsetY
}

/**
 * Stroke-level erasing: true when the eraser circle touches any segment of the
 * stroke (headless-friendly, no pixels involved).
 */
export function hitTestStroke(stroke: Stroke, point: Point, radius: number): boolean {
  const bounds = getStrokeBounds(stroke)
  if (!bounds) return false
  if (
    point.x < bounds.minX - radius ||
    point.x > bounds.maxX + radius ||
    point.y < bounds.minY - radius ||
    point.y > bounds.maxY + radius
  ) {
    return false
  }

  const tolerance = Math.max(0, radius) + brushWidth(stroke.style) / 2
  const toleranceSquared = tolerance * tolerance
  const points = stroke.points

  if (points.length === 1) {
    return distanceSquared(point, points[0]) <= toleranceSquared
  }

  for (let i = 1; i < points.length; i++) {
    if (distanceToSegmentSquared(point, points[i - 1], points[i]) <= toleranceSquared) {
      return true
    }
  }

  return false
}
