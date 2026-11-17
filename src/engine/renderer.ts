import type { Point, Stroke, StrokeStyle } from './types'

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

/**
 * Owns the two stacked canvases: the committed layer (finished strokes) and the
 * live layer (the stroke currently under the pointer).
 */
export class OverlayRenderer {
  private readonly committedCtx: CanvasRenderingContext2D
  private readonly liveCtx: CanvasRenderingContext2D
  private width = 1
  private height = 1
  private dpr = 1

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
  }

  renderStrokes(strokes: readonly Stroke[]): void {
    clearCanvas(this.committedCtx, this.committedCanvas)
    for (const stroke of strokes) {
      paintPoints(this.committedCtx, stroke.points, stroke.style)
    }
  }

  renderLive(points: readonly Point[], style: StrokeStyle): void {
    clearCanvas(this.liveCtx, this.liveCanvas)
    paintPoints(this.liveCtx, points, style)
  }

  clearLive(): void {
    clearCanvas(this.liveCtx, this.liveCanvas)
  }

  /** Dashed ring under the pointer while the eraser tool is active. */
  renderEraserCursor(point: Point, radius: number): void {
    clearCanvas(this.liveCtx, this.liveCanvas)
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
  }

  get size(): { width: number; height: number; dpr: number } {
    return { width: this.width, height: this.height, dpr: this.dpr }
  }
}
