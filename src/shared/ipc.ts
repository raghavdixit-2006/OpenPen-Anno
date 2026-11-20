/**
 * Contract shared by the main process, the preload bridge and the windows.
 * Keep this file free of Electron and DOM APIs.
 */

import type { BackdropMode, ShapeTool } from '../engine/types'

export type { BackdropMode, ShapeTool }

export type OverlayMode = 'draw' | 'passthrough'

export type ToolId = 'pen' | 'highlighter' | 'eraser' | 'text' | 'laser' | 'stamp' | ShapeTool

/** Whole-stroke removal vs. clearing individual pixels. */
export type EraserMode = 'stroke' | 'pixel'

/** Hard cap shared by the popup and main-process validation. */
export const TEXT_MAX_LENGTH = 500

/** Overlay -> main request: where the text belongs and where to show the editor. */
export interface TextPopupRequest {
  /** Overlay-local CSS pixels, used as the text anchor when committed. */
  x: number
  y: number
  /** Screen coordinates, used to place the popup on the right display. */
  screenX: number
  screenY: number
}

/** Main -> popup initial style. */
export interface TextPopupContext {
  color: string
  size: number
  maxLength: number
}

/** Main -> overlay when the user confirms the popup. */
export interface TextCommit {
  text: string
  x: number
  y: number
  color: string
  size: number
}

/** Main -> overlay: current cursor position in screen coordinates. */
export interface SpotlightPoint {
  x: number
  y: number
}

/** Main -> overlay: native-resolution screenshot of the frozen display. */
export interface FreezeFrame {
  dataUrl: string
}

/**
 * Main -> overlay: a fresh display capture used as the background of a saved
 * annotated screenshot. The overlay owns the ink, so it does the compositing.
 */
export interface ScreenshotBase {
  dataUrl: string
}

export type HistoryCommand = 'undo' | 'redo'

/** Which panel the floating tool-options window should show. */
export type PopoverKind = 'tool' | 'shapes'

/**
 * Trigger rectangle in the toolbar window's own CSS pixels. Main adds the
 * window origin, so a pane on a scaled monitor never has to guess screen
 * coordinates.
 */
export interface PopoverAnchor {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Toolbar -> main request to show the options panel next to a control. The
 * anchor is window-local; main converts it to screen DIP with the toolbar's
 * current bounds.
 */
export interface PopoverRequest {
  kind: PopoverKind
  anchor: PopoverAnchor
}

/** Main -> options panel: what to render plus the state it edits. */
export interface PopoverContext {
  kind: PopoverKind
  tool: ToolId
  color: string
  size: number
  eraserMode: EraserMode
}

/** Edge of the screen the toolbar dock is anchored to. */
export type DockPosition = 'bottom' | 'top' | 'left' | 'right'

/** Authoritative app state, owned by the main process and mirrored in the UI. */
export interface OverlayState {
  mode: OverlayMode
  tool: ToolId
  color: string
  size: number
  eraserMode: EraserMode
  backdrop: BackdropMode
  /** Screenshot frozen under the ink for zoom/pan; never persisted. */
  frozen: boolean
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
  getState: 'openpen-anno:get-state',
  setMode: 'openpen-anno:set-mode',
  setTool: 'openpen-anno:set-tool',
  setColor: 'openpen-anno:set-color',
  setSize: 'openpen-anno:set-size',
  setEraserMode: 'openpen-anno:set-eraser-mode',
  setBackdrop: 'openpen-anno:set-backdrop',
  setFrozen: 'openpen-anno:set-frozen',
  setDock: 'openpen-anno:set-dock',
  setCollapsed: 'openpen-anno:set-collapsed',
  clear: 'openpen-anno:clear',
  history: 'openpen-anno:history',
  historyStatus: 'openpen-anno:history-status',
  openTextPopup: 'openpen-anno:open-text-popup',
  textContext: 'openpen-anno:text-context',
  textCommit: 'openpen-anno:text-commit',
  textCancel: 'openpen-anno:text-cancel',
  openPopover: 'openpen-anno:open-popover',
  closePopover: 'openpen-anno:close-popover',
  popoverContext: 'openpen-anno:popover-context',
  requestScreenshot: 'openpen-anno:request-screenshot',
  screenshotSave: 'openpen-anno:screenshot-save',
  // main -> both windows
  stateChanged: 'openpen-anno:state-changed',
  // main -> overlay
  commitText: 'openpen-anno:commit-text',
  spotlightMove: 'openpen-anno:spotlight-move',
  freezeFrame: 'openpen-anno:freeze-frame',
  screenshotBase: 'openpen-anno:screenshot-base'
} as const

export interface OpenPenAnnoApi {
  overlay: {
    getState: () => Promise<OverlayState>
    onStateChange: (listener: (state: OverlayState) => void) => () => void
    onClear: (listener: () => void) => () => void
    onHistory: (listener: (command: HistoryCommand) => void) => () => void
    openTextPopup: (request: TextPopupRequest) => void
    onCommitText: (listener: (commit: TextCommit) => void) => () => void
    onSpotlight: (listener: (point: SpotlightPoint) => void) => () => void
    onFreezeFrame: (listener: (frame: FreezeFrame) => void) => () => void
    onScreenshotBase: (listener: (base: ScreenshotBase) => void) => () => void
    saveScreenshot: (dataUrl: string) => void
    reportHistory: (status: HistoryStatus) => void
  }
  toolbar: {
    getState: () => Promise<OverlayState>
    onStateChange: (listener: (state: OverlayState) => void) => () => void
    setMode: (mode: OverlayMode) => void
    setTool: (tool: ToolId) => void
    setColor: (color: string) => void
    setSize: (size: number) => void
    setEraserMode: (mode: EraserMode) => void
    setBackdrop: (mode: BackdropMode) => void
    setFrozen: (frozen: boolean) => void
    setDock: (dock: DockPosition) => void
    setCollapsed: (collapsed: boolean) => void
    clear: () => void
    undo: () => void
    redo: () => void
    saveScreenshot: () => void
    openPopover: (request: PopoverRequest) => void
    closePopover: () => void
  }
  popover: {
    getContext: () => Promise<PopoverContext | null>
    close: () => void
  }
  text: {
    getContext: () => Promise<TextPopupContext | null>
    commit: (text: string) => void
    cancel: () => void
  }
}
