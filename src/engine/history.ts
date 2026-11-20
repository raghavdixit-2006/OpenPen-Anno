import type { InkItem } from './types'

/**
 * Snapshot history. Each undo/redo step stores the item list as an array of
 * shared, immutable annotation objects, so a step costs one array copy, not a
 * copy of every point.
 */
export class InkHistory {
  private past: InkItem[][] = []
  private future: InkItem[][] = []
  private current: InkItem[] = []

  get strokes(): readonly InkItem[] {
    return this.current
  }

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  add(item: InkItem): void {
    this.commit([...this.current, item])
  }

  /** Clears every item. Kept in history so an accidental clear can be undone. */
  clear(): boolean {
    if (this.current.length === 0) return false
    this.commit([])
    return true
  }

  /** Removes items by id as a single undo step (stroke-level erasing). */
  remove(ids: Iterable<string>): boolean {
    const doomed = new Set(ids)
    if (doomed.size === 0) return false

    const next = this.current.filter((item) => !doomed.has(item.id))
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

  private commit(next: InkItem[]): void {
    this.past.push(this.current)
    this.current = next
    // A fresh edit invalidates the redo branch.
    this.future = []
  }
}
