import type ElectronStore from 'electron-store'
import { app } from 'electron'
import { copyFileSync, existsSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import type { BackdropMode, DockPosition, EraserMode, ToolId } from '../shared/ipc'
import {
  isBackdrop,
  isDockPosition,
  isEraserMode,
  isToolId,
  normalizeColor,
  normalizeSize
} from './state'

/**
 * Persisted user settings (electron-store, JSON under the app's userData
 * directory). Only preferences live here; transient state is deliberately
 * not persisted:
 *
 * - `mode` always starts as `passthrough`, so a restart never leaves the
 *   overlay swallowing every click.
 * - `hardwareAcceleration` is read before `app.whenReady()` because Electron
 *   only honours `app.disableHardwareAcceleration()` before the first window;
 *   flipping it therefore needs a restart.
 */
export interface PersistedSettings {
  tool: ToolId
  color: string
  size: number
  eraserMode: EraserMode
  backdrop: BackdropMode
  dock: DockPosition
  collapsed: boolean
  hardwareAcceleration: boolean
}

export const DEFAULT_SETTINGS: PersistedSettings = {
  tool: 'pen',
  color: '#ff2d2d',
  size: 4,
  eraserMode: 'stroke',
  backdrop: 'none',
  dock: 'bottom',
  collapsed: false,
  hardwareAcceleration: true
}

/** Preferences written back while the app runs. */
export type ToolbarSettings = Pick<
  PersistedSettings,
  'tool' | 'color' | 'size' | 'eraserMode' | 'backdrop' | 'dock' | 'collapsed'
>

let store: ElectronStore<PersistedSettings> | null = null
let current: PersistedSettings = { ...DEFAULT_SETTINGS }
let pending: Partial<ToolbarSettings> = {}
let saveTimer: NodeJS.Timeout | null = null

function sanitize(raw: Partial<PersistedSettings>): PersistedSettings {
  return {
    tool: isToolId(raw.tool) ? raw.tool : DEFAULT_SETTINGS.tool,
    color: normalizeColor(raw.color) ?? DEFAULT_SETTINGS.color,
    size: normalizeSize(raw.size) ?? DEFAULT_SETTINGS.size,
    eraserMode: isEraserMode(raw.eraserMode) ? raw.eraserMode : DEFAULT_SETTINGS.eraserMode,
    backdrop: isBackdrop(raw.backdrop) ? raw.backdrop : DEFAULT_SETTINGS.backdrop,
    dock: isDockPosition(raw.dock) ? raw.dock : DEFAULT_SETTINGS.dock,
    collapsed: typeof raw.collapsed === 'boolean' ? raw.collapsed : DEFAULT_SETTINGS.collapsed,
    hardwareAcceleration:
      typeof raw.hardwareAcceleration === 'boolean'
        ? raw.hardwareAcceleration
        : DEFAULT_SETTINGS.hardwareAcceleration
  }
}

/**
 * Copies the old InkSpace settings file into the new userData directory the
 * first time OpenPen Anno starts. The old folder is left untouched so a
 * rollback still finds its settings. Never overwrites newer settings.
 */
function migrateLegacySettings(): void {
  const destination = join(app.getPath('userData'), 'settings.json')
  if (existsSync(destination)) return

  const appData = app.getPath('appData')
  const legacyFiles = ['inkspace', 'InkSpace'].map((name) => join(appData, name, 'settings.json'))

  for (const source of legacyFiles) {
    if (!existsSync(source)) continue
    try {
      mkdirSync(dirname(destination), { recursive: true })
      copyFileSync(source, destination)
      console.log(`[openpen-anno] migrated settings from ${source}`)
    } catch (error) {
      console.error('[openpen-anno] could not migrate settings', error)
    }
    return
  }
}

/**
 * Loads the persisted settings. electron-store 12 is ESM-only while the main
 * bundle is CommonJS, so the module is imported dynamically. Must run before
 * any window is created: it both decides the hardware-acceleration flag and
 * hydrates the toolbar preferences.
 */
export async function loadSettings(): Promise<PersistedSettings> {
  migrateLegacySettings()
  try {
    const { default: Store } = await import('electron-store')
    store = new Store<PersistedSettings>({ name: 'settings', defaults: DEFAULT_SETTINGS })
    current = sanitize(store.store)
  } catch (error) {
    // A corrupt settings file must never stop the overlay from starting.
    console.error('[openpen-anno] could not read settings, using defaults', error)
    store = null
    current = { ...DEFAULT_SETTINGS }
  }
  return current
}

export function getHardwareAcceleration(): boolean {
  return current.hardwareAcceleration
}

/** Takes effect on the next start; the tray offers to restart immediately. */
export function setHardwareAcceleration(enabled: boolean): void {
  current = { ...current, hardwareAcceleration: enabled }
  store?.set('hardwareAcceleration', enabled)
}

/**
 * Debounced write: the size slider fires a change per step, and every write
 * is a full JSON file rewrite.
 */
export function saveToolbarSettings(patch: ToolbarSettings): void {
  pending = { ...pending, ...patch }
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(flushSettings, 250)
}

/** Synchronous flush; `before-quit` calls this so no change is lost. */
export function flushSettings(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!store) return
  for (const key of Object.keys(pending) as (keyof ToolbarSettings)[]) {
    const value = pending[key]
    if (value !== undefined) store.set(key, value)
  }
  pending = {}
}
