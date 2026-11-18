import { describe, expect, it } from 'vitest'
import { VelocityPressure } from './pressure'

const advance = (pressure: VelocityPressure, count: number, stepX: number, stepMs = 8): number => {
  let value = 0
  let x = 0
  let time = 0
  for (let i = 0; i < count; i++) {
    value = pressure.sample(x, 0, time)
    x += stepX
    time += stepMs
  }
  return value
}

describe('VelocityPressure', () => {
  it('starts at the initial pressure', () => {
    const pressure = new VelocityPressure()
    expect(pressure.sample(0, 0, 0)).toBe(0.75)
  })

  it('grows thick for slow drawing', () => {
    const pressure = new VelocityPressure()
    expect(advance(pressure, 40, 1)).toBeGreaterThan(0.9)
  })

  it('thins out for fast drawing', () => {
    const pressure = new VelocityPressure()
    expect(advance(pressure, 40, 24)).toBeLessThan(0.35)
  })

  it('always stays inside the pressure range', () => {
    const pressure = new VelocityPressure()
    let x = 0
    for (let i = 0; i < 200; i++) {
      x += i % 2 === 0 ? 0.5 : 40
      const value = pressure.sample(x, i % 17, i * 8)
      expect(value).toBeGreaterThanOrEqual(0.3)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('survives samples that share a timestamp', () => {
    const pressure = new VelocityPressure()
    pressure.sample(0, 0, 0)
    const value = pressure.sample(5, 0, 0)
    expect(Number.isFinite(value)).toBe(true)
    expect(value).toBeGreaterThanOrEqual(0.3)
  })

  it('returns to the initial pressure after reset', () => {
    const pressure = new VelocityPressure()
    advance(pressure, 40, 24)
    pressure.reset()
    expect(pressure.sample(0, 0, 0)).toBe(0.75)
  })

  it('accepts custom options', () => {
    const pressure = new VelocityPressure({ initial: 0.5, min: 0.2, maxSpeed: 1 })
    expect(pressure.sample(0, 0, 0)).toBe(0.5)
    expect(advance(pressure, 60, 8)).toBeLessThan(0.25)
  })
})
