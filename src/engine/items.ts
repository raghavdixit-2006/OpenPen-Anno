import { getEraserBounds } from './eraser'
import { getShapeBounds, hitTestShape } from './shape'
import { getStampBounds, hitTestStamp } from './stamp'
import { getStrokeBounds, hitTestStroke } from './stroke'
import { getTextBounds, hitTestText } from './text'
import type { Bounds, InkItem, Point } from './types'

/**
 * Item-level dispatch for the parts of the engine that do not care which kind
 * of annotation they are handling. New item kinds add a branch here; callers
 * keep using `InkItem` and never switch on `kind` themselves.
 */
export function getItemBounds(item: InkItem): Bounds | null {
  if (item.kind === 'freehand') return getStrokeBounds(item)
  if (item.kind === 'shape') return getShapeBounds(item)
  if (item.kind === 'eraser') return getEraserBounds(item)
  if (item.kind === 'text') return getTextBounds(item)
  if (item.kind === 'stamp') return getStampBounds(item)
  return null
}

/**
 * Stroke-level hit testing for the eraser. Shape/text/stamp branches arrive
 * with their item kinds; unsupported kinds deliberately never hit.
 */
export function hitTestItem(item: InkItem, point: Point, radius: number): boolean {
  if (item.kind === 'freehand') return hitTestStroke(item, point, radius)
  if (item.kind === 'shape') return hitTestShape(item, point, radius)
  if (item.kind === 'text') return hitTestText(item, point, radius)
  if (item.kind === 'stamp') return hitTestStamp(item, point, radius)
  return false
}
