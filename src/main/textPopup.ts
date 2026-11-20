import { BrowserWindow, screen, type Rectangle } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import {
  IPC,
  TEXT_MAX_LENGTH,
  type TextCommit,
  type TextPopupContext,
  type TextPopupRequest
} from '../shared/ipc'
import { getState } from './state'
import { guardNavigation } from './navigation'
import { sendToOverlay } from './overlayWindow'
import { raiseToolbar } from './toolbarWindow'

/**
 * A small, focusable editor window for the text tool. The overlay is
 * deliberately non-focusable, so typing has to happen in a real window; this
 * one is created on demand, placed next to the click, and destroyed as soon as
 * the user commits or cancels.
 */
const POPUP_SIZE = { width: 340, height: 168 } as const
const POPUP_MARGIN = 12

let popup: BrowserWindow | null = null
let pending: (TextPopupRequest & { color: string; size: number }) | null = null

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isRequest(value: unknown): value is TextPopupRequest {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as TextPopupRequest
  return (
    isFiniteNumber(candidate.x) &&
    isFiniteNumber(candidate.y) &&
    isFiniteNumber(candidate.screenX) &&
    isFiniteNumber(candidate.screenY)
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Keeps the popup on the display where the user clicked, clear of the edges. */
function popupBounds(request: TextPopupRequest): Rectangle {
  const { workArea } = screen.getDisplayNearestPoint({
    x: Math.round(request.screenX),
    y: Math.round(request.screenY)
  })
  const { width, height } = POPUP_SIZE

  const above = request.screenY - height - POPUP_MARGIN
  const below = request.screenY + 16
  const preferredY = above >= workArea.y + POPUP_MARGIN ? above : below

  return {
    x: clamp(
      request.screenX + 12,
      workArea.x + POPUP_MARGIN,
      workArea.x + workArea.width - width - POPUP_MARGIN
    ),
    y: clamp(
      preferredY,
      workArea.y + POPUP_MARGIN,
      workArea.y + workArea.height - height - POPUP_MARGIN
    ),
    width,
    height
  }
}

function loadPopup(window: BrowserWindow): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/text/index.html`)
  } else {
    window.loadFile(join(__dirname, '../renderer/text/index.html'))
  }
}

function destroyPopup(): void {
  const window = popup
  popup = null
  pending = null
  if (window && !window.isDestroyed()) window.destroy()
}

export function openTextPopup(request: unknown): void {
  if (!isRequest(request)) return
  destroyPopup()

  const { color, size } = getState()
  pending = { ...request, color, size }

  const window = new BrowserWindow({
    ...popupBounds(request),
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
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  })

  popup = window
  window.setMenu(null)
  window.setAlwaysOnTop(true, 'screen-saver')
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  guardNavigation(window.webContents)

  window.once('ready-to-show', () => {
    if (window.isDestroyed()) return
    window.show()
    window.focus()
  })

  window.on('closed', () => {
    // A replaced/destroyed popup must not clear the pending request of the
    // popup that succeeded it, nor raise the toolbar above that new popup.
    if (popup !== window) return
    popup = null
    pending = null
    // The popup briefly takes focus; put the toolbar back on top afterwards.
    raiseToolbar()
  })

  loadPopup(window)
}

export function getTextContext(): TextPopupContext | null {
  if (!pending) return null
  return { color: pending.color, size: pending.size, maxLength: TEXT_MAX_LENGTH }
}

/** Main-side validation: the popup's payload is never trusted. */
export function commitText(raw: unknown): void {
  const source = pending
  if (!source) {
    destroyPopup()
    return
  }

  const text =
    typeof raw === 'string' ? raw.replace(/\r\n?/g, '\n').trim().slice(0, TEXT_MAX_LENGTH) : ''

  if (text.length === 0) {
    // Nothing to draw; leave the popup open so the user can keep typing.
    return
  }

  const payload: TextCommit = {
    text,
    x: source.x,
    y: source.y,
    color: source.color,
    size: source.size
  }

  pending = null
  destroyPopup()
  sendToOverlay(IPC.commitText, payload)
  raiseToolbar()
}

export function cancelText(): void {
  destroyPopup()
  raiseToolbar()
}
