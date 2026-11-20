import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { OverlayMode } from '../shared/ipc'
import { activeDisplay } from './display'
import { guardNavigation } from './navigation'
import { getState } from './state'
import { raiseToolbar } from './toolbarWindow'

let overlay: BrowserWindow | null = null
/**
 * Scale factor of the display the overlay was last sized for. Kept next to
 * the window so `syncOverlayBounds` can tell a real display move from a
 * mode switch that leaves the geometry untouched.
 */
let overlayScaleFactor = 1

/**
 * The overlay is intentionally never fully opaque.
 *
 * Chromium's Windows occlusion tracker (`gfx::IsWindowVisibleAndFullyOpaque`)
 * ignores a window only when it has `WS_EX_TRANSPARENT`, or when it is
 * `WS_EX_LAYERED` with an alpha below 255. Electron's `setIgnoreMouseEvents`
 * strips both bits when clicks are enabled for drawing, so a full-screen
 * topmost overlay starts looking like an opaque cover: Chrome/Electron apps
 * underneath conclude they are occluded and stop painting their GPU content
 * (the video/preview pane goes black). Keeping the window layered at 99%
 * makes Chromium skip it during occlusion checks while leaving the mouse
 * fully interactive.
 *
 * This must be set once, before the first mode application. Electron
 * remembers that the window is layered (`layered_`) and re-applies
 * `WS_EX_LAYERED` after every subsequent `setIgnoreMouseEvents` call.
 */
const OVERLAY_OPACITY = 0.99

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
    // Follow the cursor onto whichever monitor the user is annotating before
    // the window starts swallowing clicks. Re-bounding also makes Chromium
    // re-read the display scale factor, so mixed-DPI desktops render at the
    // right backing-store size.
    syncOverlayBounds()
    overlay.setIgnoreMouseEvents(false)
  } else {
    overlay.setIgnoreMouseEvents(true, { forward: true })
  }
  // Re-assert the transparent surface on every mode flip; the window must
  // never composite an opaque background. This is only a safety net: the
  // real occlusion fix is `OVERLAY_OPACITY` on the window (see its comment).
  overlay.setBackgroundColor('#00000000')
  // The overlay is topmost too; make sure it never covers the toolbar. This
  // also re-runs the toolbar's cursor hit test, so the mode button stays
  // clickable even if no forwarded mouse event ever arrives.
  raiseToolbar()
}

/**
 * Keep the overlay exactly on the active display, in device-independent pixels.
 *
 * Resizing a display-sized transparent topmost window forces DWM to rebuild
 * its composition surface; over a GPU-composited window underneath, that
 * rebuild can briefly composite as opaque black. Mode switches usually stay on
 * the same display, so identical bounds + scale are a no-op.
 *
 * `force` is reserved for startup: Windows can clamp a frameless full-height
 * window to the work area before Chromium sees the real rect, so the first
 * ready-to-show pass must re-apply the display bounds even if they look equal.
 */
export function syncOverlayBounds(force = false): void {
  if (!overlay || overlay.isDestroyed()) return

  const display = activeDisplay()
  const target = display.bounds
  const current = overlay.getBounds()
  const unchanged =
    current.x === target.x &&
    current.y === target.y &&
    current.width === target.width &&
    current.height === target.height &&
    overlayScaleFactor === display.scaleFactor
  if (unchanged && !force) return

  overlay.setBounds(target)
  overlayScaleFactor = display.scaleFactor
}

export function createOverlayWindow(): BrowserWindow {
  const display = activeDisplay()
  const bounds = display.bounds

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
    // No WS_THICKFRAME sizing frame. On a frameless transparent window that
    // frame is composited as a translucent sheet while bounds change, and its
    // presence makes DWM surface rebuilds more visible.
    thickFrame: false,
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
  // Must run before the first `applyOverlayMode`: it marks the window layered
  // so draw mode's `setIgnoreMouseEvents(false)` no longer strips
  // `WS_EX_LAYERED`, which is what stops Chromium windows underneath from
  // treating this topmost full-screen window as an opaque occluder.
  overlay.setOpacity(OVERLAY_OPACITY)
  overlayScaleFactor = display.scaleFactor
  applyOverlayMode(getState().mode)

  overlay.once('ready-to-show', () => {
    const mode = getState().mode
    applyOverlayMode(mode)
    if (mode === 'draw') overlay!.show()
    else overlay!.showInactive()
    // Windows can clamp the initial window to the work area when it is created
    // frameless and non-resizable. Re-applying the display bounds after the
    // window exists makes the overlay cover the taskbar strip as well. Forced
    // so the clamp is repaired even if `getBounds()` reports the target rect.
    syncOverlayBounds(true)
    raiseToolbar()
  })

  overlay.on('closed', () => {
    overlay = null
    overlayScaleFactor = 1
  })

  overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  guardNavigation(overlay.webContents)

  loadOverlay(overlay)
  return overlay
}

export function sendToOverlay(channel: string, ...args: unknown[]): void {
  if (overlay && !overlay.isDestroyed()) {
    overlay.webContents.send(channel, ...args)
  }
}
