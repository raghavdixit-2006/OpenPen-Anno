export interface Point {
  readonly x: number
  readonly y: number
  readonly pressure: number
}

export type PenTool = 'pen' | 'highlighter'

/** Geometric tools that drag out a shape instead of recording a path. */
export type ShapeTool = 'line' | 'arrow' | 'rect' | 'ellipse'

/** Full-screen presentation backdrops; spotlight dims outside the cursor. */
export type BackdropMode = 'none' | 'white' | 'black' | 'spotlight'

/** Common fields every committed annotation item carries. */
export interface InkItemBase {
  readonly id: string
  /** Discriminator for the item union; shapes/text/stamps/erasers add cases. */
  readonly kind: string
}

export interface ShapeStyle {
  readonly color: string
  /** Stroke width in CSS pixels. */
  readonly width: number
  /** 0..1, applied as globalAlpha. */
  readonly opacity: number
}

export interface TextStyle {
  readonly color: string
  readonly fontSize: number
  /** 0..1, applied as globalAlpha. */
  readonly opacity: number
}

export interface StampStyle {
  readonly color: string
  /** 0..1, applied as globalAlpha. */
  readonly opacity: number
}

export interface StrokeStyle {
  readonly tool: PenTool
  readonly color: string
  /** CSS pixels. The highlighter derives its wider nib from this at render time. */
  readonly width: number
  /** 0..1, applied as globalAlpha. */
  readonly opacity: number
}

/**
 * A finished freehand stroke. Points are stored as vectors so the same model
 * can drive undo/redo, stroke-level erasing and a future web build.
 */
export interface Stroke extends InkItemBase {
  readonly kind: 'freehand'
  readonly points: readonly Point[]
  readonly style: StrokeStyle
}

/**
 * A two-corner geometric annotation. `start` is where the drag began and
 * `end` is where it finished; the renderer normalizes the box for rects and
 * ellipses, so the user can drag in any direction.
 */
export interface Shape extends InkItemBase {
  readonly kind: 'shape'
  readonly tool: ShapeTool
  readonly start: Point
  readonly end: Point
  readonly style: ShapeStyle
}

/**
 * A pixel-level eraser swipe. It is a history item, not a deletion: replaying
 * the list paints it with `destination-out` at exactly the same place, so undo
 * and redo reproduce the erased holes.
 */
export interface EraserStroke extends InkItemBase {
  readonly kind: 'eraser'
  readonly points: readonly Point[]
  readonly radius: number
}

/** A typed annotation anchored at its top-left corner. */
export interface TextItem extends InkItemBase {
  readonly kind: 'text'
  readonly x: number
  readonly y: number
  readonly text: string
  readonly style: TextStyle
}

/** A numbered presentation badge. The index is fixed when it is committed. */
export interface StampItem extends InkItemBase {
  readonly kind: 'stamp'
  readonly index: number
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly style: StampStyle
}

/** Everything snapshot history can hold. */
export type InkItem = Stroke | Shape | EraserStroke | TextItem | StampItem

export interface Bounds {
  readonly minX: number
  readonly minY: number
  readonly maxX: number
  readonly maxY: number
}
