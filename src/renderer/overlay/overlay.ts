import './overlay.css'
import {
  OverlayRenderer,
  StrokeHistory,
  createStroke,
  getStrokeBounds,
  hitTestStroke,
  isDistinctPoint,
  type Bounds,
  type Point,
  type StrokeStyle
} from '../../engine'
import type { HistoryCommand, OverlayState } from '../../shared/ipc'

function mustGet<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as T
}

const stage = mustGet<HTMLDivElement>('stage')
const renderer = new OverlayRenderer(
  mustGet<HTMLCanvasElement>('committed'),
  mustGet<HTMLCanvasElement>('live')
)
const history = new StrokeHistory()

let appState: OverlayState = {
  mode: 'passthrough',
  tool: 'pen',
  color: '#ff2d2d',
  size: 4,
  dock: 'bottom',
  canUndo: false,
  canRedo: false
}

let activePoints: Point[] | null = null
let activeStyle: StrokeStyle | null = null
let activePointerId: number | null = null
let liveFrame = 0
let hoverFrame = 0
let hoverPoint: Point | null = null
let eraseFrame = 0
let eraseRegion: Bounds | null = null
let erasePoint: Point | null = null
let eraseCursorRadius = 8
let erasing = false
let erasedIds = new Set<string>()

function eraserRadius(): number {
  return Math.max(8, appState.size * 2)
}

/** The eraser is not a stroke: it removes strokes on the committed layer. */
function styleForTool(): StrokeStyle | null {
  if (appState.tool === 'eraser') return null
  return {
    tool: appState.tool,
    color: appState.color,
    width: appState.size,
    // Smooth highlighter rendering (multiply blend, wider nib) lands in step 4.
    opacity: appState.tool === 'highlighter' ? 0.4 : 1
  }
}

function reportHistory(): void {
  window.api.overlay.reportHistory({ canUndo: history.canUndo, canRedo: history.canRedo })
}

function resize(): void {
  renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1)
  renderCommitted()
}

function renderCommitted(): void {
  renderer.renderStrokes(history.strokes)
}

function scheduleLiveRender(): void {
  if (liveFrame !== 0) return
  liveFrame = requestAnimationFrame(() => {
    liveFrame = 0
    if (activePoints && activeStyle) renderer.renderLive(activePoints, activeStyle)
    else renderer.clearLive()
  })
}

/**
 * Mouse move can fire far above the display refresh rate. Coalesce the eraser
 * hover ring to one repaint per frame.
 */
function scheduleEraserHover(point: Point): void {
  hoverPoint = point
  if (hoverFrame !== 0) return
  hoverFrame = requestAnimationFrame(() => {
    hoverFrame = 0
    if (hoverPoint && appState.tool === 'eraser' && !erasing) {
      renderer.renderEraserCursor(hoverPoint, eraserRadius())
    }
  })
}

function collectPoints(event: PointerEvent): Point[] {
  const coalesced = event.getCoalescedEvents?.() ?? []
  const samples = coalesced.length > 0 ? coalesced : [event]
  return samples.map((sample) => ({
    x: sample.clientX,
    y: sample.clientY,
    pressure: sample.pressure
  }))
}

function appendPoints(points: readonly Point[]): void {
  if (!activePoints) return
  for (const point of points) {
    if (isDistinctPoint(activePoints[activePoints.length - 1], point)) {
      activePoints.push(point)
    }
  }
}

function cancelLiveFrame(): void {
  if (liveFrame !== 0) {
    cancelAnimationFrame(liveFrame)
    liveFrame = 0
  }
}

function cancelEraseFrame(): void {
  if (eraseFrame !== 0) {
    cancelAnimationFrame(eraseFrame)
    eraseFrame = 0
  }
  eraseRegion = null
  erasePoint = null
}

function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b
  if (!b) return a
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  }
}

/**
 * Hit-testing runs on every pointer event so a fast drag never skips a stroke,
 * but the repaint is coalesced to one per frame. Repainting the committed layer
 * once per raw event starves the Windows compositor.
 */
function renderErasePreview(point: Point): void {
  const radius = eraserRadius()

  for (const stroke of history.strokes) {
    if (!erasedIds.has(stroke.id) && hitTestStroke(stroke, point, radius)) {
      erasedIds.add(stroke.id)
      eraseRegion = unionBounds(eraseRegion, getStrokeBounds(stroke))
    }
  }

  erasePoint = point
  eraseCursorRadius = radius

  if (eraseFrame !== 0) return
  eraseFrame = requestAnimationFrame(() => {
    eraseFrame = 0
    if (eraseRegion) {
      const visible = history.strokes.filter((stroke) => !erasedIds.has(stroke.id))
      renderer.repaintCommittedRegion(visible, eraseRegion)
      eraseRegion = null
    }
    if (erasePoint) renderer.renderEraserCursor(erasePoint, eraseCursorRadius)
  })
}

/** Commits whichever gesture is running: ink stroke or erase drag. */
function finishGesture(): void {
  cancelLiveFrame()
  cancelEraseFrame()

  if (erasing) {
    const ids = Array.from(erasedIds)
    erasing = false
    erasedIds = new Set()
    activePointerId = null
    if (history.remove(ids)) {
      renderCommitted()
      reportHistory()
    }
    renderer.clearLive()
    return
  }

  if (activePoints && activeStyle) {
    if (activePoints.length > 0) {
      const stroke = createStroke(activePoints, activeStyle)
      history.add(stroke)
      // The committed layer already holds every earlier stroke; painting just
      // the new one avoids a full clear + full history replay per stroke.
      renderer.paintStroke(stroke)
      reportHistory()
    }
    activePoints = null
    activeStyle = null
    activePointerId = null
    renderer.endLiveStroke()
  }
}

function cancelGesture(): void {
  cancelLiveFrame()
  cancelEraseFrame()
  activePoints = null
  activeStyle = null
  activePointerId = null
  erasing = false
  erasedIds = new Set()
  renderer.clearLive()
}

function undo(): void {
  cancelGesture()
  if (history.undo()) {
    renderCommitted()
    reportHistory()
  }
}

function redo(): void {
  cancelGesture()
  if (history.redo()) {
    renderCommitted()
    reportHistory()
  }
}

function clearAll(): void {
  cancelGesture()
  if (history.clear()) {
    renderCommitted()
    reportHistory()
  }
}

stage.addEventListener('pointerdown', (event) => {
  if (!event.isPrimary) return
  if (event.pointerType === 'mouse' && event.button !== 0) return

  event.preventDefault()
  finishGesture()

  if (appState.tool === 'eraser') {
    erasing = true
    erasedIds = new Set()
    activePointerId = event.pointerId
    stage.setPointerCapture(event.pointerId)
    renderErasePreview({ x: event.clientX, y: event.clientY, pressure: event.pressure })
    return
  }

  activePoints = collectPoints(event)
  activeStyle = styleForTool()
  activePointerId = event.pointerId
  stage.setPointerCapture(event.pointerId)
  renderer.beginLiveStroke()
  scheduleLiveRender()
})

stage.addEventListener('pointermove', (event) => {
  if (event.pointerId !== activePointerId) {
    // Hover feedback for the eraser before the user presses the button.
    if (appState.tool === 'eraser' && !erasing) {
      scheduleEraserHover({ x: event.clientX, y: event.clientY, pressure: event.pressure })
    }
    return
  }

  if (erasing) {
    event.preventDefault()
    renderErasePreview({ x: event.clientX, y: event.clientY, pressure: event.pressure })
    return
  }

  if (!activePoints) return
  event.preventDefault()
  appendPoints(collectPoints(event))
  scheduleLiveRender()
})

for (const type of ['pointerup', 'pointercancel'] as const) {
  stage.addEventListener(type, (event) => {
    if (event.pointerId !== activePointerId) return
    finishGesture()
  })
}

stage.addEventListener('contextmenu', (event) => event.preventDefault())

function applyState(next: OverlayState): void {
  const modeChanged = next.mode !== appState.mode
  const toolChanged = next.tool !== appState.tool

  // Commit a gesture before it could be misattributed to the new tool. Switching
  // to passthrough can also lose the pointerup, so the stroke must be committed.
  if (toolChanged || (modeChanged && next.mode === 'passthrough')) finishGesture()

  appState = next
  document.body.dataset.mode = next.mode
  document.body.dataset.tool = next.tool

  if (toolChanged || modeChanged) {
    renderCommitted()
    renderer.clearLive()
  }
}

window.addEventListener('resize', resize)

window.api.overlay.onStateChange(applyState)
window.api.overlay.onClear(clearAll)
window.api.overlay.onHistory((command: HistoryCommand) => {
  if (command === 'undo') undo()
  else redo()
})
window.api.overlay.getState().then(applyState)

resize()
reportHistory()
