import { describe, expect, it } from 'vitest'
import {
  STAMP_MAX_RADIUS,
  STAMP_MIN_RADIUS,
  createStamp,
  getStampBounds,
  hitTestStamp,
  paintStamp,
  stampRadius,
  stampTextColor
} from './stamp'
import type { Point, StampStyle } from './types'

const point = (x: number, y: number): Point => ({ x, y, pressure: 0.5 })
const style: StampStyle = { color: '#ff2d2d', opacity: 1 }

describe('stampRadius', () => {
  it('clamps the brush slider into a legible badge range', () => {
    expect(stampRadius(1)).toBe(STAMP_MIN_RADIUS)
    expect(stampRadius(4)).toBe(STAMP_MIN_RADIUS)
    expect(stampRadius(10)).toBe(30)
    expect(stampRadius(32)).toBe(STAMP_MAX_RADIUS)
  })
})

describe('createStamp', () => {
  it('normalizes the index and copies the style', () => {
    const stamp = createStamp(3, 40, 50, style, 20)

    expect(stamp.kind).toBe('stamp')
    expect(stamp.index).toBe(3)
    expect(stamp.x).toBe(40)
    expect(stamp.y).toBe(50)
    expect(stamp.radius).toBe(20)
    expect(stamp.style).toEqual(style)
    expect(stamp.style).not.toBe(style)
  })

  it('never produces index zero or a negative radius', () => {
    const stamp = createStamp(0, 0, 0, style, -5)
    expect(stamp.index).toBe(1)
    expect(stamp.radius).toBeGreaterThan(0)
  })
})

describe('getStampBounds', () => {
  it('covers the badge circle plus its ring', () => {
    const stamp = createStamp(1, 100, 100, style, 16)
    expect(getStampBounds(stamp)).toEqual({ minX: 82, minY: 82, maxX: 118, maxY: 118 })
  })
})

describe('hitTestStamp', () => {
  it('hits anywhere on the badge and respects the eraser radius', () => {
    const stamp = createStamp(1, 100, 100, style, 16)

    expect(hitTestStamp(stamp, point(100, 100), 0)).toBe(true)
    expect(hitTestStamp(stamp, point(115, 100), 0)).toBe(true)
    expect(hitTestStamp(stamp, point(130, 100), 0)).toBe(false)
    expect(hitTestStamp(stamp, point(130, 100), 14)).toBe(true)
  })
})

describe('stampTextColor', () => {
  it('flips the numeral to dark ink on bright swatches', () => {
    expect(stampTextColor('#ffd60a')).toBe('#18181b')
    expect(stampTextColor('#ffffff')).toBe('#18181b')
    expect(stampTextColor('#0a84ff')).toBe('#ffffff')
    expect(stampTextColor('#ff2d2d')).toBe('#ffffff')
  })

  it('falls back to white for malformed colours', () => {
    expect(stampTextColor('red')).toBe('#ffffff')
    expect(stampTextColor('#zzzzzz')).toBe('#ffffff')
  })
})

interface Recorder {
  ctx: CanvasRenderingContext2D
  fills: number
  arcs: number
  labels: string[]
  fonts: string[]
  align: string[]
}

function recorder(): Recorder {
  const state: Recorder = {
    ctx: null as unknown as CanvasRenderingContext2D,
    fills: 0,
    arcs: 0,
    labels: [],
    fonts: [],
    align: []
  }

  state.ctx = {
    globalAlpha: 1,
    fillStyle: '',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    arc: () => {
      state.arcs += 1
    },
    fill: () => {
      state.fills += 1
    },
    stroke: () => undefined,
    fillText: (text: string) => {
      state.labels.push(text)
    }
  } as unknown as CanvasRenderingContext2D

  return state
}

describe('paintStamp', () => {
  it('fills the badge and centres its numeral', () => {
    const state = recorder()
    paintStamp(state.ctx, createStamp(7, 50, 60, style, 20))

    expect(state.arcs).toBe(1)
    expect(state.fills).toBe(1)
    expect(state.labels).toEqual(['7'])
    expect(state.ctx.textAlign).toBe('center')
    expect(state.ctx.textBaseline).toBe('middle')
    expect(state.ctx.font).toContain('23px')
  })
})
