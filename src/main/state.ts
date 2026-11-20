import { BrowserWindow } from 'electron'
import {
  IPC,
  type BackdropMode,
  type DockPosition,
  type EraserMode,
  type HistoryStatus,
  type OverlayMode,
  type OverlayState,
  type ToolId
} from '../shared/ipc'

const state: OverlayState = {
  mode: 'passthrough',
  tool: 'pen',
  color: '#ff2d2d',
  size: 4,
  eraserMode: 'stroke',
  backdrop: 'none',
  frozen: false,
  dock: 'bottom',
  collapsed: false,
  canUndo: false,
  canRedo: false
}

const listeners = new Set<(state: OverlayState) => void>()

export function getState(): OverlayState {
  return state
}

/**
 * Seeds the toolbar preferences from persisted settings. Called once during
 * startup, before any window exists, so there are no listeners to notify and
 * no broadcast to send.
 */
export function hydrateState(
  preferences: Pick<
    OverlayState,
    'tool' | 'color' | 'size' | 'eraserMode' | 'backdrop' | 'dock' | 'collapsed'
  >
): void {
  Object.assign(state, preferences)
}

export function onStateChange(listener: (state: OverlayState) => void): void {
  listeners.add(listener)
}

export function patchState(patch: Partial<OverlayState>): void {
  const changed = (Object.keys(patch) as (keyof OverlayState)[]).some(
    (key) => patch[key] !== undefined && patch[key] !== state[key]
  )
  if (!changed) return

  Object.assign(state, patch)

  // Layout listeners run before the broadcast: they resize the toolbar window
  // (or re-apply the overlay mode). The renderers must never receive a layout
  // change while the window still has its previous bounds, or the first
  // animation frames run at the wrong size and the transition looks broken.
  listeners.forEach((listener) => listener(getState()))

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC.stateChanged, getState())
    }
  }
}

export function applyHistoryStatus(status: HistoryStatus): void {
  patchState({ canUndo: status.canUndo === true, canRedo: status.canRedo === true })
}

export function isOverlayMode(value: unknown): value is OverlayMode {
  return value === 'draw' || value === 'passthrough'
}

export function isToolId(value: unknown): value is ToolId {
  return (
    value === 'pen' ||
    value === 'highlighter' ||
    value === 'eraser' ||
    value === 'text' ||
    value === 'laser' ||
    value === 'stamp' ||
    value === 'line' ||
    value === 'arrow' ||
    value === 'rect' ||
    value === 'ellipse'
  )
}

export function isEraserMode(value: unknown): value is EraserMode {
  return value === 'stroke' || value === 'pixel'
}

export function isBackdrop(value: unknown): value is BackdropMode {
  return value === 'none' || value === 'white' || value === 'black' || value === 'spotlight'
}

export function isDockPosition(value: unknown): value is DockPosition {
  return value === 'bottom' || value === 'top' || value === 'left' || value === 'right'
}

export function normalizeColor(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null
}

export function normalizeSize(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(64, Math.max(1, Math.round(value)))
}

export function isHistoryStatus(value: unknown): value is HistoryStatus {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as HistoryStatus
  return typeof candidate.canUndo === 'boolean' && typeof candidate.canRedo === 'boolean'
}
