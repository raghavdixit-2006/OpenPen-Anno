/**
 * Freeze-frame viewport transform. World coordinates are the overlay canvas'
 * own CSS pixels; the viewport is translated and scaled on top of them.
 * Keeping this math framework-free makes the zoom/pan behaviour testable
 * without a DOM.
 */
export interface ZoomTransform {
  readonly scale: number
  readonly x: number
  readonly y: number
}

export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

export function identityZoom(): ZoomTransform {
  return { scale: 1, x: 0, y: 0 }
}

export function clampZoom(scale: number): number {
  if (!Number.isFinite(scale)) return MIN_ZOOM
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale))
}

export function isIdentityZoom(transform: ZoomTransform): boolean {
  return transform.scale === 1 && transform.x === 0 && transform.y === 0
}

/** Screen (overlay-local pointer) coordinates to world coordinates. */
export function toWorld(
  transform: ZoomTransform,
  point: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: (point.x - transform.x) / transform.scale,
    y: (point.y - transform.y) / transform.scale
  }
}

/**
 * Zooms while keeping the world point under `anchor` fixed on screen. That is
 * what makes wheel zoom feel like it is anchored at the cursor instead of the
 * window origin.
 */
export function zoomAt(
  transform: ZoomTransform,
  anchor: { x: number; y: number },
  nextScale: number
): ZoomTransform {
  const scale = clampZoom(nextScale)
  const world = toWorld(transform, anchor)
  return {
    scale,
    x: anchor.x - world.x * scale,
    y: anchor.y - world.y * scale
  }
}

/** Moves the frozen view; deltas are screen pixels. */
export function panZoom(transform: ZoomTransform, dx: number, dy: number): ZoomTransform {
  return { ...transform, x: transform.x + dx, y: transform.y + dy }
}

/**
 * Keeps the zoomed frame covering the viewport. At 1× this pins the image to
 * the origin; zoomed in, the frame may slide only as far as its own edges, so
 * panning can never reveal the desktop behind the frozen screenshot.
 */
export function clampPan(
  transform: ZoomTransform,
  viewportWidth: number,
  viewportHeight: number
): ZoomTransform {
  const minX = viewportWidth * (1 - transform.scale)
  const minY = viewportHeight * (1 - transform.scale)
  return {
    scale: transform.scale,
    x: Math.min(0, Math.max(minX, transform.x)),
    y: Math.min(0, Math.max(minY, transform.y))
  }
}

/** CSS transform string for the viewport element. */
export function zoomCss(transform: ZoomTransform): string {
  return `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`
}
