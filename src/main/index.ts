import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { electronApp, is } from '@electron-toolkit/utils'
import { IPC, type HistoryCommand } from '../shared/ipc'
import { logWindowDiagnostics } from './diagnostics'
import {
  applyOverlayMode,
  createOverlayWindow,
  sendToOverlay,
  syncOverlayBounds
} from './overlayWindow'
import { createToolbarWindow, applyToolbarDock } from './toolbarWindow'
import { registerShortcuts, setHistoryShortcutsEnabled, type ShortcutHandlers } from './shortcuts'
import {
  applyHistoryStatus,
  getState,
  isDockPosition,
  isHistoryStatus,
  isOverlayMode,
  isToolId,
  normalizeColor,
  normalizeSize,
  onStateChange,
  patchState
} from './state'

// Dev-only inspector for the renderer windows (used by the debug workflow).
if (is.dev) {
  app.commandLine.appendSwitch('remote-debugging-port', '9222')
}

// Single instance: a second overlay would fight the first one for hotkeys.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

const handlers: ShortcutHandlers = {
  toggleMode: () => patchState({ mode: getState().mode === 'draw' ? 'passthrough' : 'draw' }),
  clear: () => sendToOverlay(IPC.clear),
  undo: () => sendToOverlay(IPC.history, 'undo' satisfies HistoryCommand),
  redo: () => sendToOverlay(IPC.history, 'redo' satisfies HistoryCommand)
}

function registerIpc(): void {
  ipcMain.handle(IPC.getState, () => getState())

  ipcMain.on(IPC.setMode, (_event, mode: unknown) => {
    if (isOverlayMode(mode)) patchState({ mode })
  })

  ipcMain.on(IPC.setTool, (_event, tool: unknown) => {
    if (isToolId(tool)) patchState({ tool })
  })

  ipcMain.on(IPC.setColor, (_event, color: unknown) => {
    const next = normalizeColor(color)
    if (next) patchState({ color: next })
  })

  ipcMain.on(IPC.setSize, (_event, size: unknown) => {
    const next = normalizeSize(size)
    if (next !== null) patchState({ size: next })
  })

  ipcMain.on(IPC.setDock, (_event, dock: unknown) => {
    if (isDockPosition(dock)) patchState({ dock })
  })

  ipcMain.on(IPC.setCollapsed, (_event, collapsed: unknown) => {
    if (typeof collapsed === 'boolean') patchState({ collapsed })
  })

  ipcMain.on(IPC.clear, () => handlers.clear())

  ipcMain.on(IPC.history, (_event, command: unknown) => {
    if (command === 'undo') handlers.undo()
    else if (command === 'redo') handlers.redo()
  })

  ipcMain.on(IPC.historyStatus, (_event, status: unknown) => {
    if (isHistoryStatus(status)) applyHistoryStatus(status)
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.inkspace.app')

  registerIpc()
  const overlayWindow = createOverlayWindow()
  const toolbarWindow = createToolbarWindow()
  if (is.dev) {
    logWindowDiagnostics(overlayWindow, 'overlay')
    logWindowDiagnostics(toolbarWindow, 'toolbar')
  }
  registerShortcuts(handlers)

  let appliedMode = getState().mode
  let appliedDock = getState().dock
  let appliedCollapsed = getState().collapsed
  onStateChange((state) => {
    if (state.mode !== appliedMode) {
      appliedMode = state.mode
      applyOverlayMode(state.mode)
    }
    if (state.dock !== appliedDock || state.collapsed !== appliedCollapsed) {
      appliedDock = state.dock
      appliedCollapsed = state.collapsed
      applyToolbarDock(state.dock, state.collapsed)
    }
    // Undo/redo must only steal Ctrl+Z / Ctrl+Y while drawing. Registering on
    // every state change is a no-op unless the mode actually flipped.
    setHistoryShortcutsEnabled(state.mode === 'draw', handlers)
  })

  const keepOnDisplay = (): void => {
    syncOverlayBounds()
    applyToolbarDock(getState().dock, getState().collapsed)
  }
  screen.on('display-metrics-changed', keepOnDisplay)
  screen.on('display-added', keepOnDisplay)
  screen.on('display-removed', keepOnDisplay)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow()
      createToolbarWindow()
    }
  })

  app.on('second-instance', () => {
    patchState({ mode: 'draw' })
  })
})

app.on('window-all-closed', () => {
  app.quit()
})
