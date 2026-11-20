import type { Bounds, Point, StampItem, StampStyle } from './types'

/** Default badge radius in CSS pixels. */
export const STAMP_RADIUS = 16
export const STAMP_MIN_RADIUS = 12
export const STAMP_MAX_RADIUS = 48

/** Brush-size slider value to badge radius; the number stays legible. */
export function stampRadius(size: number): number {
  return Math.min(STAMP_MAX_RADIUS, Math.max(STAMP_MIN_RADIUS, Math.round(size * 3)))
}

let nextStampId = 0

export function createStamp(
  index: number,
  x: number,
  y: number,
  style: StampStyle,
  radius: number = STAMP_RADIUS
): StampItem {
  return {
    id: `stamp-${++nextStampId}`,
    kind: 'stamp',
    index: Math.max(1, Math.round(index)),
    x,
    y,
    radius: Math.max(STAMP_MIN_RADIUS / 2, radius),
    style: { ...style }
  }
}

/** Badge circle plus its ring; good enough for eraser hit tests and repaints. */
export function getStampBounds(stamp: StampItem): Bounds {
  const extent = stamp.radius + 2
  return {
    minX: stamp.x - extent,
    minY: stamp.y - extent,
    maxX: stamp.x + extent,
    maxY: stamp.y + extent
  }
}

/** Whole-badge hit test: touching anywhere on the circle erases it. */
export function hitTestStamp(stamp: StampItem, point: Point, radius: number): boolean {
  const reach = stamp.radius + Math.max(0, radius)
  const dx = point.x - stamp.x
  const dy = point.y - stamp.y
  return dx * dx + dy * dy <= reach * reach
}

/**
 * White text on light swatches is unreadable, so the numeral flips to near
 * black for bright backgrounds. Palette colours are always `#rrggbb`.
 */
export function stampTextColor(background: string): string {
  const hex = background.replace('#', '')
  if (hex.length !== 6) return '#ffffff'

  const r = Number.parseInt(hex.slice(0, 2), 16)
  const g = Number.parseInt(hex.slice(2, 4), 16)
  const b = Number.parseInt(hex.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#ffffff'

  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? '#18181b' : '#ffffff'
}

/** Filled numbered badge with a white ring, centred on its numeral. */
export function paintStamp(ctx: CanvasRenderingContext2D, stamp: StampItem): void {
  const { x, y, radius, style } = stamp

  ctx.save()
  ctx.globalAlpha = style.opacity

  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = style.color
  ctx.fill()

  ctx.lineWidth = Math.max(2, radius * 0.14)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)'
  ctx.stroke()

  ctx.fillStyle = stampTextColor(style.color)
  ctx.font = `700 ${Math.round(radius * 1.15)}px "Segoe UI", system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(stamp.index), x, y + radius * 0.04)

  ctx.restore()
}
