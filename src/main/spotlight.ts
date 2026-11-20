import { screen } from 'electron'
import { IPC, type SpotlightPoint } from '../shared/ipc'
import { sendToOverlay } from './overlayWindow'

/**
 * Spotlight mode has to follow the cursor even when the overlay is in
 * passthrough (the overlay is click-through and never sees pointer events).
 * Main polls the OS cursor at 25 Hz and only forwards actual movement.
 */
const POLL_MS = 40

let timer: NodeJS.Timeout | null = null
let lastKey = ''

export function setSpotlightActive(active: boolean): void {
  if (active === (timer !== null)) return

  if (!active) {
    if (timer) clearInterval(timer)
    timer = null
    lastKey = ''
    return
  }

  timer = setInterval(() => {
    const cursor = screen.getCursorScreenPoint()
    const key = `${cursor.x}:${cursor.y}`
    if (key === lastKey) return
    lastKey = key
    const point: SpotlightPoint = { x: cursor.x, y: cursor.y }
    sendToOverlay(IPC.spotlightMove, point)
  }, POLL_MS)
}
