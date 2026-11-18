import { BrowserWindow, screen, type Rectangle } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { DockPosition } from '../shared/ipc'
import { getState, patchState } from './state'

/**
 * Horizontal docks (bottom/top) are wide and short; side docks (left/right) are
 * narrow and tall. The window is transparent, so its size only needs to fit the
 * dock surface plus a shadow margin.
 */
const DOCK_SIZE = {
  horizontal: { width: 920, height: 80 },
  // Wide enough to keep a shadow margin around the 88px bar surface (8px
  // inset on each side).
  vertical: { width: 104, height: 680 }
} as const

/**
 * Collapsed toolbar: a single glassy circular handle at the screen edge — a
 * 56px circle centred in a uniform 64×64 DIP window (4px inset from the edge).
 * One size serves all four docks, and the window stays centred on the same
 * edge line as the expanded bar, so the crossfade hand-off never jumps.
 */
const COLLAPSED_SIZE = { width: 64, height: 64 } as const

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

/** Centres the dock (or the collapsed glassy handle) flush on the requested edge of the work area. */
function dockBounds(dock: DockPosition, collapsed: boolean): Rectangle {
  const { workArea } = screen.getPrimaryDisplay()
  const isVertical = dock === 'left' || dock === 'right'
  const { width, height } = collapsed
    ? COLLAPSED_SIZE
    : isVertical
      ? DOCK_SIZE.vertical
      : DOCK_SIZE.horizontal

  const centredX = workArea.x + Math.round((workArea.width - width) / 2)
  const centredY = workArea.y + Math.round((workArea.height - height) / 2)

  switch (dock) {
    case 'top':
      return { x: centredX, y: workArea.y, width, height }
    case 'left':
      return { x: workArea.x, y: centredY, width, height }
    case 'right':
      return { x: workArea.x + workArea.width - width, y: centredY, width, height }
    default:
      return { x: centredX, y: workArea.y + workArea.height - height, width, height }
  }
}

/**
 * Re-bounds the toolbar for the current dock side and collapsed state. Called
 * on layout changes and whenever the display layout changes; the renderer
 * reflows on the same state broadcast, so it already knows which shape it is
 * being resized into.
 */
export function applyToolbarDock(dock: DockPosition, collapsed: boolean): void {
  if (!toolbar || toolbar.isDestroyed()) return
  toolbar.setBounds(dockBounds(dock, collapsed))
  raiseToolbar()
}

/** Edge whose boundary is closest to the window's centre. */
function nearestEdge(): DockPosition {
  const bounds = toolbar?.getBounds()
  const { workArea } = screen.getPrimaryDisplay()
  if (!bounds) return getState().dock
  const centreX = bounds.x + bounds.width / 2
  const centreY = bounds.y + bounds.height / 2
  const distances: Array<[DockPosition, number]> = [
    ['top', centreY - workArea.y],
    ['bottom', workArea.y + workArea.height - centreY],
    ['left', centreX - workArea.x],
    ['right', workArea.x + workArea.width - centreX]
  ]
  let best = distances[0]
  for (const entry of distances) {
    if (entry[1] < best[1]) best = entry
  }
  return best[0]
}

/**
 * Re-docks a natively dragged toolbar to its nearest edge with exactly ONE
 * bounds change. Native dragging (`-webkit-app-region` on the handle) moves
 * the window entirely on the OS side — the main process never touches the
 * bounds during the gesture. When the move loop ends (the `moved` event), the
 * window is placed on its edge in a single step: a dock change patches state
 * so the subscriber re-applies exact bounds, otherwise the position is set
 * directly. No intervals, no per-frame resizing.
 */
export function snapToolbarToEdge(): void {
  if (!toolbar || toolbar.isDestroyed()) return

  const edge = nearestEdge()
  const state = getState()

  if (state.dock !== edge) {
    // The dock-change subscriber re-bounds the window synchronously, so the
    // orientation swap and the reposition land in the same tick.
    patchState({ dock: edge })
    return
  }

  const target = dockBounds(edge, state.collapsed)
  const current = toolbar.getBounds()
  if (current.x !== target.x || current.y !== target.y) toolbar.setBounds(target)
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
  const { dock, collapsed } = getState()
  const bounds = dockBounds(dock, collapsed)

  toolbar = new BrowserWindow({
    ...bounds,
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    // No native frame chrome at all: thickFrame would give the window a
    // WS_THICKFRAME sizing frame, which Windows renders as a translucent
    // sheet over a transparent window while its bounds are changing.
    thickFrame: false,
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

  // The handle regions drag the window natively (no JS, no IPC, no bounds
  // writes during the gesture). `moved` fires once when that native move loop
  // ends — the moment to re-dock, in a single bounds change.
  toolbar.on('moved', () => {
    if (toolbar && !toolbar.isDestroyed()) snapToolbarToEdge()
  })

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
