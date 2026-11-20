import { describe, expect, it } from 'vitest'
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampPan,
  clampZoom,
  identityZoom,
  isIdentityZoom,
  panZoom,
  toWorld,
  zoomAt,
  zoomCss
} from './zoom'

describe('clampZoom', () => {
  it('keeps the zoom inside the usable range', () => {
    expect(clampZoom(0.2)).toBe(MIN_ZOOM)
    expect(clampZoom(2.5)).toBe(2.5)
    expect(clampZoom(99)).toBe(MAX_ZOOM)
    expect(clampZoom(Number.NaN)).toBe(MIN_ZOOM)
  })
})

describe('toWorld', () => {
  it('is the identity at rest', () => {
    expect(toWorld(identityZoom(), { x: 40, y: 90 })).toEqual({ x: 40, y: 90 })
  })

  it('inverts translation and scale', () => {
    const transform = { scale: 2, x: -100, y: -50 }
    expect(toWorld(transform, { x: 100, y: 50 })).toEqual({ x: 100, y: 50 })
    expect(toWorld(transform, { x: 0, y: 0 })).toEqual({ x: 50, y: 25 })
  })
})

describe('zoomAt', () => {
  it('keeps the world point under the anchor fixed', () => {
    const transform = { scale: 1.5, x: -30, y: 12 }
    const anchor = { x: 400, y: 300 }
    const before = toWorld(transform, anchor)
    const next = zoomAt(transform, anchor, 3)

    expect(next.scale).toBe(3)
    expect(toWorld(next, anchor).x).toBeCloseTo(before.x)
    expect(toWorld(next, anchor).y).toBeCloseTo(before.y)
  })

  it('clamps instead of accepting an out-of-range scale', () => {
    expect(zoomAt(identityZoom(), { x: 0, y: 0 }, 100).scale).toBe(MAX_ZOOM)
    expect(zoomAt(identityZoom(), { x: 0, y: 0 }, 0).scale).toBe(MIN_ZOOM)
  })
})

describe('panZoom', () => {
  it('shifts only the translation', () => {
    const transform = { scale: 2, x: 10, y: 20 }
    expect(panZoom(transform, -5, 7)).toEqual({ scale: 2, x: 5, y: 27 })
  })
})

describe('clampPan', () => {
  it('pins the frame to the viewport at 1×', () => {
    expect(clampPan({ scale: 1, x: 40, y: -30 }, 800, 600)).toEqual({ scale: 1, x: 0, y: 0 })
  })

  it('stops panning at the frame edges when zoomed in', () => {
    // 800×600 at 2× leaves 800×600 of overflow in each axis.
    expect(clampPan({ scale: 2, x: 120, y: -900 }, 800, 600)).toEqual({
      scale: 2,
      x: 0,
      y: -600
    })
    expect(clampPan({ scale: 2, x: -100, y: -200 }, 800, 600)).toEqual({
      scale: 2,
      x: -100,
      y: -200
    })
  })
})

describe('identity helpers', () => {
  it('detects the rest pose', () => {
    expect(isIdentityZoom(identityZoom())).toBe(true)
    expect(isIdentityZoom({ scale: 2, x: 0, y: 0 })).toBe(false)
    expect(isIdentityZoom({ scale: 1, x: 4, y: 0 })).toBe(false)
  })

  it('renders a CSS transform with translate before scale', () => {
    expect(zoomCss({ scale: 2, x: 10, y: -5 })).toBe('translate(10px, -5px) scale(2)')
  })
})
