import type { BackdropMode, Point } from './types'

/** Diameter of the bright hole in spotlight mode, in CSS pixels. */
export const SPOTLIGHT_RADIUS = 160

const DIM = 'rgba(0, 0, 0, 0.62)'
const BACKDROP_COLORS = {
  white: '#f7f6f2',
  black: '#0b0b0d'
} as const

/** Solid fill used by a backdrop mode, or null when it paints a gradient. */
export function backdropFill(mode: BackdropMode): string | null {
  if (mode === 'white') return BACKDROP_COLORS.white
  if (mode === 'black') return BACKDROP_COLORS.black
  return null
}

export function isSolidBackdrop(mode: BackdropMode): boolean {
  return mode === 'white' || mode === 'black'
}

/**
 * Paints the backdrop layer. Everything here is below the ink canvases, so a
 * whiteboard or blackboard is just a full-bleed fill and the spotlight is a
 * dimmed sheet with a soft transparent hole around the cursor.
 */
export function paintBackdrop(
  ctx: CanvasRenderingContext2D,
  mode: BackdropMode,
  width: number,
  height: number,
  spotlight: Point | null
): void {
  ctx.save()
  ctx.clearRect(0, 0, width, height)

  if (mode === 'none') {
    ctx.restore()
    return
  }

  const fill = backdropFill(mode)
  if (fill) {
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, width, height)
    ctx.restore()
    return
  }

  ctx.fillStyle = DIM
  ctx.fillRect(0, 0, width, height)

  if (spotlight) {
    // destination-out with a radial alpha ramp: opaque at the centre removes
    // all dimming, transparent at the rim leaves it untouched.
    ctx.globalCompositeOperation = 'destination-out'
    const gradient = ctx.createRadialGradient(
      spotlight.x,
      spotlight.y,
      SPOTLIGHT_RADIUS * 0.55,
      spotlight.x,
      spotlight.y,
      SPOTLIGHT_RADIUS
    )
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)')
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
    ctx.fillStyle = gradient
    ctx.beginPath()
    ctx.arc(spotlight.x, spotlight.y, SPOTLIGHT_RADIUS, 0, Math.PI * 2)
    ctx.fill()
  }

  ctx.restore()
}

/**
 * Owns the backdrop canvas. Separate from `OverlayRenderer` because the
 * backdrop is replaced wholesale on every cursor frame and must never disturb
 * committed ink.
 */
export class BackdropRenderer {
  private readonly ctx: CanvasRenderingContext2D
  private width = 1
  private height = 1

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2D canvas is not available')
    this.ctx = ctx
  }

  resize(cssWidth: number, cssHeight: number, dpr: number): void {
    this.width = Math.max(1, cssWidth)
    this.height = Math.max(1, cssHeight)

    this.canvas.width = Math.round(this.width * dpr)
    this.canvas.height = Math.round(this.height * dpr)
    this.canvas.style.width = `${this.width}px`
    this.canvas.style.height = `${this.height}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  render(mode: BackdropMode, spotlight: Point | null): void {
    paintBackdrop(this.ctx, mode, this.width, this.height, spotlight)
  }
}
