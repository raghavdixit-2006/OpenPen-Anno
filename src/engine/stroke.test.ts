import { describe, expect, it } from 'vitest'
import {
  PEN_STYLE,
  appendPoint,
  createStroke,
  getStrokeBounds,
  hitTestStroke,
  isDistinctPoint
} from './stroke'
import type { Point, StrokeStyle } from './types'

const point = (x: number, y: number, pressure = 0.5): Point => ({ x, y, pressure })
const style: StrokeStyle = { tool: 'pen', color: '#123456', width: 10, opacity: 1 }

describe('createStroke', () => {
  it('assigns a unique id to every stroke', () => {
    const a = createStroke([point(1, 1)], style)
    const b = createStroke([point(1, 1)], style)
    expect(a.id).not.toBe(b.id)
  })

  it('copies points so the caller cannot mutate history', () => {
    const points = [point(10, 20), point(30, 40)]
    const stroke = createStroke(points, style)

    // Points are readonly in the model, so mutate through a cast to prove the
    // stroke kept its own copy.
    ;(points[0] as { x: number }).x = 999
    points.push(point(50, 60))

    expect(stroke.points).toHaveLength(2)
    expect(stroke.points[0]).toEqual(point(10, 20))
  })

  it('copies the style', () => {
    const mutableStyle: StrokeStyle = { ...style }
    const stroke = createStroke([point(1, 2)], mutableStyle)

    ;(mutableStyle as { color: string }).color = '#000000'

    expect(stroke.style.color).toBe('#123456')
  })

  it('falls back to the red pen style', () => {
    const stroke = createStroke([point(1, 2)])
    expect(stroke.style).toEqual(PEN_STYLE)
  })

  it('allows an empty point list', () => {
    expect(createStroke([], style).points).toEqual([])
  })
})

describe('appendPoint', () => {
  it('returns a new stroke and leaves the original untouched', () => {
    const original = createStroke([point(1, 1)], style)
    const extended = appendPoint(original, point(2, 2))

    expect(extended.points).toEqual([point(1, 1), point(2, 2)])
    expect(extended.id).toBe(original.id)
    expect(extended.style).toEqual(original.style)
    expect(original.points).toHaveLength(1)
  })

  it('copies the appended point', () => {
    const original = createStroke([], style)
    const next = point(5, 6)
    const extended = appendPoint(original, next)

    ;(next as { x: number }).x = 100

    expect(extended.points[0].x).toBe(5)
  })
})

describe('getStrokeBounds', () => {
  it('returns null without points', () => {
    expect(getStrokeBounds(createStroke([], style))).toBeNull()
  })

  it('includes half the brush width around the points', () => {
    const stroke = createStroke([point(10, 20), point(30, 60)], style)
    expect(getStrokeBounds(stroke)).toEqual({ minX: 5, minY: 15, maxX: 35, maxY: 65 })
  })

  it('handles a single point', () => {
    const bounds = getStrokeBounds(createStroke([point(50, 50)], style))
    expect(bounds).toEqual({ minX: 45, minY: 45, maxX: 55, maxY: 55 })
  })
})

describe('isDistinctPoint', () => {
  it('accepts the first point', () => {
    expect(isDistinctPoint(undefined, point(1, 1))).toBe(true)
  })

  it('rejects sub-pixel duplicates', () => {
    expect(isDistinctPoint(point(10, 10), point(10.005, 10))).toBe(false)
  })

  it('accepts movement above the epsilon', () => {
    expect(isDistinctPoint(point(10, 10), point(10.5, 10))).toBe(true)
  })
})

describe('hitTestStroke', () => {
  const line = createStroke([point(0, 0), point(100, 0)], style) // width 10

  it('hits a point on the stroke', () => {
    expect(hitTestStroke(line, point(50, 0), 0)).toBe(true)
  })

  it('hits inside the brush width plus the eraser radius', () => {
    expect(hitTestStroke(line, point(50, 9), 4)).toBe(true)
  })

  it('misses outside brush width plus the eraser radius', () => {
    expect(hitTestStroke(line, point(50, 40), 4)).toBe(false)
  })

  it('misses beyond the end of the stroke', () => {
    expect(hitTestStroke(line, point(200, 0), 4)).toBe(false)
  })

  it('handles a single-point stroke', () => {
    const dot = createStroke([point(20, 20)], style)
    expect(hitTestStroke(dot, point(22, 22), 2)).toBe(true)
    expect(hitTestStroke(dot, point(60, 60), 2)).toBe(false)
  })

  it('never hits an empty stroke', () => {
    expect(hitTestStroke(createStroke([], style), point(0, 0), 50)).toBe(false)
  })
})
