import { BrowserWindow, screen, type Point, type Rectangle } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { DockPosition, ToolbarRegion } from '../shared/ipc'
import { activeDisplay } from './display'
import { guardNavigation } from './navigation'
import { getState, patchState } from './state'

/** Space between the docked window edge and the visible bar surface (`p-2`). */
const DOCK_INSET = 8

/**
 * Horizontal docks (bottom/top) are wide and short; side docks (left/right) are
 * an ultra-thin single column. The long axis is the visible rail. The extra
 * cross-axis size is inward-facing transparent headroom for the hover Tool
 * Menu; it is not part of the bar.
 */
const DOCK_SIZE = {
  horizontal: { width: 832, height: 290 },
  // 56px single-column rail + 272px inward headroom for the 236px Tool Menu.
  vertical: { width: 328, height: 580 }
} as const

/** The visible rail surface inside the expanded window. */
const BAR_SIZE = {
  horizontal: {
    width: DOCK_SIZE.horizontal.width - DOCK_INSET * 2,
    height: 44
  },
  vertical: {
    width: 56,
    height: DOCK_SIZE.vertical.height - DOCK_INSET * 2
  }
} as const

/**
 * Collapsed toolbar: a 48px rounded-square glass tab that tucks behind the
 * screen edge (12px sliver visible, pops out on hover). The uniform 64×64 DIP
 * window holds the popped tab plus shadow room; one size serves all four
 * docks, and the window stays centred on the same edge line as the expanded
 * bar, so the crossfade hand-off never jumps.
 */
const COLLAPSED_SIZE = { width: 64, height: 64 } as const

/**
 * How often main re-checks the OS cursor against the toolbar's painted
 * regions. Chromium's forwarded mouse-move hook is the low-latency path, but
 * Windows can drop those events (or suspend the hook) while an elevated window
 * has focus; the poll is the safety net that guarantees the clicks come back.
 */
const REGION_POLL_MS = 40

/** Defensive cap: the toolbar has a bar, a menu and a collapsed tab. */
const MAX_TOOLBAR_REGIONS = 8

let toolbar: BrowserWindow | null = null
let toolbarInteractive = false
/** Painted UI boxes in window CSS pixels, as reported by the renderer. */
let toolbarRegions: ToolbarRegion[] = []
let interactivePoll: ReturnType<typeof setInterval> | null = null

export function getToolbarWindow(): BrowserWindow | null {
  return toolbar
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function pointInside(point: Point, rect: Rectangle): boolean {
  return (
    point.x >= rect.x &&
    point.x < rect.x + rect.width &&
    point.y >= rect.y &&
    point.y < rect.y + rect.height
  )
}

/**
 * Accepts the renderer's region report. Everything is validated here because
 * this is renderer data crossing the IPC boundary: a malformed rect must not
 * turn the transparent headroom clickable by accident.
 */
export function setToolbarRegions(regions: unknown): void {
  if (!Array.isArray(regions) || regions.length > MAX_TOOLBAR_REGIONS) return

  const next: ToolbarRegion[] = []
  for (const region of regions) {
    if (typeof region !== 'object' || region === null) return
    const { x, y, width, height } = region as Record<string, unknown>
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) return
    if (!isFiniteNumber(width) || !isFiniteNumber(height)) return
    if (width <= 0 || height <= 0 || width > 10_000 || height > 10_000) return
    if (Math.abs(x) > 10_000 || Math.abs(y) > 10_000) return
    next.push({ x, y, width, height })
  }

  toolbarRegions = next
  refreshToolbarInteractivity()
}

/**
 * Main-process hit test. Called on a timer and whenever z-order or mode
 * changes, so the toolbar stops being click-through even when no forwarded
 * `mousemove` ever arrives.
 *
 * Regions are window-relative CSS pixels, which match DIP, so the window
 * origin can be added directly to compare against `getCursorScreenPoint()`.
 * The visible rail is computed from the window geometry and is always counted,
 * so a stale or missing renderer report can never make the bar click-through.
 * Reported regions then add the hover Tool Menu. A collapsed window is
 * treated as one whole tab.
 */
export function refreshToolbarInteractivity(): boolean {
  if (!toolbar || toolbar.isDestroyed()) return false

  const cursor = screen.getCursorScreenPoint()
  const bounds = toolbar.getBounds()
  const { collapsed } = getState()

  let interactive: boolean
  if (collapsed) {
    // The collapsed window is almost entirely the tab; treating the whole
    // window as UI is both correct and immune to stale pre-collapse regions.
    interactive = pointInside(cursor, bounds)
  } else {
    const rail = getToolbarRailBounds()
    interactive =
      (rail !== null && pointInside(cursor, rail)) ||
      toolbarRegions.some((region) =>
        pointInside(cursor, {
          x: bounds.x + region.x,
          y: bounds.y + region.y,
          width: region.width,
          height: region.height
        })
      )
  }

  setToolbarInteractive(interactive)
  return interactive
}

function startInteractivePoll(): void {
  stopInteractivePoll()
  interactivePoll = setInterval(refreshToolbarInteractivity, REGION_POLL_MS)
  // The window already keeps the app alive; the timer never should.
  interactivePoll.unref()
}

function stopInteractivePoll(): void {
  if (interactivePoll === null) return
  clearInterval(interactivePoll)
  interactivePoll = null
}

/**
 * OS-level click-through for the expanded window's transparent headroom.
 *
 * CSS `pointer-events` only decides DOM hit-testing; the BrowserWindow itself
 * still swallows every click inside its rectangle. The renderer reports when
 * the pointer is over real UI (bar, menu, collapsed tab), and this toggles
 * `setIgnoreMouseEvents` so strokes started in the headroom reach the overlay
 * or the app underneath.
 *
 * `forward: true` supplies the low-latency path: move events keep arriving
 * while the window ignores the mouse. It is not the only path, because Windows
 * can drop those forwarded events; `refreshToolbarInteractivity()` re-checks
 * the OS cursor on a timer and restores clicks regardless.
 */
export function setToolbarInteractive(interactive: boolean): void {
  if (interactive === toolbarInteractive) return
  toolbarInteractive = interactive
  if (!toolbar || toolbar.isDestroyed()) return
  toolbar.setIgnoreMouseEvents(!interactive, { forward: true })
}

/**
 * Visible rail rectangle in screen coordinates. Expanded windows have
 * transparent inward headroom for the hover Tool Menu, so panels must be
 * positioned against the bar surface rather than the window edge.
 */
export function getToolbarRailBounds(): Rectangle | null {
  if (!toolbar || toolbar.isDestroyed()) return null
  const bounds = toolbar.getBounds()
  const { dock, collapsed } = getState()
  // Popovers are only opened from the expanded rail; fall back to the window
  // bounds if a call races the collapse.
  if (collapsed) return bounds

  const vertical = dock === 'left' || dock === 'right'
  const width = vertical ? BAR_SIZE.vertical.width : BAR_SIZE.horizontal.width
  const height = vertical ? BAR_SIZE.vertical.height : BAR_SIZE.horizontal.height
  const x =
    dock === 'left'
      ? bounds.x + DOCK_INSET
      : dock === 'right'
        ? bounds.x + bounds.width - DOCK_INSET - width
        : bounds.x + Math.round((bounds.width - width) / 2)
  const y =
    dock === 'top'
      ? bounds.y + DOCK_INSET
      : dock === 'bottom'
        ? bounds.y + bounds.height - DOCK_INSET - height
        : bounds.y + Math.round((bounds.height - height) / 2)

  return { x, y, width, height }
}

/**
 * Both windows are topmost at the `screen-saver` level, so whichever was
 * raised last wins. The overlay must stay below the toolbar or it would
 * swallow clicks on the controls while drawing.
 *
 * Interactivity is refreshed in the same step: a mode flip, dock change or
 * display change that raised the toolbar must also re-enable its clicks if the
 * cursor is already on the rail, even when Chromium never forwards a move.
 */
export function raiseToolbar(): void {
  if (toolbar && !toolbar.isDestroyed()) toolbar.moveTop()
  refreshToolbarInteractivity()
}

/** Centres the dock (or the collapsed glassy handle) flush on the requested edge of the work area. */
function dockBounds(dock: DockPosition, collapsed: boolean): Rectangle {
  const { workArea } = activeDisplay()
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
  const target = dockBounds(dock, collapsed)
  const current = toolbar.getBounds()
  // Identical bounds are common (draw-mode entry re-applies the same dock).
  // Every extra `setBounds` makes DWM re-present a transparent topmost window,
  // so only touch the window when it actually needs to move or resize.
  if (
    current.x !== target.x ||
    current.y !== target.y ||
    current.width !== target.width ||
    current.height !== target.height
  ) {
    toolbar.setBounds(target)
  }
  raiseToolbar()
}

/** Edge whose boundary is closest to the window's centre. */
function nearestEdge(): DockPosition {
  const bounds = toolbar?.getBounds()
  const { workArea } = activeDisplay()
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
 * The toolbar is its own always-on-top window. It starts click-through so the
 * transparent headroom never blocks drawing; `setToolbarInteractive` turns the
 * mouse back on while the pointer is over the rail, menu or collapsed tab.
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

  // Start transparent to the mouse: the window is much larger than the rail,
  // and the unused area must not swallow strokes. The renderer flips this on
  // as soon as the pointer crosses real UI, and the cursor poll below catches
  // the case where forwarded move events never arrive.
  toolbarInteractive = false
  toolbarRegions = []
  toolbar.setIgnoreMouseEvents(true, { forward: true })
  startInteractivePoll()

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
    stopInteractivePoll()
    toolbarRegions = []
    toolbarInteractive = false
    toolbar = null
  })

  toolbar.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  guardNavigation(toolbar.webContents)

  loadToolbar(toolbar)
  return toolbar
}
