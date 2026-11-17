import type { Stroke } from './types'

/**
 * Snapshot history. Each undo/redo step stores the stroke list as an array of
 * shared, immutable Stroke objects, so a step costs one array copy, not a copy
 * of every point.
 */
export class StrokeHistory {
  private past: Stroke[][] = []
  private future: Stroke[][] = []
  private current: Stroke[] = []

  get strokes(): readonly Stroke[] {
    return this.current
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  add(stroke: Stroke): void {
    this.commit([...this.current, stroke])
  }

  /** Clears every stroke. Kept in history so an accidental clear can be undone. */
  clear(): boolean {
    if (this.current.length === 0) return false
    this.commit([])
    return true
  }

  /** Removes strokes by id as a single undo step (stroke-level erasing). */
  remove(ids: Iterable<string>): boolean {
    const doomed = new Set(ids)
    if (doomed.size === 0) return false

    const next = this.current.filter((stroke) => !doomed.has(stroke.id))
    if (next.length === this.current.length) return false

    this.commit(next)
    return true
  }

  undo(): boolean {
    const previous = this.past.pop()
    if (!previous) return false
    this.future.push(this.current)
    this.current = previous
    return true
  }

  redo(): boolean {
    const next = this.future.pop()
    if (!next) return false
    this.past.push(this.current)
    this.current = next
    return true
  }

  private commit(next: Stroke[]): void {
    this.past.push(this.current)
    this.current = next
    // A fresh edit invalidates the redo branch.
    this.future = []
  }
}
