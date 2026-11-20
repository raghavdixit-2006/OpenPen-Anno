import { screen, type Display } from 'electron'

/**
 * Which display the overlay and toolbar live on. By default the app follows
 * the cursor: entering drawing mode re-bounds both windows to the display the
 * user is pointing at. A tray selection can pin a specific display instead.
 *
 * Only one display is covered at a time. A single transparent BrowserWindow
 * cannot span mixed-DPI displays without one of them being scaled wrong, so
 * per-display windows would be needed for simultaneous coverage; until then,
 * the active display is the one being annotated.
 */
let pinnedId: number | null = null

export function pinnedDisplayId(): number | null {
  return pinnedId
}

export function pinDisplay(id: number | null): void {
  pinnedId = id
}

/** The pinned display if it still exists, otherwise the display under the cursor. */
export function activeDisplay(): Display {
  if (pinnedId !== null) {
    const pinned = screen.getAllDisplays().find((display) => display.id === pinnedId)
    if (pinned) return pinned
    // The pinned monitor was unplugged; follow the cursor again.
    pinnedId = null
  }

  return screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
}

/** Menu label: index, DIP size, and whether it is the primary display. */
export function displayLabel(display: Display, index: number): string {
  const primary = display.id === screen.getPrimaryDisplay().id ? ' · primary' : ''
  return `Display ${index + 1} — ${display.bounds.width}×${display.bounds.height}${primary}`
}

/**
 * Fires when monitors are added/removed or their scale/position changes. The
 * app re-bounds both windows and refreshes the tray menu.
 */
export function onDisplaysChanged(listener: () => void): void {
  screen.on('display-added', listener)
  screen.on('display-removed', listener)
  screen.on('display-metrics-changed', listener)
}
