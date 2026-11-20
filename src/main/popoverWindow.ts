import { BrowserWindow, screen, type Rectangle } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { PopoverContext, PopoverKind, PopoverRequest } from '../shared/ipc'
import { guardNavigation } from './navigation'
import { getState } from './state'
import { getToolbarWindow, raiseToolbar } from './toolbarWindow'

/**
 * Floating tool options (colour, size, eraser mode, shape picker). The toolbar
 * window is sized to its visible rail and its padding is part of the click
 * region, so a panel drawn outside those bounds would be clipped and enlarging
 * the window would swallow clicks over the transparent area. A small, separate
 * topmost window keeps the rail's footprint untouched.
 */
const POPOVER_SIZE: Record<PopoverKind, { width: number; height: number }> = {
  tool: { width: 288, height: 104 },
  shapes: { width: 288, height: 136 }
}

const GAP = 10
const MARGIN = 8

let popover: BrowserWindow | null = null
let kind: PopoverKind = 'tool'

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRequest(value: unknown): value is PopoverRequest {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as PopoverRequest
  if (candidate.kind !== 'tool' && candidate.kind !== 'shapes') return false
  const anchor = candidate.anchor
  if (typeof anchor !== 'object' || anchor === null) return false
  return (
    isFiniteNumber(anchor.x) &&
    isFiniteNumber(anchor.y) &&
    isFiniteNumber(anchor.width) &&
    isFiniteNumber(anchor.height) &&
    anchor.width > 0 &&
    anchor.height > 0 &&
    anchor.width < 10_000 &&
    anchor.height < 10_000
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * Places the panel beyond the rail on the side that has room: above a bottom
 * dock, below a top dock, and beside side docks. The rail's own bounds are the
 * reference, not the button, so the panel can never cover the controls. A
 * corner control still gets a fully visible panel because everything is
 * clamped to the display's work area.
 */
function popoverBounds(request: PopoverRequest): Rectangle {
  const { width, height } = POPOVER_SIZE[request.kind]
  const toolbar = getToolbarWindow()?.getBounds()
  // The renderer reports the trigger in its own CSS pixels; adding the
  // toolbar's origin yields screen DIP without trusting `window.screenX` on a
  // mixed-DPI desktop.
  const anchor = toolbar
    ? {
        x: toolbar.x + request.anchor.x,
        y: toolbar.y + request.anchor.y,
        width: request.anchor.width,
        height: request.anchor.height
      }
    : request.anchor
  const centreX = anchor.x + anchor.width / 2
  const centreY = anchor.y + anchor.height / 2
  const { workArea } = screen.getDisplayNearestPoint({
    x: Math.round(centreX),
    y: Math.round(centreY)
  })
  const dock = getState().dock

  const minX = workArea.x + MARGIN
  const maxX = workArea.x + workArea.width - width - MARGIN
  const minY = workArea.y + MARGIN
  const maxY = workArea.y + workArea.height - height - MARGIN

  if (dock === 'left' || dock === 'right') {
    const edge = toolbar
      ? dock === 'left'
        ? toolbar.x + toolbar.width
        : toolbar.x
      : dock === 'left'
        ? anchor.x + anchor.width
        : anchor.x
    const beside = dock === 'left' ? edge + GAP : edge - width - GAP
    const fallback = dock === 'left' ? anchor.x - width - GAP : anchor.x + anchor.width + GAP
    const fits = beside >= minX && beside <= maxX
    return {
      x: Math.round(clamp(fits ? beside : fallback, minX, maxX)),
      y: Math.round(clamp(centreY - height / 2, minY, maxY)),
      width,
      height
    }
  }

  const railTop = toolbar ? toolbar.y : anchor.y
  const railHeight = toolbar ? toolbar.height : anchor.height
  const above = railTop - height - GAP
  const below = railTop + railHeight + GAP
  const preferred = dock === 'top' ? below : above
  const fallback = dock === 'top' ? above : below
  const fits = preferred >= minY && preferred <= maxY

  return {
    x: Math.round(clamp(centreX - width / 2, minX, maxX)),
    y: Math.round(clamp(fits ? preferred : fallback, minY, maxY)),
    width,
    height
  }
}

function loadPopover(window: BrowserWindow): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/popover/index.html`)
  } else {
    window.loadFile(join(__dirname, '../renderer/popover/index.html'))
  }
}

export function openPopover(request: unknown): void {
  if (!isRequest(request)) return

  closePopover(false)
  kind = request.kind

  const window = new BrowserWindow({
    ...popoverBounds(request),
    show: false,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    thickFrame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    autoHideMenuBar: true,
    title: 'OpenPen Anno Tool Options',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  popover = window
  window.setMenu(null)
  window.setAlwaysOnTop(true, 'screen-saver')
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  guardNavigation(window.webContents)

  let active = false
  window.once('ready-to-show', () => {
    if (window.isDestroyed()) return
    active = true
    window.show()
    window.focus()
    window.moveTop()
  })

  // Clicking the toolbar or any other window dismisses the panel, like a
  // native popover. The flag avoids a blur fired during window creation.
  window.on('blur', () => {
    if (active && popover === window) closePopover()
  })

  window.on('closed', () => {
    if (popover !== window) return
    popover = null
    // The panel briefly owned focus; the overlay must not end up above the bar.
    raiseToolbar()
  })

  loadPopover(window)
}

export function closePopover(restoreToolbar = true): void {
  const window = popover
  popover = null
  if (!window) return
  if (!window.isDestroyed()) window.destroy()
  if (restoreToolbar) raiseToolbar()
}

export function getPopoverContext(): PopoverContext | null {
  if (!popover) return null
  const state = getState()
  return {
    kind,
    tool: state.tool,
    color: state.color,
    size: state.size,
    eraserMode: state.eraserMode
  }
}
