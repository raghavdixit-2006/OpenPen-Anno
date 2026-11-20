import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { electronApp } from '@electron-toolkit/utils'
import { IPC, type HistoryCommand } from '../shared/ipc'
import {
  applyOverlayMode,
  createOverlayWindow,
  sendToOverlay,
  syncOverlayBounds
} from './overlayWindow'
import {
  applyToolbarDock,
  createToolbarWindow,
  getToolbarWindow,
  refreshToolbarInteractivity,
  setToolbarInteractive,
  setToolbarRegions
} from './toolbarWindow'
import { registerShortcuts, setHistoryShortcutsEnabled, type ShortcutHandlers } from './shortcuts'
import { flushSettings, loadSettings, saveToolbarSettings } from './settings'
import { createTray, refreshTrayMenu } from './tray'
import { onDisplaysChanged } from './display'
import { cancelText, commitText, getTextContext, openTextPopup } from './textPopup'
import { closePopover, getPopoverContext, openPopover } from './popoverWindow'
import { setSpotlightActive } from './spotlight'
import { captureFreezeFrame, setFrozen, toggleFrozen } from './freeze'
import { initializeLogging, log } from './log'
import { requestAnnotatedScreenshot, saveAnnotatedScreenshot } from './screenshot'
import { initializeUpdates } from './updater'
import {
  applyHistoryStatus,
  getState,
  hydrateState,
  isDockPosition,
  isEraserMode,
  isBackdrop,
  isHistoryStatus,
  isOverlayMode,
  isToolId,
  normalizeColor,
  normalizeSize,
  onStateChange,
  patchState
} from './state'

// Keep userData on the package slug rather than the display productName so the
// settings path is stable and easy to document. Must run before any store is
// created or any BrowserWindow touches the profile. E2E launches point the env
// var at a throwaway directory so tests never touch real settings.
const userDataOverride = process.env['OPENPEN_ANNO_USER_DATA']
app.setPath('userData', userDataOverride ?? join(app.getPath('appData'), 'openpen-anno'))
initializeLogging()

// Single instance: a second overlay would fight the first one for hotkeys.
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

const handlers: ShortcutHandlers = {
  toggleMode: () => patchState({ mode: getState().mode === 'draw' ? 'passthrough' : 'draw' }),
  toggleFreeze: () => toggleFrozen(),
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

  ipcMain.on(IPC.setEraserMode, (_event, mode: unknown) => {
    if (isEraserMode(mode)) patchState({ eraserMode: mode })
  })

  ipcMain.on(IPC.setBackdrop, (_event, mode: unknown) => {
    if (isBackdrop(mode)) patchState({ backdrop: mode })
  })

  ipcMain.on(IPC.setFrozen, (_event, frozen: unknown) => {
    if (typeof frozen === 'boolean') setFrozen(frozen)
  })

  ipcMain.on(IPC.requestScreenshot, () => {
    void requestAnnotatedScreenshot()
  })
  ipcMain.on(IPC.screenshotSave, (_event, dataUrl: unknown) => {
    void saveAnnotatedScreenshot(dataUrl)
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

  ipcMain.on(IPC.openTextPopup, (_event, request: unknown) => {
    openTextPopup(request)
  })
  ipcMain.handle(IPC.textContext, () => getTextContext())
  ipcMain.on(IPC.textCommit, (_event, text: unknown) => {
    commitText(text)
  })
  ipcMain.on(IPC.textCancel, () => cancelText())

  ipcMain.on(IPC.openPopover, (_event, request: unknown) => {
    openPopover(request)
  })
  ipcMain.on(IPC.closePopover, () => closePopover())
  ipcMain.handle(IPC.popoverContext, () => getPopoverContext())

  ipcMain.on(IPC.setToolbarInteractive, (event, interactive: unknown) => {
    const window = getToolbarWindow()
    // Only the toolbar renderer may change its own window's mouse behaviour.
    if (!window || window.isDestroyed() || event.sender !== window.webContents) return
    if (typeof interactive !== 'boolean') return
    setToolbarInteractive(interactive)
  })

  ipcMain.on(IPC.setToolbarRegions, (event, regions: unknown) => {
    const window = getToolbarWindow()
    // Same trust boundary as above: only the toolbar renderer reports its UI.
    if (!window || window.isDestroyed() || event.sender !== window.webContents) return
    setToolbarRegions(regions)
  })
}

async function bootstrap(): Promise<void> {
  // Settings load before anything else: `disableHardwareAcceleration()` only
  // takes effect before the app is ready, and the toolbar must create its
  // window in the persisted dock/collapsed shape.
  const settings = await loadSettings()
  if (!settings.hardwareAcceleration) app.disableHardwareAcceleration()
  hydrateState(settings)

  await app.whenReady()
  electronApp.setAppUserModelId('com.openpen.anno')

  registerIpc()
  createOverlayWindow()
  createToolbarWindow()
  registerShortcuts(handlers)
  createTray()
  initializeUpdates()

  // File logs should explain a dead or hung renderer without a debugger.
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.on('render-process-gone', (_event, details) => {
      log.error('[openpen-anno] renderer gone', window.getTitle(), details)
    })
    window.on('unresponsive', () => {
      log.warn('[openpen-anno] window unresponsive', window.getTitle())
    })
  }

  // Monitor hotplug / DPI changes invalidate both window bounds and the tray's
  // display list. Re-apply them in one place.
  onDisplaysChanged(() => {
    syncOverlayBounds()
    applyToolbarDock(getState().dock, getState().collapsed)
    refreshTrayMenu()
    // A frozen frame belongs to one monitor; re-capture on the new one.
    if (getState().frozen) void captureFreezeFrame()
  })

  let appliedMode = getState().mode
  let appliedTool = getState().tool
  let appliedDock = getState().dock
  let appliedCollapsed = getState().collapsed
  let appliedBackdrop = getState().backdrop
  setSpotlightActive(appliedBackdrop === 'spotlight')
  let persistedToolbar = {
    tool: getState().tool,
    color: getState().color,
    size: getState().size,
    eraserMode: getState().eraserMode,
    backdrop: getState().backdrop,
    dock: getState().dock,
    collapsed: getState().collapsed
  }
  onStateChange((state) => {
    // Freezing always implies drawing mode. Leaving drawing must also drop the
    // frozen frame; otherwise passthrough would keep showing a still screenshot
    // on top of the live desktop indefinitely.
    if (state.mode === 'passthrough' && state.frozen) {
      setFrozen(false)
      return
    }
    // A floating options panel belongs to one tool and one layout; any change
    // that could detach it from its control closes it first.
    if (state.tool !== appliedTool) {
      appliedTool = state.tool
      closePopover()
    }
    if (state.mode !== appliedMode) {
      appliedMode = state.mode
      closePopover()
      applyOverlayMode(state.mode)
      // Drawing follows the cursor's display, so bring the dock along too.
      if (state.mode === 'draw') applyToolbarDock(state.dock, state.collapsed)
      // The cursor may already rest on the mode button. Re-run the hit test now
      // instead of waiting for a forwarded move that Windows may never deliver,
      // otherwise draw mode can leave the toolbar click-through and unescapable.
      refreshToolbarInteractivity()
    }
    if (state.dock !== appliedDock || state.collapsed !== appliedCollapsed) {
      appliedDock = state.dock
      appliedCollapsed = state.collapsed
      closePopover()
      applyToolbarDock(state.dock, state.collapsed)
    }
    if (state.backdrop !== appliedBackdrop) {
      appliedBackdrop = state.backdrop
      setSpotlightActive(state.backdrop === 'spotlight')
    }
    // Undo/redo must only steal Ctrl+Z / Ctrl+Y while drawing. Registering on
    // every state change is a no-op unless the mode actually flipped.
    setHistoryShortcutsEnabled(state.mode === 'draw', handlers)

    // Persist only actual preference changes; history flags and mode flips
    // would otherwise rewrite the settings file for nothing.
    if (
      state.tool !== persistedToolbar.tool ||
      state.color !== persistedToolbar.color ||
      state.size !== persistedToolbar.size ||
      state.eraserMode !== persistedToolbar.eraserMode ||
      state.backdrop !== persistedToolbar.backdrop ||
      state.dock !== persistedToolbar.dock ||
      state.collapsed !== persistedToolbar.collapsed
    ) {
      persistedToolbar = {
        tool: state.tool,
        color: state.color,
        size: state.size,
        eraserMode: state.eraserMode,
        backdrop: state.backdrop,
        dock: state.dock,
        collapsed: state.collapsed
      }
      saveToolbarSettings(persistedToolbar)
    }
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

  // The preference write is debounced; flush it before the process exits.
  app.on('before-quit', () => {
    setSpotlightActive(false)
    flushSettings()
  })
}

void bootstrap().catch((error) => {
  log.error('[openpen-anno] startup failed', error)
  app.quit()
})

app.on('window-all-closed', () => {
  app.quit()
})
