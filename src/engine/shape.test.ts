import { describe, expect, it } from 'vitest'
import {
  arrowHeadPoints,
  constrainShapeEnd,
  createShape,
  getShapeBounds,
  hitTestShape,
  isShapeDrag,
  shapeRect
} from './shape'
import type { Point, ShapeStyle } from './types'

const point = (x: number, y: number): Point => ({ x, y, pressure: 0.5 })
const style: ShapeStyle = { color: '#ff2d2d', width: 4, opacity: 1 }

describe('createShape', () => {
  it('stores both corners and copies the style', () => {
    const shape = createShape('rect', point(10, 20), point(40, 60), style)

    expect(shape.kind).toBe('shape')
    expect(shape.tool).toBe('rect')
    expect(shape.start).toEqual(point(10, 20))
    expect(shape.end).toEqual(point(40, 60))
    expect(shape.style).toEqual(style)
    expect(shape.style).not.toBe(style)
  })
})

describe('isShapeDrag', () => {
  it('rejects clicks and accepts a real drag', () => {
    expect(isShapeDrag(point(10, 10), point(11, 11))).toBe(false)
    expect(isShapeDrag(point(10, 10), point(14, 10))).toBe(true)
  })
})

describe('constrainShapeEnd', () => {
  it('snaps lines to the nearest 45° axis', () => {
    const flat = constrainShapeEnd('line', point(0, 0), point(100, 10))
    expect(flat.x).toBeCloseTo(Math.hypot(100, 10))
    expect(flat.y).toBeCloseTo(0)

    const diagonal = constrainShapeEnd('arrow', point(0, 0), point(100, 90))
    const length = Math.hypot(100, 90)
    expect(diagonal.x).toBeCloseTo(Math.cos(Math.PI / 4) * length)
    expect(diagonal.y).toBeCloseTo(Math.sin(Math.PI / 4) * length)
  })

  it('makes rectangles square in every drag direction', () => {
    expect(constrainShapeEnd('rect', point(10, 10), point(110, 50))).toEqual(point(110, 110))
    expect(constrainShapeEnd('ellipse', point(10, 10), point(-20, 30))).toEqual(point(-20, 40))
  })
})

describe('shape geometry', () => {
  it('normalizes a box dragged up and to the left', () => {
    const shape = createShape('rect', point(100, 80), point(20, 10), style)
    expect(shapeRect(shape)).toEqual({ x: 20, y: 10, width: 80, height: 70 })
  })

  it('pads bounds by half the stroke width', () => {
    const shape = createShape('line', point(10, 20), point(40, 60), style)
    expect(getShapeBounds(shape)).toEqual({ minX: 7, minY: 17, maxX: 43, maxY: 63 })
  })

  it('gives arrows a head that sweeps back from the tip', () => {
    const shape = createShape('arrow', point(0, 0), point(100, 0), style)
    const head = arrowHeadPoints(shape)

    expect(head).not.toBeNull()
    expect(head?.[0]).toEqual(point(100, 0))
    expect(head?.[1].x).toBeLessThan(100)
    expect(head?.[2].x).toBeLessThan(100)
    expect(head?.[1].y).toBeGreaterThan(0)
    expect(head?.[2].y).toBeLessThan(0)
  })
})

describe('hitTestShape', () => {
  it('hits a line along its path only', () => {
    const line = createShape('line', point(0, 0), point(100, 0), style)
    expect(hitTestShape(line, point(50, 2), 0)).toBe(true)
    expect(hitTestShape(line, point(50, 9), 0)).toBe(false)
    expect(hitTestShape(line, point(50, 9), 8)).toBe(true)
  })

  it('hits the outline of a rectangle, not its interior', () => {
    const rect = createShape('rect', point(0, 0), point(100, 50), style)
    expect(hitTestShape(rect, point(0, 25), 0)).toBe(true)
    expect(hitTestShape(rect, point(50, 0), 0)).toBe(true)
    expect(hitTestShape(rect, point(50, 25), 0)).toBe(false)
  })

  it('hits the outline of an ellipse, not its interior', () => {
    const ellipse = createShape('ellipse', point(0, 0), point(100, 50), style)
    expect(hitTestShape(ellipse, point(100, 25), 0)).toBe(true)
    expect(hitTestShape(ellipse, point(50, 0), 0)).toBe(true)
    expect(hitTestShape(ellipse, point(50, 25), 0)).toBe(false)
  })

  it('hits an arrow near its tip', () => {
    const arrow = createShape('arrow', point(0, 0), point(100, 0), style)
    expect(hitTestShape(arrow, point(100, 1), 0)).toBe(true)
  })
})
