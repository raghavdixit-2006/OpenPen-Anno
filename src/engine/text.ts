import type { Bounds, Point, TextItem, TextStyle } from './types'

/** Line box as a multiple of the font size. */
export const TEXT_LINE_HEIGHT = 1.25

/**
 * Brush size (1..64) to a readable font size. The default brush size of 4
 * lands on 16 px, and the largest brush stops at 96 px.
 */
export function textFontSize(size: number): number {
  return Math.min(96, Math.max(12, Math.round(size * 4)))
}

/** Normalizes newlines and trims surrounding whitespace. */
export function normalizeText(text: string): string {
  return text.replace(/\r\n?/g, '\n').trim()
}

let nextTextId = 0

export function createTextItem(text: string, x: number, y: number, style: TextStyle): TextItem {
  return {
    id: `text-${++nextTextId}`,
    kind: 'text',
    x,
    y,
    text: normalizeText(text),
    style: { ...style }
  }
}

export function getTextLines(item: TextItem): string[] {
  return item.text.split('\n')
}

/**
 * Bounds are estimated without a canvas so the engine stays renderer-free.
 * The estimate is deliberately generous (0.75 em per character) because
 * underestimating would leave glyph pixels behind on a region repaint.
 */
export function getTextBounds(item: TextItem): Bounds | null {
  if (item.text.length === 0) return null

  const lines = getTextLines(item)
  let longest = 0
  for (const line of lines) {
    if (line.length > longest) longest = line.length
  }

  const { fontSize } = item.style
  const width = longest * fontSize * 0.75 + 8
  const height = lines.length * fontSize * TEXT_LINE_HEIGHT + 4

  return { minX: item.x - 4, minY: item.y - 2, maxX: item.x + width, maxY: item.y + height }
}

/** Whole-item hit test: text erases when the eraser touches its box. */
export function hitTestText(item: TextItem, point: Point, radius: number): boolean {
  const bounds = getTextBounds(item)
  if (!bounds) return false
  const reach = Math.max(0, radius)
  return (
    point.x >= bounds.minX - reach &&
    point.x <= bounds.maxX + reach &&
    point.y >= bounds.minY - reach &&
    point.y <= bounds.maxY + reach
  )
}

export function paintText(ctx: CanvasRenderingContext2D, item: TextItem): void {
  if (item.text.length === 0) return

  const { style } = item
  ctx.save()
  ctx.globalAlpha = style.opacity
  ctx.fillStyle = style.color
  ctx.font = `600 ${style.fontSize}px "Segoe UI", system-ui, sans-serif`
  ctx.textBaseline = 'top'

  const lines = getTextLines(item)
  const lineHeight = style.fontSize * TEXT_LINE_HEIGHT
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], item.x, item.y + i * lineHeight)
  }

  ctx.restore()
}
