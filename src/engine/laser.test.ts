import { describe, expect, it } from 'vitest'
import {
  LASER_LIFETIME_MS,
  LASER_MAX_POINTS,
  LASER_WIDTH,
  laserStrength,
  paintLaser,
  pruneLaser,
  type LaserPoint
} from './laser'

const laserPoint = (x: number, y: number, time: number): LaserPoint => ({
  x,
  y,
  pressure: 0.5,
  time
})

interface Recorder {
  ctx: CanvasRenderingContext2D
  strokes: Array<{ width: number; alpha: number }>
  fills: number
  arcs: number
}

function recorder(): Recorder {
  const state: Recorder = {
    ctx: null as unknown as CanvasRenderingContext2D,
    strokes: [],
    fills: 0,
    arcs: 0
  }

  state.ctx = {
    globalAlpha: 1,
    lineWidth: 0,
    save: () => undefined,
    restore: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    arc: () => {
      state.arcs += 1
    },
    stroke: () => {
      state.strokes.push({
        width: state.ctx.lineWidth,
        alpha: state.ctx.globalAlpha
      })
    },
    fill: () => {
      state.fills += 1
    }
  } as unknown as CanvasRenderingContext2D

  return state
}

describe('pruneLaser', () => {
  it('drops expired samples and keeps the live ones', () => {
    const points = [laserPoint(0, 0, 0), laserPoint(1, 1, 500), laserPoint(2, 2, 1000)]
    const alive = pruneLaser(points, 1000)

    expect(alive.map((point) => point.x)).toEqual([1, 2])
  })

  it('keeps a sample exactly at the lifetime boundary', () => {
    const alive = pruneLaser([laserPoint(0, 0, 0)], LASER_LIFETIME_MS)
    expect(alive).toHaveLength(1)

    expect(pruneLaser([laserPoint(0, 0, 0)], LASER_LIFETIME_MS + 1)).toHaveLength(0)
  })

  it('caps the number of samples', () => {
    const points = Array.from({ length: LASER_MAX_POINTS + 30 }, (_, index) =>
      laserPoint(index, 0, 1000)
    )
    const alive = pruneLaser(points, 1000)

    expect(alive).toHaveLength(LASER_MAX_POINTS)
    // The newest samples survive, not the oldest.
    expect(alive[alive.length - 1].x).toBe(points[points.length - 1].x)
  })
})

describe('laserStrength', () => {
  it('fades linearly with age', () => {
    expect(laserStrength(laserPoint(0, 0, 0), 0)).toBe(1)
    expect(laserStrength(laserPoint(0, 0, 0), LASER_LIFETIME_MS / 2)).toBeCloseTo(0.5)
    expect(laserStrength(laserPoint(0, 0, 0), LASER_LIFETIME_MS)).toBe(0)
  })
})

describe('paintLaser', () => {
  it('paints nothing for an empty trail', () => {
    const state = recorder()
    paintLaser(state.ctx, [], 0)

    expect(state.strokes).toHaveLength(0)
    expect(state.fills).toBe(0)
  })

  it('draws a glow and a core for every segment', () => {
    const state = recorder()
    const now = 100
    paintLaser(state.ctx, [laserPoint(0, 0, now), laserPoint(20, 0, now)], now)

    expect(state.strokes).toHaveLength(2)
    expect(state.strokes[0].width).toBeCloseTo(LASER_WIDTH * 2.6)
    expect(state.strokes[1].width).toBeCloseTo(LASER_WIDTH)
    expect(state.strokes[0].alpha).toBeLessThan(state.strokes[1].alpha)
  })

  it('draws a dot for a single sample', () => {
    const state = recorder()
    paintLaser(state.ctx, [laserPoint(5, 5, 0)], 0)

    expect(state.arcs).toBe(1)
    expect(state.fills).toBe(1)
    expect(state.strokes).toHaveLength(0)
  })
})
