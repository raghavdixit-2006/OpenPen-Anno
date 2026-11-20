import { describe, expect, it } from 'vitest'
import { createEraserStroke } from './eraser'
import { getItemBounds, hitTestItem } from './items'
import { createShape } from './shape'
import { createStroke } from './stroke'
import type { InkItem, Point } from './types'

const point = (x: number, y: number): Point => ({ x, y, pressure: 0.5 })
const shapeStyle = { color: '#ffffff', width: 4, opacity: 1 }

describe('getItemBounds', () => {
  it('delegates freehand items to the stroke bounds', () => {
    const stroke = createStroke([point(10, 20), point(30, 40)])
    const bounds = getItemBounds(stroke)

    // Default pen width is 4, so the box grows by 2 px on every side.
    expect(bounds).toEqual({ minX: 8, minY: 18, maxX: 32, maxY: 42 })
  })

  it('returns null for an empty freehand stroke', () => {
    expect(getItemBounds(createStroke([]))).toBeNull()
  })

  it('returns null for unknown item kinds', () => {
    const future = { id: 'future-1', kind: 'future-item' } as unknown as InkItem
    expect(getItemBounds(future)).toBeNull()
  })

  it('delegates shapes to the shape bounds', () => {
    const shape = createShape('rect', point(10, 10), point(30, 50), shapeStyle)
    expect(getItemBounds(shape)).toEqual({ minX: 7, minY: 7, maxX: 33, maxY: 53 })
  })

  it('bounds pixel eraser swipes too, so region repaints replay them', () => {
    const eraser = createEraserStroke([point(10, 10), point(20, 20)], 4)
    expect(getItemBounds(eraser)).toEqual({ minX: 6, minY: 6, maxX: 24, maxY: 24 })
  })
})

describe('hitTestItem', () => {
  it('hits a freehand stroke along its path', () => {
    const stroke = createStroke([point(0, 0), point(100, 0)])
    expect(hitTestItem(stroke, point(50, 1), 2)).toBe(true)
  })

  it('misses a freehand stroke far from its path', () => {
    const stroke = createStroke([point(0, 0), point(100, 0)])
    expect(hitTestItem(stroke, point(50, 50), 2)).toBe(false)
  })

  it('never hits unknown item kinds', () => {
    const future = { id: 'future-1', kind: 'future-item' } as unknown as InkItem
    expect(hitTestItem(future, point(0, 0), 1000)).toBe(false)
  })

  it('hits shapes through the shape hit test', () => {
    const shape = createShape('rect', point(0, 0), point(100, 50), shapeStyle)
    expect(hitTestItem(shape, point(0, 25), 0)).toBe(true)
    expect(hitTestItem(shape, point(50, 25), 0)).toBe(false)
  })

  it('never erases a pixel eraser item itself', () => {
    const eraser = createEraserStroke([point(0, 0), point(100, 0)], 4)
    expect(hitTestItem(eraser, point(50, 0), 100)).toBe(false)
  })
})
