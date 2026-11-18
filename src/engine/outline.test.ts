import { describe, expect, it } from 'vitest'
import { HIGHLIGHTER_WIDTH_SCALE, brushWidth, strokeOutline } from './outline'
import type { Point, StrokeStyle } from './types'

const point = (x: number, y: number, pressure = 0.5): Point => ({ x, y, pressure })

const pen: StrokeStyle = {
  tool: 'pen',
  color: '#123456',
  width: 10,
  opacity: 1
}

const highlighter: StrokeStyle = {
  ...pen,
  tool: 'highlighter',
  opacity: 0.4
}

const line = [point(0, 0), point(20, 10), point(40, 0), point(60, 20)]

function height(outline: readonly (readonly number[])[]): number {
  let min = Infinity
  let max = -Infinity
  for (const [, y] of outline) {
    if (y < min) min = y
    if (y > max) max = y
  }
  return max - min
}

describe('brushWidth', () => {
  it('keeps the pen nib at the style width', () => {
    expect(brushWidth(pen)).toBe(10)
  })

  it('widens the highlighter nib', () => {
    expect(brushWidth(highlighter)).toBe(10 * HIGHLIGHTER_WIDTH_SCALE)
  })
})

describe('strokeOutline', () => {
  it('returns no outline for an empty stroke', () => {
    expect(strokeOutline([], pen)).toEqual([])
  })

  it('returns polygon vertices as x/y pairs', () => {
    const outline = strokeOutline(line, pen)
    expect(outline.length).toBeGreaterThan(line.length)
    for (const vertex of outline) expect(vertex).toHaveLength(2)
  })

  it('surrounds the sampled path', () => {
    const outline = strokeOutline(line, pen)
    const xs = outline.map(([x]) => x)
    const ys = outline.map(([, y]) => y)
    expect(Math.min(...xs)).toBeLessThan(0)
    expect(Math.max(...xs)).toBeGreaterThan(60)
    expect(Math.min(...ys)).toBeLessThan(0)
    expect(Math.max(...ys)).toBeGreaterThan(20)
  })

  it('paints a dot for a single tap', () => {
    const outline = strokeOutline([point(20, 20)], pen)
    expect(outline.length).toBeGreaterThan(2)
    expect(height(outline)).toBeGreaterThan(0)
  })

  it('gives the highlighter a wider outline than the pen', () => {
    expect(height(strokeOutline(line, highlighter))).toBeGreaterThan(
      height(strokeOutline(line, pen))
    )
  })

  it('turns real pressure into line weight', () => {
    const light = line.map((sample) => ({ ...sample, pressure: 0.1 }))
    const heavy = line.map((sample) => ({ ...sample, pressure: 0.9 }))
    expect(height(strokeOutline(heavy, pen))).toBeGreaterThan(height(strokeOutline(light, pen)))
  })

  it('never paints wider than the requested brush width', () => {
    const straight = [point(0, 0, 1), point(30, 0, 1), point(60, 0, 1)]
    const drawn = height(strokeOutline(straight, pen))
    expect(drawn).toBeLessThanOrEqual(11)
    expect(drawn).toBeGreaterThanOrEqual(9)
  })

  it('is deterministic for the same samples', () => {
    expect(strokeOutline(line, pen)).toEqual(strokeOutline(line, pen))
  })
})
