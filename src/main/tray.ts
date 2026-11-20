import {
  app,
  dialog,
  Menu,
  nativeImage,
  screen,
  Tray,
  type MenuItemConstructorOptions,
  type NativeImage
} from 'electron'
import { join } from 'path'
import { IPC, type BackdropMode } from '../shared/ipc'
import { displayLabel, pinDisplay, pinnedDisplayId } from './display'
import { toggleFrozen } from './freeze'
import { sendToOverlay, syncOverlayBounds } from './overlayWindow'
import { requestAnnotatedScreenshot } from './screenshot'
import { getHardwareAcceleration, setHardwareAcceleration } from './settings'
import { getState, onStateChange, patchState } from './state'
import { applyToolbarDock } from './toolbarWindow'
import { checkForUpdates } from './updater'

const BACKDROP_OPTIONS: ReadonlyArray<{ id: BackdropMode; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'white', label: 'Whiteboard' },
  { id: 'black', label: 'Blackboard' },
  { id: 'spotlight', label: 'Spotlight' }
]

/**
 * Tray menu: the toolbar's tertiary surface. It stays reachable even when the
 * toolbar is collapsed behind the screen edge, and it is the only UI for the
 * hardware-acceleration switch.
 */
let tray: Tray | null = null

/** App icon scaled for the notification area (Windows asks for ~20px at 125% DPI). */
function trayIcon(): NativeImage {
  return nativeImage
    .createFromPath(join(app.getAppPath(), 'resources', 'icon.png'))
    .resize({ width: 32, height: 32 })
}

function rebuildMenu(): void {
  tray?.setContextMenu(buildMenu())
}

/** Rebuilds the menu when the monitor layout changes, not just app state. */
export function refreshTrayMenu(): void {
  rebuildMenu()
}

/** Moves both windows onto the newly selected display. */
function applyDisplayChoice(): void {
  syncOverlayBounds()
  applyToolbarDock(getState().dock, getState().collapsed)
  rebuildMenu()
}

function toggleHardwareAcceleration(): void {
  const enabled = !getHardwareAcceleration()
  setHardwareAcceleration(enabled)
  rebuildMenu()
  void dialog
    .showMessageBox({
      type: 'question',
      title: 'Hardware acceleration',
      message: `Hardware acceleration ${enabled ? 'enabled' : 'disabled'}.`,
      detail: 'Restart OpenPen Anno to apply the graphics setting.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    })
    .then(({ response }) => {
      if (response === 0) {
        app.relaunch()
        app.quit()
      }
    })
}

function buildMenu(): Menu {
  const state = getState()
  const template: MenuItemConstructorOptions[] = [
    {
      label: 'Drawing mode',
      type: 'checkbox',
      checked: state.mode === 'draw',
      click: () => patchState({ mode: getState().mode === 'draw' ? 'passthrough' : 'draw' })
    },
    {
      label: 'Backdrop',
      submenu: BACKDROP_OPTIONS.map(({ id, label }) => ({
        label,
        type: 'radio' as const,
        checked: state.backdrop === id,
        click: () => patchState({ backdrop: id })
      }))
    },
    {
      label: 'Freeze frame',
      type: 'checkbox',
      checked: state.frozen,
      click: () => toggleFrozen()
    },
    {
      label: 'Display',
      submenu: [
        {
          label: 'Follow cursor',
          type: 'radio' as const,
          checked: pinnedDisplayId() === null,
          click: () => {
            pinDisplay(null)
            applyDisplayChoice()
          }
        },
        { type: 'separator' },
        ...screen.getAllDisplays().map((display, index) => ({
          label: displayLabel(display, index),
          type: 'radio' as const,
          checked: pinnedDisplayId() === display.id,
          click: () => {
            pinDisplay(display.id)
            applyDisplayChoice()
          }
        }))
      ]
    },
    {
      label: 'Collapse toolbar',
      type: 'checkbox',
      checked: state.collapsed,
      click: () => patchState({ collapsed: !getState().collapsed })
    },
    {
      label: 'Clear all ink',
      enabled: state.canUndo,
      click: () => sendToOverlay(IPC.clear)
    },
    {
      label: 'Save annotated screenshot…',
      click: () => {
        void requestAnnotatedScreenshot()
      }
    },
    { type: 'separator' },
    {
      label: 'Hardware acceleration',
      type: 'checkbox',
      checked: getHardwareAcceleration(),
      click: toggleHardwareAcceleration
    },
    {
      label: 'Check for updates…',
      click: () => {
        void checkForUpdates()
      }
    },
    { type: 'separator' },
    { label: 'Quit OpenPen Anno', click: () => app.quit() }
  ]
  return Menu.buildFromTemplate(template)
}

export function createTray(): void {
  if (tray) return
  tray = new Tray(trayIcon())
  tray.setToolTip('OpenPen Anno')
  rebuildMenu()

  // Checkbox items mirror the toolbar and shortcuts, so the menu is rebuilt
  // from state on every change rather than mutated in place.
  onStateChange(rebuildMenu)

  app.on('will-quit', () => {
    tray?.destroy()
    tray = null
  })
}
