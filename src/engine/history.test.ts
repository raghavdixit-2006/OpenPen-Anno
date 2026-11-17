import { beforeEach, describe, expect, it } from 'vitest'
import { StrokeHistory } from './history'
import { createStroke } from './stroke'
import type { Point, Stroke } from './types'

const point = (x: number, y: number): Point => ({ x, y, pressure: 0.5 })

function makeStroke(label: number): Stroke {
  return createStroke([point(label, label)])
}

describe('StrokeHistory', () => {
  let history: StrokeHistory
  let a: Stroke
  let b: Stroke
  let c: Stroke

  beforeEach(() => {
    history = new StrokeHistory()
    a = makeStroke(1)
    b = makeStroke(2)
    c = makeStroke(3)
  })

  it('starts empty', () => {
    expect(history.strokes).toEqual([])
    expect(history.canUndo).toBe(false)
    expect(history.canRedo).toBe(false)
  })

  it('appends strokes in order', () => {
    history.add(a)
    history.add(b)
    expect(history.strokes).toEqual([a, b])
    expect(history.canUndo).toBe(true)
  })

  it('undoes and redoes in stack order', () => {
    history.add(a)
    history.add(b)
    history.add(c)

    expect(history.undo()).toBe(true)
    expect(history.strokes).toEqual([a, b])
    expect(history.undo()).toBe(true)
    expect(history.strokes).toEqual([a])

    expect(history.redo()).toBe(true)
    expect(history.strokes).toEqual([a, b])
    expect(history.redo()).toBe(true)
    expect(history.strokes).toEqual([a, b, c])
  })

  it('reports when there is nothing to undo or redo', () => {
    expect(history.undo()).toBe(false)
    expect(history.redo()).toBe(false)
    history.add(a)
    expect(history.redo()).toBe(false)
    history.undo()
    expect(history.undo()).toBe(false)
  })

  it('drops the redo branch after a new edit', () => {
    history.add(a)
    history.undo()
    expect(history.canRedo).toBe(true)

    history.add(b)

    expect(history.canRedo).toBe(false)
    expect(history.redo()).toBe(false)
    expect(history.strokes).toEqual([b])
  })

  it('clears all strokes and lets the clear be undone', () => {
    history.add(a)
    history.add(b)

    expect(history.clear()).toBe(true)
    expect(history.strokes).toEqual([])
    expect(history.canRedo).toBe(false)

    expect(history.undo()).toBe(true)
    expect(history.strokes).toEqual([a, b])
  })

  it('does not record a clear when already empty', () => {
    expect(history.clear()).toBe(false)
    expect(history.canUndo).toBe(false)
  })

  it('never mutates previously read snapshots', () => {
    history.add(a)
    const snapshot = history.strokes

    history.add(b)
    history.undo()

    expect(snapshot).toEqual([a])
    expect(history.strokes).toEqual([a])
  })

  it('removes strokes by id as one undo step', () => {
    history.add(a)
    history.add(b)
    history.add(c)

    expect(history.remove([a.id, c.id])).toBe(true)
    expect(history.strokes).toEqual([b])

    expect(history.undo()).toBe(true)
    expect(history.strokes).toEqual([a, b, c])
  })

  it('ignores unknown ids and empty removals', () => {
    history.add(a)

    expect(history.remove([])).toBe(false)
    expect(history.remove(['missing'])).toBe(false)
    expect(history.canUndo).toBe(true)
    expect(history.strokes).toEqual([a])
  })
})
