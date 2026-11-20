import type { Point } from './types'

/**
 * Presentation laser. The trail is transient: it never enters history and it
 * fades out on its own, so it must not look like committed ink.
 */
export const LASER_LIFETIME_MS = 650

/** Oldest samples are pruned continuously; this caps worst-case frame cost. */
export const LASER_MAX_POINTS = 96

/** Core beam width in CSS pixels; the glow is drawn at a multiple of this. */
export const LASER_WIDTH = 5

export interface LaserPoint extends Point {
  /** `performance.now()` when the sample was captured. */
  readonly time: number
}

/** Drops expired samples and keeps the newest `LASER_MAX_POINTS`. */
export function pruneLaser(points: readonly LaserPoint[], now: number): LaserPoint[] {
  const alive = points.filter((point) => now - point.time <= LASER_LIFETIME_MS)
  return alive.length > LASER_MAX_POINTS ? alive.slice(alive.length - LASER_MAX_POINTS) : alive
}

/** 0 at the end of its life, 1 when freshly drawn. */
export function laserStrength(point: LaserPoint, now: number): number {
  const age = Math.max(0, now - point.time)
  return Math.max(0, 1 - age / LASER_LIFETIME_MS)
}

/**
 * Paints the beam segment by segment so each sample can fade independently.
 * A wide translucent pass under a narrow bright pass gives the glow without
 * `shadowBlur`, which is expensive on large transparent windows.
 */
export function paintLaser(
  ctx: CanvasRenderingContext2D,
  points: readonly LaserPoint[],
  now: number
): void {
  if (points.length === 0) return

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (points.length === 1) {
    const point = points[0]
    const strength = laserStrength(point, now)
    if (strength <= 0) {
      ctx.restore()
      return
    }
    ctx.globalAlpha = strength
    ctx.fillStyle = '#ff3b30'
    ctx.beginPath()
    ctx.arc(point.x, point.y, LASER_WIDTH, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1]
    const current = points[i]
    const strength = laserStrength(current, now)
    if (strength <= 0) continue

    const draw = (width: number, alpha: number): void => {
      ctx.globalAlpha = alpha * strength
      ctx.strokeStyle = '#ff3b30'
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(previous.x, previous.y)
      ctx.lineTo(current.x, current.y)
      ctx.stroke()
    }

    // Outer glow, then the hot core.
    draw(LASER_WIDTH * 2.6, 0.22)
    draw(LASER_WIDTH, 0.95)
  }

  ctx.restore()
}
