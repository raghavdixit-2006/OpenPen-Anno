import { describe, expect, it } from 'vitest'
import { SPOTLIGHT_RADIUS, backdropFill, isSolidBackdrop, paintBackdrop } from './backdrop'
import type { Point } from './types'

const point = (x: number, y: number): Point => ({ x, y, pressure: 0.5 })

interface Recorder {
  ctx: CanvasRenderingContext2D
  cleared: number
  filled: number
  gradients: Array<{ args: number[]; stops: Array<[number, string]> }>
  arcs: Array<{ x: number; y: number; radius: number }>
}

function recorder(): Recorder {
  const state: Recorder = {
    ctx: null as unknown as CanvasRenderingContext2D,
    cleared: 0,
    filled: 0,
    gradients: [],
    arcs: []
  }

  state.ctx = {
    globalCompositeOperation: 'source-over',
    fillStyle: '',
    save: () => undefined,
    restore: () => undefined,
    clearRect: () => {
      state.cleared += 1
    },
    fillRect: () => {
      state.filled += 1
    },
    beginPath: () => undefined,
    arc: (x: number, y: number, radius: number) => {
      state.arcs.push({ x, y, radius })
    },
    fill: () => {
      state.filled += 1
    },
    createRadialGradient: (...args: number[]) => {
      const gradient = { args, stops: [] as Array<[number, string]> }
      state.gradients.push(gradient)
      return {
        addColorStop: (offset: number, color: string) => gradient.stops.push([offset, color])
      } as unknown as CanvasGradient
    }
  } as unknown as CanvasRenderingContext2D

  return state
}

describe('backdrop modes', () => {
  it('only white and black are solid fills', () => {
    expect(backdropFill('white')).toBe('#f7f6f2')
    expect(backdropFill('black')).toBe('#0b0b0d')
    expect(backdropFill('none')).toBeNull()
    expect(backdropFill('spotlight')).toBeNull()

    expect(isSolidBackdrop('white')).toBe(true)
    expect(isSolidBackdrop('black')).toBe(true)
    expect(isSolidBackdrop('spotlight')).toBe(false)
    expect(isSolidBackdrop('none')).toBe(false)
  })
})

describe('paintBackdrop', () => {
  it('clears the layer and paints nothing without a backdrop', () => {
    const state = recorder()
    paintBackdrop(state.ctx, 'none', 800, 600, null)

    expect(state.cleared).toBe(1)
    expect(state.filled).toBe(0)
    expect(state.gradients).toHaveLength(0)
  })

  it('fills the whole layer for a whiteboard', () => {
    const state = recorder()
    paintBackdrop(state.ctx, 'white', 800, 600, null)

    expect(state.cleared).toBe(1)
    expect(state.filled).toBe(1)
    expect(state.gradients).toHaveLength(0)
    expect(state.ctx.fillStyle).toBe('#f7f6f2')
  })

  it('dims the layer without a hole before the cursor is known', () => {
    const state = recorder()
    paintBackdrop(state.ctx, 'spotlight', 800, 600, null)

    expect(state.filled).toBe(1)
    expect(state.gradients).toHaveLength(0)
  })

  it('cuts a soft spotlight hole at the cursor', () => {
    const state = recorder()
    paintBackdrop(state.ctx, 'spotlight', 800, 600, point(120, 90))

    // One fill for the dim sheet, one for the hole.
    expect(state.filled).toBe(2)
    expect(state.gradients).toHaveLength(1)

    const gradient = state.gradients[0]
    // createRadialGradient(x0, y0, r0, x1, y1, r1)
    expect(gradient.args).toEqual([120, 90, SPOTLIGHT_RADIUS * 0.55, 120, 90, SPOTLIGHT_RADIUS])
    expect(gradient.stops).toEqual([
      [0, 'rgba(0, 0, 0, 1)'],
      [1, 'rgba(0, 0, 0, 0)']
    ])
    expect(state.arcs).toEqual([{ x: 120, y: 90, radius: SPOTLIGHT_RADIUS }])
    // The hole is punched by removing alpha, not by painting black.
    expect(state.ctx.globalCompositeOperation).toBe('destination-out')
  })
})
