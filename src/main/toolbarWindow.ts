import { BrowserWindow, screen, type Rectangle } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { DockPosition } from '../shared/ipc'
import { getState } from './state'

/**
 * Horizontal docks (bottom/top) are wide and short; side docks (left/right) are
 * narrow and tall. The window is transparent, so its size only needs to fit the
 * dock surface plus the drag margin.
 */
const DOCK_SIZE = {
  horizontal: { width: 920, height: 80 },
  vertical: { width: 88, height: 680 }
} as const

const EDGE_MARGIN = 20

let toolbar: BrowserWindow | null = null

export function getToolbarWindow(): BrowserWindow | null {
  return toolbar
}

/**
 * Both windows are topmost at the `screen-saver` level, so whichever was
 * raised last wins. The overlay must stay below the toolbar or it would
 * swallow clicks on the controls while drawing.
 */
export function raiseToolbar(): void {
  if (toolbar && !toolbar.isDestroyed()) toolbar.moveTop()
}

/** Centres the dock on the requested edge of the work area. */
function dockBounds(dock: DockPosition): Rectangle {
  const { workArea } = screen.getPrimaryDisplay()
  const isVertical = dock === 'left' || dock === 'right'
  const { width, height } = isVertical ? DOCK_SIZE.vertical : DOCK_SIZE.horizontal

  const centredX = workArea.x + Math.round((workArea.width - width) / 2)
  const centredY = workArea.y + Math.round((workArea.height - height) / 2)
  const rightX = workArea.x + workArea.width - width - EDGE_MARGIN
  const bottomY = workArea.y + workArea.height - height - EDGE_MARGIN

  switch (dock) {
    case 'top':
      return { x: centredX, y: workArea.y + EDGE_MARGIN, width, height }
    case 'left':
      return { x: workArea.x + EDGE_MARGIN, y: centredY, width, height }
    case 'right':
      return { x: rightX, y: centredY, width, height }
    default:
      return { x: centredX, y: bottomY, width, height }
  }
}

/**
 * Re-bounds the toolbar for the current dock side. Called on dock changes and
 * whenever the display layout changes; the renderer reflows on the same state
 * broadcast, so it already knows which orientation it is being resized into.
 */
export function applyToolbarDock(dock: DockPosition): void {
  if (!toolbar || toolbar.isDestroyed()) return
  toolbar.setBounds(dockBounds(dock))
  raiseToolbar()
}

function loadToolbar(window: BrowserWindow): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/toolbar/index.html`)
  } else {
    window.loadFile(join(__dirname, '../renderer/toolbar/index.html'))
  }
}

/**
 * The toolbar is its own always-on-top window. Because it never sets
 * ignoreMouseEvents, it stays clickable while the overlay is in passthrough;
 * the overlay ignores the pointer and the click lands on this window instead.
 */
export function createToolbarWindow(): BrowserWindow {
  const bounds = dockBounds(getState().dock)

  toolbar = new BrowserWindow({
    ...bounds,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
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

  toolbar.setMenu(null)
  toolbar.setAlwaysOnTop(true, 'screen-saver')
  toolbar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  toolbar.once('ready-to-show', () => {
    toolbar?.showInactive()
    // Both windows sit at the same topmost level; whichever was raised last
    // wins, so make sure the toolbar is above the overlay it controls.
    toolbar?.moveTop()
  })

  toolbar.on('closed', () => {
    toolbar = null
  })

  toolbar.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  toolbar.webContents.on('will-navigate', (event) => event.preventDefault())

  loadToolbar(toolbar)
  return toolbar
}
