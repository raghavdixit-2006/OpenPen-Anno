export interface VelocityPressureOptions {
  /** Pressure for the first sample and after a reset. */
  readonly initial?: number
  /** Floor so a fast flick never collapses the line. */
  readonly min?: number
  /** Speed (CSS px per ms) that reaches the floor. */
  readonly maxSpeed?: number
  /** 0..1 exponential smoothing, so one jittery sample does not spike width. */
  readonly smoothing?: number
}

const DEFAULTS: Required<VelocityPressureOptions> = {
  initial: 0.75,
  min: 0.3,
  maxSpeed: 2.5,
  smoothing: 0.35
}

/**
 * Turns pointer speed into a synthetic pressure value for devices without a
 * pressure channel. A mouse reports a constant 0.5 pressure, and
 * perfect-freehand's own simulation barely reacts to speed, so width is driven
 * here instead: slow strokes get heavy, fast flicks get thin.
 */
export class VelocityPressure {
  private readonly options: Required<VelocityPressureOptions>
  private last: { x: number; y: number; time: number } | null = null
  private current: number

  constructor(options: VelocityPressureOptions = {}) {
    this.options = { ...DEFAULTS, ...options }
    this.current = this.options.initial
  }

  reset(): void {
    this.last = null
    this.current = this.options.initial
  }

  /** Adds one sample and returns the pressure to store on that point. */
  sample(x: number, y: number, time: number): number {
    const previous = this.last
    this.last = { x, y, time }
    if (!previous) return this.current

    // Coalesced samples can share a timestamp; clamp so speed stays finite.
    const elapsed = Math.max(1, time - previous.time)
    const speed = Math.hypot(x - previous.x, y - previous.y) / elapsed
    const target = Math.max(this.options.min, Math.min(1, 1 - speed / this.options.maxSpeed))
    this.current += (target - this.current) * this.options.smoothing
    return this.current
  }
}
