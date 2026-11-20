import { describe, expect, it } from 'vitest'
import { createEraserStroke, getEraserBounds, paintEraserPath } from './eraser'
import type { Point } from './types'

const point = (x: number, y: number): Point => ({ x, y, pressure: 0.5 })

describe('createEraserStroke', () => {
  it('copies the path and clamps the radius', () => {
    const points = [point(1, 2), point(3, 4)]
    const eraser = createEraserStroke(points, 0)

    expect(eraser.kind).toBe('eraser')
    expect(eraser.points).toEqual(points)
    expect(eraser.points).not.toBe(points)
    expect(eraser.radius).toBe(1)
  })
})

describe('getEraserBounds', () => {
  it('covers the whole swipe plus its round cap', () => {
    const eraser = createEraserStroke([point(10, 20), point(40, 60)], 8)
    expect(getEraserBounds(eraser)).toEqual({ minX: 2, minY: 12, maxX: 48, maxY: 68 })
  })

  it('returns null for an empty path', () => {
    expect(getEraserBounds(createEraserStroke([], 8))).toBeNull()
  })
})

interface FakeContext {
  ctx: CanvasRenderingContext2D & { globalCompositeOperation: string; lineWidth: number }
  counters: { strokes: number; fills: number }
}

function fakeContext(): FakeContext {
  const counters = { strokes: 0, fills: 0 }
  const ctx = {
    globalCompositeOperation: 'source-over',
    lineWidth: 0,
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arc: () => undefined,
    stroke: () => {
      counters.strokes += 1
    },
    fill: () => {
      counters.fills += 1
    }
  }
  return { ctx: ctx as unknown as FakeContext['ctx'], counters }
}

describe('paintEraserPath', () => {
  it('uses destination-out so only alpha is removed', () => {
    const { ctx, counters } = fakeContext()
    paintEraserPath(ctx, [point(0, 0), point(10, 10)], 5)

    expect(ctx.globalCompositeOperation).toBe('destination-out')
    expect(ctx.lineWidth).toBe(10)
    expect(counters.strokes).toBe(1)
  })

  it('paints a dot for a single sample', () => {
    const { ctx, counters } = fakeContext()
    paintEraserPath(ctx, [point(4, 4)], 3)

    expect(counters.fills).toBe(1)
    expect(counters.strokes).toBe(0)
  })
})
