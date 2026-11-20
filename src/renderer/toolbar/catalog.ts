import type {
  BackdropMode,
  DockPosition,
  EraserMode,
  PopoverKind,
  ShapeTool,
  ToolId
} from '../../shared/ipc'
import { isShapeTool } from '../../engine/shape'
import {
  ArrowIcon,
  EllipseIcon,
  EraserIcon,
  HighlighterIcon,
  LaserIcon,
  LineIcon,
  PenIcon,
  RectIcon,
  StampIcon,
  TextIcon,
  type IconComponent
} from './icons'

/**
 * Shared vocabulary for the toolbar rail and its floating options panel. Both
 * renderer entrypoints import from here so a tool, swatch or mode is defined
 * exactly once.
 */

export const PALETTE = [
  '#ff2d2d',
  '#ff8a00',
  '#ffd60a',
  '#34c759',
  '#00c7be',
  '#0a84ff',
  '#bf5af2',
  '#ffffff'
] as const

export const MIN_BRUSH_SIZE = 1
export const MAX_BRUSH_SIZE = 32

export const TOOLS: Array<{ id: ToolId; label: string; Icon: IconComponent }> = [
  { id: 'pen', label: 'Pen', Icon: PenIcon },
  { id: 'highlighter', label: 'Highlighter', Icon: HighlighterIcon },
  { id: 'eraser', label: 'Eraser', Icon: EraserIcon },
  { id: 'text', label: 'Text', Icon: TextIcon },
  { id: 'laser', label: 'Laser pointer', Icon: LaserIcon },
  { id: 'stamp', label: 'Numbered stamp', Icon: StampIcon }
]

export const SHAPE_TOOLS: Array<{ id: ShapeTool; label: string; Icon: IconComponent }> = [
  { id: 'line', label: 'Line', Icon: LineIcon },
  { id: 'arrow', label: 'Arrow', Icon: ArrowIcon },
  { id: 'rect', label: 'Rectangle', Icon: RectIcon },
  { id: 'ellipse', label: 'Ellipse', Icon: EllipseIcon }
]

export interface ToolMenuItem {
  id: ToolId
  /** Full tool name for titles and assistive technology. */
  label: string
  /** Short label that fits the 107px menu cell. */
  menuLabel: string
  Icon: IconComponent
}

/**
 * The ten tools in Tool Menu order. Laser and stamp use their short names in
 * the grid so the cells never wrap; `label` keeps the full name for aria.
 */
export const TOOL_MENU: ToolMenuItem[] = [
  ...TOOLS.map(({ id, label, Icon }) => ({
    id,
    label,
    menuLabel: id === 'laser' ? 'Laser' : id === 'stamp' ? 'Stamp' : label,
    Icon
  })),
  ...SHAPE_TOOLS.map(({ id, label, Icon }) => ({
    id,
    label,
    menuLabel: label,
    Icon
  }))
]

export const ERASER_MODES: Array<{ id: EraserMode; label: string; title: string }> = [
  { id: 'stroke', label: 'Stroke', title: 'Erase whole strokes' },
  { id: 'pixel', label: 'Pixel', title: 'Erase individual pixels' }
]

/** Cycle order for the single backdrop button. */
export const BACKDROP_ORDER: readonly BackdropMode[] = ['none', 'white', 'black', 'spotlight']

export const BACKDROP_LABELS: Record<BackdropMode, string> = {
  none: 'None',
  white: 'Whiteboard',
  black: 'Blackboard',
  spotlight: 'Spotlight'
}

export function nextBackdrop(mode: BackdropMode): BackdropMode {
  const index = BACKDROP_ORDER.indexOf(mode)
  return BACKDROP_ORDER[(index + 1) % BACKDROP_ORDER.length]
}

export const DOCK_OPTIONS: Array<{ id: DockPosition; label: string }> = [
  { id: 'bottom', label: 'Dock at the bottom' },
  { id: 'top', label: 'Dock at the top' },
  { id: 'left', label: 'Dock on the left' },
  { id: 'right', label: 'Dock on the right' }
]

/**
 * Which options panel a tool opens, if any. The laser has no colour or size;
 * shape tools share the picker panel so a new shape and its style live
 * together.
 */
export function optionsKindFor(tool: ToolId): PopoverKind | null {
  if (tool === 'laser') return null
  return isShapeTool(tool) ? 'shapes' : 'tool'
}
