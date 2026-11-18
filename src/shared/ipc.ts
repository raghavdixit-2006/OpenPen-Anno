/**
 * Contract shared by the main process, the preload bridge and the windows.
 * Keep this file free of Electron and DOM APIs.
 */

export type OverlayMode = 'draw' | 'passthrough'

export type ToolId = 'pen' | 'highlighter' | 'eraser'

export type HistoryCommand = 'undo' | 'redo'

/** Edge of the screen the toolbar dock is anchored to. */
export type DockPosition = 'bottom' | 'top' | 'left' | 'right'

/** Authoritative app state, owned by the main process and mirrored in the UI. */
export interface OverlayState {
  mode: OverlayMode
  tool: ToolId
  color: string
  size: number
  dock: DockPosition
  /** Compact pill instead of the full control bar. */
  collapsed: boolean
  canUndo: boolean
  canRedo: boolean
}

export interface HistoryStatus {
  canUndo: boolean
  canRedo: boolean
}

export const IPC = {
  // both windows -> main
  getState: 'inkspace:get-state',
  setMode: 'inkspace:set-mode',
  setTool: 'inkspace:set-tool',
  setColor: 'inkspace:set-color',
  setSize: 'inkspace:set-size',
  setDock: 'inkspace:set-dock',
  setCollapsed: 'inkspace:set-collapsed',
  clear: 'inkspace:clear',
  history: 'inkspace:history',
  historyStatus: 'inkspace:history-status',
  // main -> both windows
  stateChanged: 'inkspace:state-changed'
} as const

export interface InkspaceApi {
  overlay: {
    getState: () => Promise<OverlayState>
    onStateChange: (listener: (state: OverlayState) => void) => () => void
    onClear: (listener: () => void) => () => void
    onHistory: (listener: (command: HistoryCommand) => void) => () => void
    reportHistory: (status: HistoryStatus) => void
  }
  toolbar: {
    getState: () => Promise<OverlayState>
    onStateChange: (listener: (state: OverlayState) => void) => () => void
    setMode: (mode: OverlayMode) => void
    setTool: (tool: ToolId) => void
    setColor: (color: string) => void
    setSize: (size: number) => void
    setDock: (dock: DockPosition) => void
    setCollapsed: (collapsed: boolean) => void
    clear: () => void
    undo: () => void
    redo: () => void
  }
}
