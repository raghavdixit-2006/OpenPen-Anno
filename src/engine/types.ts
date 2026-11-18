export interface Point {
  readonly x: number
  readonly y: number
  readonly pressure: number
}

export type PenTool = 'pen' | 'highlighter'

export interface StrokeStyle {
  readonly tool: PenTool
  readonly color: string
  /** CSS pixels. The highlighter derives its wider nib from this at render time. */
  readonly width: number
  /** 0..1, applied as globalAlpha. */
  readonly opacity: number
}

/**
 * A finished stroke. Points are stored as vectors so the same model can drive
 * undo/redo, stroke-level erasing and a future web build.
 */
export interface Stroke {
  readonly id: string
  readonly points: readonly Point[]
  readonly style: StrokeStyle
}

export interface Bounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}
