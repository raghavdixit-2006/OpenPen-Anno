import { app, dialog } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { IPC } from '../shared/ipc'
import { activeDisplay } from './display'
import { log } from './log'
import { captureDisplay } from './screenCapture'
import { sendToOverlay } from './overlayWindow'
import { getToolbarWindow } from './toolbarWindow'

/** Only accept the exact format the overlay produces. */
const PNG_DATA_URL = 'data:image/png;base64,'
/** Reject absurd payloads before allocating a decode buffer. */
const MAX_DATA_URL_LENGTH = 160_000_000
/** If the overlay never answers (window reloading, crash), release the lock. */
const COMPOSITE_TIMEOUT_MS = 8000

let awaitingComposite = false
let timeout: ReturnType<typeof setTimeout> | null = null

function clearPending(): void {
  awaitingComposite = false
  if (timeout !== null) {
    clearTimeout(timeout)
    timeout = null
  }
}

function timestampName(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  return [
    'OpenPen-Anno-',
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    '_',
    `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`,
    '.png'
  ].join('')
}

/**
 * Saves exactly what the user sees: the overlay receives a clean desktop
 * capture (both app windows hidden), repaints all committed ink on top, and
 * sends back one PNG. The save dialog runs after compositing so a modal dialog
 * can never end up inside the screenshot.
 */
export async function requestAnnotatedScreenshot(): Promise<void> {
  if (awaitingComposite) return
  awaitingComposite = true

  const capture = await captureDisplay(activeDisplay())
  if (!awaitingComposite) return
  if (!capture) {
    clearPending()
    return
  }

  sendToOverlay(IPC.screenshotBase, capture)
  timeout = setTimeout(clearPending, COMPOSITE_TIMEOUT_MS)
}

/** Overlay -> main: the composited PNG, ready to write. */
export async function saveAnnotatedScreenshot(dataUrl: unknown): Promise<void> {
  if (!awaitingComposite) return
  clearPending()

  if (
    typeof dataUrl !== 'string' ||
    !dataUrl.startsWith(PNG_DATA_URL) ||
    dataUrl.length > MAX_DATA_URL_LENGTH
  ) {
    return
  }

  const buffer = Buffer.from(dataUrl.slice(PNG_DATA_URL.length), 'base64')
  if (buffer.length === 0) return

  const options = {
    title: 'Save annotated screenshot',
    defaultPath: join(app.getPath('pictures'), 'OpenPen Anno', timestampName(new Date())),
    filters: [{ name: 'PNG image', extensions: ['png'] }]
  }

  const parent = getToolbarWindow()
  const result = parent
    ? await dialog.showSaveDialog(parent, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || !result.filePath) return

  try {
    await mkdir(dirname(result.filePath), { recursive: true })
    await writeFile(result.filePath, buffer)
  } catch (error) {
    log.error('[openpen-anno] could not save screenshot', error)
  }
}
