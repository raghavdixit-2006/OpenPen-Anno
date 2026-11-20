import { describe, expect, it } from 'vitest'
import {
  TEXT_LINE_HEIGHT,
  createTextItem,
  getTextBounds,
  getTextLines,
  hitTestText,
  normalizeText,
  textFontSize
} from './text'
import type { Point, TextStyle } from './types'

const point = (x: number, y: number): Point => ({ x, y, pressure: 0.5 })
const style: TextStyle = { color: '#ffffff', fontSize: 20, opacity: 1 }

describe('textFontSize', () => {
  it('maps the brush slider to a readable range', () => {
    expect(textFontSize(4)).toBe(16)
    expect(textFontSize(1)).toBe(12)
    expect(textFontSize(64)).toBe(96)
  })
})

describe('normalizeText', () => {
  it('unifies newlines and trims the edges', () => {
    expect(normalizeText('  hello\r\nworld\r  ')).toBe('hello\nworld')
  })
})

describe('createTextItem', () => {
  it('copies the style and keeps blank interior lines', () => {
    const item = createTextItem('  first\r\n\r\nsecond  ', 10, 20, style)

    expect(item.kind).toBe('text')
    expect(item.text).toBe('first\n\nsecond')
    expect(item.style).toEqual(style)
    expect(item.style).not.toBe(style)
    expect(getTextLines(item)).toEqual(['first', '', 'second'])
  })
})

describe('getTextBounds', () => {
  it('estimates a generous box for one line', () => {
    const item = createTextItem('Hi', 10, 20, style)
    // 2 chars × 20px × 0.75 + 8 padding; one 25px line + 4 padding.
    expect(getTextBounds(item)).toEqual({ minX: 6, minY: 18, maxX: 48, maxY: 49 })
  })

  it('grows with the longest line and the line count', () => {
    const item = createTextItem('Hi\nthere', 10, 20, style)
    const bounds = getTextBounds(item)

    expect(bounds?.maxX).toBe(10 + (5 * 20 * 0.75 + 8))
    expect(bounds?.maxY).toBe(20 + (2 * 20 * TEXT_LINE_HEIGHT + 4))
  })

  it('has no bounds when the text is blank', () => {
    expect(getTextBounds(createTextItem('   ', 0, 0, style))).toBeNull()
  })
})

describe('hitTestText', () => {
  it('hits anywhere in the text box and respects the eraser radius', () => {
    const item = createTextItem('Hi', 10, 20, style)

    expect(hitTestText(item, point(20, 30), 0)).toBe(true)
    expect(hitTestText(item, point(200, 30), 0)).toBe(false)
    expect(hitTestText(item, point(54, 30), 8)).toBe(true)
  })
})
