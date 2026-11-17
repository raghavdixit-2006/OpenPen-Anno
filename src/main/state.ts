import { BrowserWindow } from 'electron'
import {
  IPC,
  type DockPosition,
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
  dock: 'bottom',
  canUndo: false,
  canRedo: false
}

const listeners = new Set<(state: OverlayState) => void>()

export function getState(): OverlayState {
  return state
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

  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC.stateChanged, getState())
    }
  }

  listeners.forEach((listener) => listener(getState()))
}

export function applyHistoryStatus(status: HistoryStatus): void {
  patchState({ canUndo: status.canUndo === true, canRedo: status.canRedo === true })
}

export function isOverlayMode(value: unknown): value is OverlayMode {
  return value === 'draw' || value === 'passthrough'
}

export function isToolId(value: unknown): value is ToolId {
  return value === 'pen' || value === 'highlighter' || value === 'eraser'
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
