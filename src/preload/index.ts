import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type BackdropMode,
  type DockPosition,
  type EraserMode,
  type FreezeFrame,
  type HistoryCommand,
  type OpenPenAnnoApi,
  type OverlayState,
  type PopoverContext,
  type PopoverRequest,
  type ScreenshotBase,
  type SpotlightPoint,
  type TextCommit,
  type TextPopupContext,
  type TextPopupRequest,
  type ToolbarRegion,
  type ToolId
} from '../shared/ipc'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

// Minimal, typed surface. No raw ipcRenderer and no Node.js are exposed.
const api: OpenPenAnnoApi = {
  overlay: {
    getState: () => ipcRenderer.invoke(IPC.getState) as Promise<OverlayState>,
    onStateChange: (listener) => subscribe<OverlayState>(IPC.stateChanged, listener),
    onClear: (listener) => subscribe<void>(IPC.clear, () => listener()),
    onHistory: (listener) => subscribe<HistoryCommand>(IPC.history, listener),
    openTextPopup: (request: TextPopupRequest) => ipcRenderer.send(IPC.openTextPopup, request),
    onCommitText: (listener) => subscribe<TextCommit>(IPC.commitText, listener),
    onSpotlight: (listener) => subscribe<SpotlightPoint>(IPC.spotlightMove, listener),
    onFreezeFrame: (listener) => subscribe<FreezeFrame>(IPC.freezeFrame, listener),
    onScreenshotBase: (listener) => subscribe<ScreenshotBase>(IPC.screenshotBase, listener),
    saveScreenshot: (dataUrl: string) => ipcRenderer.send(IPC.screenshotSave, dataUrl),
    reportHistory: (status) => ipcRenderer.send(IPC.historyStatus, status)
  },
  toolbar: {
    getState: () => ipcRenderer.invoke(IPC.getState) as Promise<OverlayState>,
    onStateChange: (listener) => subscribe<OverlayState>(IPC.stateChanged, listener),
    setMode: (mode) => ipcRenderer.send(IPC.setMode, mode),
    setTool: (tool: ToolId) => ipcRenderer.send(IPC.setTool, tool),
    setColor: (color) => ipcRenderer.send(IPC.setColor, color),
    setSize: (size) => ipcRenderer.send(IPC.setSize, size),
    setEraserMode: (mode: EraserMode) => ipcRenderer.send(IPC.setEraserMode, mode),
    setBackdrop: (mode: BackdropMode) => ipcRenderer.send(IPC.setBackdrop, mode),
    setFrozen: (frozen: boolean) => ipcRenderer.send(IPC.setFrozen, frozen),
    setDock: (dock: DockPosition) => ipcRenderer.send(IPC.setDock, dock),
    setCollapsed: (collapsed: boolean) => ipcRenderer.send(IPC.setCollapsed, collapsed),
    clear: () => ipcRenderer.send(IPC.clear),
    undo: () => ipcRenderer.send(IPC.history, 'undo'),
    redo: () => ipcRenderer.send(IPC.history, 'redo'),
    saveScreenshot: () => ipcRenderer.send(IPC.requestScreenshot),
    openPopover: (request: PopoverRequest) => ipcRenderer.send(IPC.openPopover, request),
    closePopover: () => ipcRenderer.send(IPC.closePopover),
    setInteractive: (interactive: boolean) =>
      ipcRenderer.send(IPC.setToolbarInteractive, interactive),
    setRegions: (regions: ToolbarRegion[]) => ipcRenderer.send(IPC.setToolbarRegions, regions)
  },
  popover: {
    getContext: () => ipcRenderer.invoke(IPC.popoverContext) as Promise<PopoverContext | null>,
    close: () => ipcRenderer.send(IPC.closePopover)
  },
  text: {
    getContext: () => ipcRenderer.invoke(IPC.textContext) as Promise<TextPopupContext | null>,
    commit: (text: string) => ipcRenderer.send(IPC.textCommit, text),
    cancel: () => ipcRenderer.send(IPC.textCancel)
  }
}

contextBridge.exposeInMainWorld('api', api)
