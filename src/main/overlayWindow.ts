import { BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { OverlayMode } from '../shared/ipc'
import { getState } from './state'
import { raiseToolbar } from './toolbarWindow'

let overlay: BrowserWindow | null = null

export function getOverlayWindow(): BrowserWindow | null {
  return overlay
}

function loadOverlay(window: BrowserWindow): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/overlay/index.html`)
  } else {
    window.loadFile(join(__dirname, '../renderer/overlay/index.html'))
  }
}

/**
 * Drawing mode: the overlay swallows every click so the pen works everywhere.
 * Passthrough: clicks fall through to whatever app is underneath. The
 * `forward: true` option keeps delivering mouse-move events to this window,
 * which the toolbar hover logic uses later on.
 *
 * Drawing mode deliberately does not call focus(): the overlay receives mouse
 * input while inactive, and not grabbing focus keeps the app underneath
 * keyboard-focused across a draw/passthrough round trip.
 */
export function applyOverlayMode(mode: OverlayMode): void {
  if (!overlay || overlay.isDestroyed()) return

  if (mode === 'draw') {
    overlay.setIgnoreMouseEvents(false)
  } else {
    overlay.setIgnoreMouseEvents(true, { forward: true })
  }
  // Windows sometimes keeps the last transparent frame until something dirties
  // the window; force a repaint after the hit-testing change.
  overlay.webContents.invalidate()
  // The overlay is topmost too; make sure it never covers the toolbar.
  raiseToolbar()
}

/** Keep the overlay exactly on the primary display, in device-independent pixels. */
export function syncOverlayBounds(): void {
  if (!overlay || overlay.isDestroyed()) return
  overlay.setBounds(screen.getPrimaryDisplay().bounds)
}

export function createOverlayWindow(): BrowserWindow {
  const bounds = screen.getPrimaryDisplay().bounds

  // Deliberately not `fullscreen: true`: that mode disables DWM transparency on
  // Windows, so the overlay would paint a solid rectangle over the desktop.
  overlay = new BrowserWindow({
    ...bounds,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    // Drawing must not activate the window: an activated topmost window rises
    // above the toolbar and swallows its clicks. Keyboard shortcuts are global.
    focusable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      backgroundThrottling: false
    }
  })

  overlay.setMenu(null)
  overlay.setAlwaysOnTop(true, 'screen-saver')
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  applyOverlayMode(getState().mode)

  overlay.once('ready-to-show', () => {
    const mode = getState().mode
    applyOverlayMode(mode)
    if (mode === 'draw') overlay!.show()
    else overlay!.showInactive()
    // Windows can clamp the initial window to the work area when it is created
    // frameless and non-resizable. Re-applying the display bounds after the
    // window exists makes the overlay cover the taskbar strip as well.
    syncOverlayBounds()
    raiseToolbar()
  })

  overlay.on('closed', () => {
    overlay = null
  })

  overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  overlay.webContents.on('will-navigate', (event) => event.preventDefault())

  loadOverlay(overlay)
  return overlay
}

export function sendToOverlay(channel: string, ...args: unknown[]): void {
  if (overlay && !overlay.isDestroyed()) {
    overlay.webContents.send(channel, ...args)
  }
}
