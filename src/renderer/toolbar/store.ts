import { create } from 'zustand'
import type { OverlayMode, OverlayState, ToolId } from '../../shared/ipc'

interface ToolbarStore extends OverlayState {
  applyState: (state: OverlayState) => void
  selectTool: (tool: ToolId) => void
  selectColor: (color: string) => void
  changeSize: (size: number) => void
  toggleMode: () => void
  undo: () => void
  redo: () => void
  clear: () => void
}

export const useToolbarStore = create<ToolbarStore>((set, get) => ({
  mode: 'passthrough',
  tool: 'pen',
  color: '#ff2d2d',
  size: 4,
  canUndo: false,
  canRedo: false,

  // Main is the single source of truth; every broadcast reconciles the store.
  applyState: (state) => set(state),

  // Local updates are optimistic so the UI reacts on the same frame. The main
  // process validates and echoes the value back.
  selectTool: (tool) => {
    set({ tool })
    window.api.toolbar.setTool(tool)
  },
  selectColor: (color) => {
    set({ color })
    window.api.toolbar.setColor(color)
  },
  changeSize: (size) => {
    set({ size })
    window.api.toolbar.setSize(size)
  },
  toggleMode: () => {
    const mode: OverlayMode = get().mode === 'draw' ? 'passthrough' : 'draw'
    set({ mode })
    window.api.toolbar.setMode(mode)
  },
  undo: () => window.api.toolbar.undo(),
  redo: () => window.api.toolbar.redo(),
  clear: () => window.api.toolbar.clear()
}))
