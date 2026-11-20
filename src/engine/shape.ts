import type { Bounds, Point, Shape, ShapeStyle, ShapeTool } from './types'

export const SHAPE_TOOLS = ['line', 'arrow', 'rect', 'ellipse'] as const

export function isShapeTool(value: unknown): value is ShapeTool {
  return typeof value === 'string' && (SHAPE_TOOLS as readonly string[]).includes(value)
}

/** A drag shorter than this is treated as a click, not a shape. */
export const MIN_SHAPE_DRAG = 3

/** Arrow heads stay visible even at the thinnest brush size. */
const MIN_ARROW_HEAD = 8

let nextShapeId = 0

export function createShape(tool: ShapeTool, start: Point, end: Point, style: ShapeStyle): Shape {
  return {
    id: `shape-${++nextShapeId}`,
    kind: 'shape',
    tool,
    start: { ...start },
    end: { ...end },
    style: { ...style }
  }
}

/** A drag that moved far enough to be worth committing. */
export function isShapeDrag(start: Point, end: Point): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) >= MIN_SHAPE_DRAG
}

/**
 * Shift-drag constraint: lines and arrows snap to 45° increments, boxes become
 * squares and ellipses become circles. Screen-space only (no rotation).
 */
export function constrainShapeEnd(tool: ShapeTool, start: Point, end: Point): Point {
  const dx = end.x - start.x
  const dy = end.y - start.y

  if (tool === 'line' || tool === 'arrow') {
    const length = Math.hypot(dx, dy)
    if (length === 0) return { ...end }
    const step = Math.PI / 4
    const angle = Math.round(Math.atan2(dy, dx) / step) * step
    return {
      x: start.x + Math.cos(angle) * length,
      y: start.y + Math.sin(angle) * length,
      pressure: end.pressure
    }
  }

  const extent = Math.max(Math.abs(dx), Math.abs(dy))
  return {
    x: start.x + (dx < 0 ? -extent : extent),
    y: start.y + (dy < 0 ? -extent : extent),
    pressure: end.pressure
  }
}

export interface ShapeRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Normalized axis-aligned box, independent of drag direction. */
export function shapeRect(shape: Shape): ShapeRect {
  const x = Math.min(shape.start.x, shape.end.x)
  const y = Math.min(shape.start.y, shape.end.y)
  return {
    x,
    y,
    width: Math.abs(shape.end.x - shape.start.x),
    height: Math.abs(shape.end.y - shape.start.y)
  }
}

/** Length of the arrow head, in CSS pixels. */
export function arrowHeadLength(shape: Shape): number {
  return Math.max(MIN_ARROW_HEAD, shape.style.width * 3)
}

/** Tip plus the two swept-back wings; null for a zero-length arrow. */
export function arrowHeadPoints(shape: Shape): readonly [Point, Point, Point] | null {
  const dx = shape.end.x - shape.start.x
  const dy = shape.end.y - shape.start.y
  if (dx === 0 && dy === 0) return null

  const angle = Math.atan2(dy, dx)
  const head = arrowHeadLength(shape)
  const spread = Math.PI / 7
  const wing = (delta: number): Point => ({
    x: shape.end.x - Math.cos(angle + delta) * head,
    y: shape.end.y - Math.sin(angle + delta) * head,
    pressure: shape.end.pressure
  })

  return [shape.end, wing(-spread), wing(spread)]
}

function halfWidth(shape: Shape): number {
  return shape.style.width / 2
}

/** Bounds including the stroke width (and the arrow head for arrows). */
export function getShapeBounds(shape: Shape): Bounds {
  const rect = shapeRect(shape)
  let pad = halfWidth(shape) + 1
  if (shape.tool === 'arrow') pad += arrowHeadLength(shape)

  return {
    minX: rect.x - pad,
    minY: rect.y - pad,
    maxX: rect.x + rect.width + pad,
    maxY: rect.y + rect.height + pad
  }
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

function nearSegment(point: Point, start: Point, end: Point, tolerance: number): boolean {
  return distanceToSegmentSquared(point, start, end) <= tolerance * tolerance
}

const at = (x: number, y: number): Point => ({ x, y, pressure: 0.5 })

/** Distance from a point to the nearest sampled point on an ellipse outline. */
function nearEllipse(shape: Shape, point: Point, tolerance: number): boolean {
  const rect = shapeRect(shape)
  const rx = rect.width / 2
  const ry = rect.height / 2
  const cx = rect.x + rx
  const cy = rect.y + ry

  if (rx < 1 && ry < 1) return distanceSquared(point, at(cx, cy)) <= tolerance * tolerance
  if (rx < 1) return nearSegment(point, at(cx, rect.y), at(cx, rect.y + rect.height), tolerance)
  if (ry < 1) return nearSegment(point, at(rect.x, cy), at(rect.x + rect.width, cy), tolerance)

  const steps = 72
  let previous = at(cx + rx, cy)
  for (let i = 1; i <= steps; i++) {
    const angle = (i / steps) * Math.PI * 2
    const next = at(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry)
    if (nearSegment(point, previous, next, tolerance)) return true
    previous = next
  }
  return false
}

/**
 * Shape-level hit testing for the eraser. Only the drawn outline counts, not
 * the empty interior of a rectangle or ellipse.
 */
export function hitTestShape(shape: Shape, point: Point, radius: number): boolean {
  const bounds = getShapeBounds(shape)
  const reach = Math.max(0, radius)
  if (
    point.x < bounds.minX - reach ||
    point.x > bounds.maxX + reach ||
    point.y < bounds.minY - reach ||
    point.y > bounds.maxY + reach
  ) {
    return false
  }

  const tolerance = reach + halfWidth(shape)

  if (shape.tool === 'line' || shape.tool === 'arrow') {
    return nearSegment(point, shape.start, shape.end, tolerance)
  }

  const rect = shapeRect(shape)
  if (shape.tool === 'rect') {
    const topLeft = at(rect.x, rect.y)
    const topRight = at(rect.x + rect.width, rect.y)
    const bottomRight = at(rect.x + rect.width, rect.y + rect.height)
    const bottomLeft = at(rect.x, rect.y + rect.height)
    return (
      nearSegment(point, topLeft, topRight, tolerance) ||
      nearSegment(point, topRight, bottomRight, tolerance) ||
      nearSegment(point, bottomRight, bottomLeft, tolerance) ||
      nearSegment(point, bottomLeft, topLeft, tolerance)
    )
  }

  return nearEllipse(shape, point, tolerance)
}

/**
 * Paints one shape onto a 2D context. Colors and alpha come from the item, so
 * a redrawn history looks exactly like the original commit.
 */
export function paintShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
  const { style } = shape
  const rect = shapeRect(shape)

  ctx.save()
  ctx.globalAlpha = style.opacity
  ctx.strokeStyle = style.color
  ctx.fillStyle = style.color
  ctx.lineWidth = Math.max(0.5, style.width)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  ctx.beginPath()
  switch (shape.tool) {
    case 'line':
      ctx.moveTo(shape.start.x, shape.start.y)
      ctx.lineTo(shape.end.x, shape.end.y)
      ctx.stroke()
      break
    case 'arrow': {
      ctx.moveTo(shape.start.x, shape.start.y)
      ctx.lineTo(shape.end.x, shape.end.y)
      ctx.stroke()

      const head = arrowHeadPoints(shape)
      if (head) {
        ctx.beginPath()
        ctx.moveTo(head[0].x, head[0].y)
        ctx.lineTo(head[1].x, head[1].y)
        ctx.lineTo(head[2].x, head[2].y)
        ctx.closePath()
        ctx.fill()
      }
      break
    }
    case 'rect':
      if (rect.width > 0 || rect.height > 0) {
        ctx.rect(rect.x, rect.y, rect.width, rect.height)
        ctx.stroke()
      }
      break
    case 'ellipse':
      if (shape.start.x !== shape.end.x || shape.start.y !== shape.end.y) {
        ctx.ellipse(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
          Math.max(0.5, rect.width / 2),
          Math.max(0.5, rect.height / 2),
          0,
          0,
          Math.PI * 2
        )
        ctx.stroke()
      }
      break
  }

  ctx.restore()
}
