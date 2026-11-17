import { app, globalShortcut } from 'electron'

export interface ShortcutHandlers {
  toggleMode: () => void
  clear: () => void
  undo: () => void
  redo: () => void
}

const UNDO_ACCELERATORS = ['Control+Z', 'Control+Y']

let historyShortcutsBound = false

function bind(accelerator: string, action: () => void): void {
  globalShortcut.unregister(accelerator)
  const ok = globalShortcut.register(accelerator, action)
  if (!ok) console.error(`[inkspace] could not register global shortcut ${accelerator}`)
}

/**
 * Ctrl+Z / Ctrl+Y are only grabbed while drawing. A permanently registered
 * global Ctrl+Z would steal undo from Chrome, Word and every other app even
 * when the overlay is in passthrough mode.
 */
export function setHistoryShortcutsEnabled(enabled: boolean, handlers: ShortcutHandlers): void {
  if (enabled === historyShortcutsBound) return
  historyShortcutsBound = enabled

  if (enabled) {
    bind('Control+Z', handlers.undo)
    bind('Control+Y', handlers.redo)
  } else {
    UNDO_ACCELERATORS.forEach((accelerator) => globalShortcut.unregister(accelerator))
  }
}

export function registerShortcuts(handlers: ShortcutHandlers): void {
  bind('Control+Shift+D', handlers.toggleMode)
  bind('Control+Shift+C', handlers.clear)
  bind('Control+Shift+Q', () => app.quit())

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
    historyShortcutsBound = false
  })
}
