import type { Bounds, EraserStroke, Point } from './types'

let nextEraserId = 0

export function createEraserStroke(points: readonly Point[], radius: number): EraserStroke {
  return {
    id: `eraser-${++nextEraserId}`,
    kind: 'eraser',
    points: points.map((point) => ({ ...point })),
    radius: Math.max(1, radius)
  }
}

/** Bounds of everything the swipe touched, including the round cap. */
export function getEraserBounds(eraser: EraserStroke): Bounds | null {
  if (eraser.points.length === 0) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (const point of eraser.points) {
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }

  const radius = Math.max(1, eraser.radius)
  return {
    minX: minX - radius,
    minY: minY - radius,
    maxX: maxX + radius,
    maxY: maxY + radius
  }
}

/**
 * Clears pixels along a path. `destination-out` ignores the paint colour and
 * scales the destination alpha by (1 - source alpha), so opaque black simply
 * removes ink. The composite op is scoped to the save/restore.
 */
export function paintEraserPath(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  radius: number
): void {
  if (points.length === 0) return

  const r = Math.max(1, radius)
  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  ctx.strokeStyle = '#000'
  ctx.lineWidth = r * 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, r, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.stroke()
  }

  ctx.restore()
}

export function paintEraserStroke(ctx: CanvasRenderingContext2D, eraser: EraserStroke): void {
  paintEraserPath(ctx, eraser.points, eraser.radius)
}
