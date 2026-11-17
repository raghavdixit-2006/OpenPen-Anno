import { getStrokeBounds } from './stroke'
import type { Bounds, Point, Stroke, StrokeStyle } from './types'

function tracePoints(ctx: CanvasRenderingContext2D, points: readonly Point[]): void {
  if (points.length === 0) return

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)

  if (points.length === 1) {
    // A tap still needs a segment so the round line cap paints a dot.
    ctx.lineTo(points[0].x + 0.01, points[0].y)
    return
  }

  // Quadratic through the midpoints keeps the freehand line from looking
  // like a chain of segments without any smoothing library.
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2
    const midY = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY)
  }

  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
}

export function paintPoints(
  ctx: CanvasRenderingContext2D,
  points: readonly Point[],
  style: StrokeStyle
): void {
  if (points.length === 0) return

  ctx.save()
  ctx.globalAlpha = style.opacity
  ctx.strokeStyle = style.color
  ctx.lineWidth = style.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  tracePoints(ctx, points)
  ctx.stroke()
  ctx.restore()
}

function clearCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
  ctx.save()
  // Clear in device pixels so a DPI transform cannot leave an un-cleared edge.
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.restore()
}

/** Bounding box of a slice of points, without any brush padding. */
function pointsBounds(points: readonly Point[], from: number): Bounds | null {
  if (from >= points.length) return null

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity

  for (let i = from; i < points.length; i++) {
    const point = points[i]
    if (point.x < minX) minX = point.x
    if (point.y < minY) minY = point.y
    if (point.x > maxX) maxX = point.x
    if (point.y > maxY) maxY = point.y
  }

  return { minX, minY, maxX, maxY }
}

function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    minX: bounds.minX - padding,
    minY: bounds.minY - padding,
    maxX: bounds.maxX + padding,
    maxY: bounds.maxY + padding
  }
}

function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b
  if (!b) return a
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  }
}

function intersects(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY
}

interface PixelRect {
  readonly x: number
  readonly y: number
  readonly w: number
  readonly h: number
}

/**
 * Owns the two stacked canvases: the committed layer (finished strokes) and the
 * live layer (the stroke currently under the pointer).
 *
 * Everything here repaints as little as possible. A transparent full-screen
 * window is already expensive to composite on Windows, so repaints are limited
 * to the damage each frame. Damage is always expressed as one integer
 * device-pixel rectangle that is cleared *and* used as the clip, so a repaint
 * can never shave a half-pixel band off ink that sits outside the region.
 */
export class OverlayRenderer {
  private readonly committedCtx: CanvasRenderingContext2D
  private readonly liveCtx: CanvasRenderingContext2D
  private width = 1
  private height = 1
  private dpr = 1

  /** Number of live-stroke points already painted by the previous frame. */
  private paintedCount = 0
  /**
   * Region of the previous frame's provisional tip. The tip is redrawn from
   * scratch every frame, so the old one has to be erased first.
   */
  private lastTipDirty: Bounds | null = null
  /** Union of every region painted on the live layer, for the final clear. */
  private liveExtent: Bounds | null = null
  /** Bounds of the eraser ring currently painted on the live layer. */
  private cursorBounds: Bounds | null = null

  constructor(
    private readonly committedCanvas: HTMLCanvasElement,
    private readonly liveCanvas: HTMLCanvasElement
  ) {
    const committedCtx = committedCanvas.getContext('2d')
    const liveCtx = liveCanvas.getContext('2d')
    if (!committedCtx || !liveCtx) throw new Error('2D canvas is not available')
    this.committedCtx = committedCtx
    this.liveCtx = liveCtx
  }

  /** Sizes both backing stores for the current CSS size and display DPI. */
  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.width = Math.max(1, cssWidth)
    this.height = Math.max(1, cssHeight)
    this.dpr = dpr > 0 ? dpr : 1

    for (const [canvas, ctx] of [
      [this.committedCanvas, this.committedCtx],
      [this.liveCanvas, this.liveCtx]
    ] as const) {
      canvas.width = Math.round(this.width * this.dpr)
      canvas.height = Math.round(this.height * this.dpr)
      canvas.style.width = `${this.width}px`
      canvas.style.height = `${this.height}px`
      // Draw in CSS pixels; the backing store is scaled for the display DPI.
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    }

    this.resetLiveState()
    this.cursorBounds = null
  }

  /** Full repaint of the committed layer. Used for undo/redo/clear/erase. */
  renderStrokes(strokes: readonly Stroke[]): void {
    clearCanvas(this.committedCtx, this.committedCanvas)
    for (const stroke of strokes) {
      paintPoints(this.committedCtx, stroke.points, stroke.style)
    }
  }

  /** Adds one finished stroke without touching the rest of the layer. */
  paintStroke(stroke: Stroke): void {
    paintPoints(this.committedCtx, stroke.points, stroke.style)
  }

  /**
   * Repaints only `region` of the committed layer. Used by the eraser so it can
   * remove strokes without clearing the whole screen.
   */
  repaintCommittedRegion(strokes: readonly Stroke[], region: Bounds): void {
    this.repaintRegion(this.committedCtx, region, () => {
      for (const stroke of strokes) {
        const bounds = getStrokeBounds(stroke)
        if (bounds && intersects(bounds, region)) {
          paintPoints(this.committedCtx, stroke.points, stroke.style)
        }
      }
    })
  }

  /** Starts a new live stroke; the live layer is cleared once per stroke. */
  beginLiveStroke(): void {
    clearCanvas(this.liveCtx, this.liveCanvas)
    this.resetLiveState()
    this.cursorBounds = null
  }

  renderLive(points: readonly Point[], style: StrokeStyle): void {
    if (points.length === 0) {
      this.clearLive()
      return
    }

    // A single pointermove can carry many coalesced samples, so repaint
    // everything appended since the last frame, not a fixed number of points.
    const padding = style.width / 2 + 4
    const from = this.paintedCount === 0 ? 0 : Math.max(0, this.paintedCount - 2)
    const added = pointsBounds(points, from)
    if (!added) return

    const dirty =
      unionBounds(padBounds(added, padding), this.lastTipDirty) ?? padBounds(added, padding)

    this.paintedCount = points.length
    const tip = pointsBounds(points, Math.max(0, points.length - 2))
    this.lastTipDirty = tip ? padBounds(tip, padding) : null
    this.liveExtent = unionBounds(this.liveExtent, dirty)

    this.repaintRegion(this.liveCtx, dirty, () => {
      paintPoints(this.liveCtx, points, style)
    })
  }

  /** Removes only the pixels the live stroke occupied. */
  endLiveStroke(): void {
    if (this.liveExtent) {
      this.clearPixels(this.liveCtx, this.liveExtent)
    } else {
      clearCanvas(this.liveCtx, this.liveCanvas)
    }
    this.resetLiveState()
  }

  clearLive(): void {
    clearCanvas(this.liveCtx, this.liveCanvas)
    this.resetLiveState()
  }

  /** Dashed ring under the pointer while the eraser tool is active. */
  renderEraserCursor(point: Point, radius: number): void {
    const extent = Math.max(2, radius) + 8
    const next: Bounds = {
      minX: point.x - extent,
      minY: point.y - extent,
      maxX: point.x + extent,
      maxY: point.y + extent
    }

    if (this.cursorBounds) {
      this.clearPixels(this.liveCtx, this.cursorBounds)
    }

    const ctx = this.liveCtx
    ctx.save()
    ctx.beginPath()
    ctx.arc(point.x, point.y, Math.max(2, radius), 0, Math.PI * 2)
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)'
    ctx.shadowBlur = 3
    ctx.stroke()
    ctx.restore()

    this.cursorBounds = next
  }

  get size(): { width: number; height: number; dpr: number } {
    return { width: this.width, height: this.height, dpr: this.dpr }
  }

  private resetLiveState(): void {
    this.paintedCount = 0
    this.lastTipDirty = null
    this.liveExtent = null
  }

  /** Snaps CSS-pixel bounds to one integer device-pixel rectangle. */
  private deviceRect(bounds: Bounds): PixelRect | null {
    const x0 = Math.max(0, Math.floor(bounds.minX * this.dpr))
    const y0 = Math.max(0, Math.floor(bounds.minY * this.dpr))
    const x1 = Math.min(Math.round(this.width * this.dpr), Math.ceil(bounds.maxX * this.dpr))
    const y1 = Math.min(Math.round(this.height * this.dpr), Math.ceil(bounds.maxY * this.dpr))
    if (x1 <= x0 || y1 <= y0) return null
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }

  /** Clears `bounds` and repaints only inside it. */
  private repaintRegion(ctx: CanvasRenderingContext2D, bounds: Bounds, paint: () => void): void {
    const rect = this.deviceRect(bounds)
    if (!rect) return

    ctx.save()
    // Work in device pixels so the cleared area and the clip are identical;
    // any mismatch would erase a sliver of neighbouring ink on every frame.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(rect.x, rect.y, rect.w, rect.h)
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w, rect.h)
    ctx.clip()
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
    paint()
    ctx.restore()
  }

  /** Clears only the device pixels covered by `bounds`. */
  private clearPixels(ctx: CanvasRenderingContext2D, bounds: Bounds): void {
    const rect = this.deviceRect(bounds)
    if (!rect) return

    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(rect.x, rect.y, rect.w, rect.h)
    ctx.restore()
  }
}
