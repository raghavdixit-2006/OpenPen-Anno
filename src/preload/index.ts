import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type DockPosition,
  type HistoryCommand,
  type InkspaceApi,
  type OverlayState,
  type ToolId
} from '../shared/ipc'

function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => ipcRenderer.removeListener(channel, handler)
}

// Minimal, typed surface. No raw ipcRenderer and no Node.js are exposed.
const api: InkspaceApi = {
  overlay: {
    getState: () => ipcRenderer.invoke(IPC.getState) as Promise<OverlayState>,
    onStateChange: (listener) => subscribe<OverlayState>(IPC.stateChanged, listener),
    onClear: (listener) => subscribe<void>(IPC.clear, () => listener()),
    onHistory: (listener) => subscribe<HistoryCommand>(IPC.history, listener),
    reportHistory: (status) => ipcRenderer.send(IPC.historyStatus, status)
  },
  toolbar: {
    getState: () => ipcRenderer.invoke(IPC.getState) as Promise<OverlayState>,
    onStateChange: (listener) => subscribe<OverlayState>(IPC.stateChanged, listener),
    setMode: (mode) => ipcRenderer.send(IPC.setMode, mode),
    setTool: (tool: ToolId) => ipcRenderer.send(IPC.setTool, tool),
    setColor: (color) => ipcRenderer.send(IPC.setColor, color),
    setSize: (size) => ipcRenderer.send(IPC.setSize, size),
    setDock: (dock: DockPosition) => ipcRenderer.send(IPC.setDock, dock),
    clear: () => ipcRenderer.send(IPC.clear),
    undo: () => ipcRenderer.send(IPC.history, 'undo'),
    redo: () => ipcRenderer.send(IPC.history, 'redo')
  }
}

contextBridge.exposeInMainWorld('api', api)
