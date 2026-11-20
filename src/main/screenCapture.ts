import { desktopCapturer, type BrowserWindow, type Display } from 'electron'
import type { ScreenshotBase } from '../shared/ipc'
import { getOverlayWindow } from './overlayWindow'
import { log } from './log'
import { getToolbarWindow, raiseToolbar } from './toolbarWindow'

/**
 * Windows composites a hidden window out of the desktop image, but not
 * instantly. A short settle keeps the toolbar and existing ink from ending up
 * baked into freeze frames and saved screenshots.
 */
const HIDE_SETTLE_MS = 120

function visibleAppWindows(): BrowserWindow[] {
  return [getOverlayWindow(), getToolbarWindow()].filter(
    (window): window is BrowserWindow =>
      window !== null && !window.isDestroyed() && window.isVisible()
  )
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Captures one display at native resolution with both app windows temporarily
 * hidden. The overlay owns the vector ink, so it can repaint annotations on
 * the clean background instead of capturing them twice.
 */
export async function captureDisplay(display: Display): Promise<ScreenshotBase | null> {
  const hidden = visibleAppWindows()
  hidden.forEach((window) => window.hide())

  try {
    if (hidden.length > 0) await wait(HIDE_SETTLE_MS)

    const scale = display.scaleFactor > 0 ? display.scaleFactor : 1
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(display.bounds.width * scale),
        height: Math.round(display.bounds.height * scale)
      }
    })

    const source =
      sources.find((candidate) => candidate.display_id === String(display.id)) ??
      (sources.length === 1 ? sources[0] : undefined)
    if (!source || source.thumbnail.isEmpty()) return null

    return { dataUrl: source.thumbnail.toDataURL() }
  } catch (error) {
    log.error('[openpen-anno] screen capture failed', error)
    return null
  } finally {
    for (const window of hidden) {
      if (!window.isDestroyed()) window.showInactive()
    }
    raiseToolbar()
  }
}
