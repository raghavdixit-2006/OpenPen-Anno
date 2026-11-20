import './overlay.css'
import {
  BackdropRenderer,
  FreezeRenderer,
  InkHistory,
  OverlayRenderer,
  VelocityPressure,
  backdropFill,
  clampPan,
  constrainShapeEnd,
  createEraserStroke,
  createShape,
  createStamp,
  createStroke,
  createTextItem,
  getItemBounds,
  hitTestItem,
  identityZoom,
  isDistinctPoint,
  isShapeDrag,
  isShapeTool,
  paintItem,
  panZoom,
  pruneLaser,
  stampRadius,
  textFontSize,
  toWorld,
  zoomAt,
  zoomCss,
  type Bounds,
  type LaserPoint,
  type Point,
  type Shape,
  type ShapeStyle,
  type StrokeStyle,
  type ZoomTransform
} from '../../engine'
import type {
  FreezeFrame,
  HistoryCommand,
  OverlayState,
  ScreenshotBase,
  SpotlightPoint,
  TextCommit
} from '../../shared/ipc'

function mustGet<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element #${id}`)
  return element as T
}

const stage = mustGet<HTMLDivElement>('stage')
const viewport = mustGet<HTMLDivElement>('viewport')
const renderer = new OverlayRenderer(
  mustGet<HTMLCanvasElement>('committed'),
  mustGet<HTMLCanvasElement>('live')
)
const backdropRenderer = new BackdropRenderer(mustGet<HTMLCanvasElement>('backdrop'))
const freezeRenderer = new FreezeRenderer(mustGet<HTMLCanvasElement>('freeze'))
const history = new InkHistory()

let appState: OverlayState = {
  mode: 'passthrough',
  tool: 'pen',
  color: '#ff2d2d',
  size: 4,
  eraserMode: 'stroke',
  backdrop: 'none',
  frozen: false,
  dock: 'bottom',
  collapsed: false,
  canUndo: false,
  canRedo: false
}

let activePoints: Point[] | null = null
let activeStyle: StrokeStyle | null = null
let activeShape: Shape | null = null
let activePointerId: number | null = null
let liveFrame = 0
let shapeFrame = 0
let hoverFrame = 0
let hoverPoint: Point | null = null
let eraseFrame = 0
let eraseRegion: Bounds | null = null
let erasePoint: Point | null = null
let eraseCursorRadius = 8
let erasing = false
let erasedIds = new Set<string>()
/** Pixel-eraser path for the gesture in progress. */
let eraserPoints: Point[] | null = null
/** Last known cursor in overlay-local pixels; drives the spotlight hole. */
let spotlight: Point | null = null
let backdropFrame = 0
/** Transient laser trail (never committed to history). */
let laserPoints: LaserPoint[] = []
let laserFrame = 0
let laserDown = false
/** Monotonic counter for numbered stamps; undo does not rewind it. */
let nextStampIndex = 1
/** Frozen-frame viewport: world space is the overlay's untransformed canvas. */
let zoomTransform: ZoomTransform = identityZoom()
/** Last captured frame, kept so a window resize can repaint it. */
let frozenImage: HTMLImageElement | null = null
let panPointerId: number | null = null
let panLast: { x: number; y: number } | null = null

function applyZoom(): void {
  viewport.style.transform = zoomCss(zoomTransform)
}

/** Screen (overlay-local) coordinates to frozen-frame world coordinates. */
function worldPoint(x: number, y: number, pressure: number): Point {
  const world = toWorld(zoomTransform, { x, y })
  return { x: world.x, y: world.y, pressure }
}

/** Ends a middle/right-button pan drag without touching the ink gesture. */
function endPan(): void {
  if (panPointerId === null) return
  panPointerId = null
  panLast = null
  delete document.body.dataset.panning
}

function eraserRadius(): number {
  return Math.max(8, appState.size * 2)
}

/** Mouse input has no pressure channel, so speed stands in for it. */
const velocityPressure = new VelocityPressure()

/** The eraser and shape tools do not produce a freehand stroke. */
function styleForTool(): StrokeStyle | null {
  if (appState.tool !== 'pen' && appState.tool !== 'highlighter') return null
  return {
    tool: appState.tool,
    color: appState.color,
    width: appState.size,
    opacity: appState.tool === 'highlighter' ? 0.4 : 1
  }
}

/** Shapes draw with a solid, fully opaque stroke at the shared brush size. */
function shapeStyle(): ShapeStyle {
  return { color: appState.color, width: Math.max(1, appState.size), opacity: 1 }
}

function reportHistory(): void {
  window.api.overlay.reportHistory({ canUndo: history.canUndo, canRedo: history.canRedo })
}

/** Coalesces backdrop repaints to one per animation frame. */
function scheduleBackdropRender(): void {
  if (backdropFrame !== 0) return
  backdropFrame = requestAnimationFrame(() => {
    backdropFrame = 0
    backdropRenderer.render(appState.backdrop, spotlight)
  })
}

function renderBackdropNow(): void {
  if (backdropFrame !== 0) {
    cancelAnimationFrame(backdropFrame)
    backdropFrame = 0
  }
  backdropRenderer.render(appState.backdrop, spotlight)
}

/** Spotlight positions from main arrive in screen coordinates. */
function moveSpotlight(point: SpotlightPoint): void {
  spotlight = { x: point.x - window.screenX, y: point.y - window.screenY, pressure: 0.5 }
  if (appState.backdrop === 'spotlight') scheduleBackdropRender()
}

/**
 * The frozen screenshot arrives asynchronously from main. Only paint it while
 * the freeze is still on, otherwise a slow capture could cover the live screen
 * after the user already unfroze.
 */
function applyFreezeFrame(frame: FreezeFrame): void {
  const image = new Image()
  image.onload = () => {
    if (!appState.frozen) return
    frozenImage = image
    freezeRenderer.draw(image)
  }
  image.src = frame.dataUrl
}

/**
 * Annotated screenshots are composited here because the vector history only
 * exists in the overlay. A frozen still is already what the user sees, so it
 * wins over the fresh capture; a solid backdrop replaces the desktop entirely.
 * The current zoom/pan transform is applied so ink stays registered.
 */
function composeScreenshot(base: ScreenshotBase): void {
  const render = (image: HTMLImageElement | null): void => {
    const dpr = window.devicePixelRatio || 1
    const width =
      image && image.naturalWidth > 0
        ? image.naturalWidth
        : Math.max(1, Math.round(window.innerWidth * dpr))
    const height =
      image && image.naturalHeight > 0
        ? image.naturalHeight
        : Math.max(1, Math.round(window.innerHeight * dpr))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // A whiteboard/blackboard screenshot is the board itself, not the desktop
    // that happens to be behind the transparent overlay.
    const fill = backdropFill(appState.backdrop)
    if (fill) {
      ctx.fillStyle = fill
      ctx.fillRect(0, 0, width, height)
    }

    const ratio = window.innerWidth > 0 ? width / window.innerWidth : 1
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.translate(zoomTransform.x, zoomTransform.y)
    ctx.scale(zoomTransform.scale, zoomTransform.scale)
    if (!fill && image) ctx.drawImage(image, 0, 0, window.innerWidth, window.innerHeight)
    for (const item of history.strokes) paintItem(ctx, item)

    window.api.overlay.saveScreenshot(canvas.toDataURL('image/png'))
  }

  if (appState.frozen && frozenImage) {
    render(frozenImage)
    return
  }

  const image = new Image()
  image.onload = () => render(image)
  image.onerror = () => render(null)
  image.src = base.dataUrl
}

function resize(): void {
  const dpr = window.devicePixelRatio || 1
  renderer.resize(window.innerWidth, window.innerHeight, dpr)
  backdropRenderer.resize(window.innerWidth, window.innerHeight, dpr)
  freezeRenderer.resize(window.innerWidth, window.innerHeight, dpr)
  if (frozenImage && appState.frozen) freezeRenderer.draw(frozenImage)
  renderBackdropNow()
  renderCommitted()
}

function renderCommitted(): void {
  renderer.renderItems(history.strokes)
}

function scheduleLiveRender(): void {
  if (liveFrame !== 0) return
  liveFrame = requestAnimationFrame(() => {
    liveFrame = 0
    if (activePoints && activeStyle) renderer.renderLive(activePoints, activeStyle)
    else renderer.clearLive()
  })
}

/** Coalesces shape previews to one paint per frame, like live ink. */
function scheduleShapeRender(): void {
  if (shapeFrame !== 0) return
  shapeFrame = requestAnimationFrame(() => {
    shapeFrame = 0
    if (activeShape) renderer.renderLiveShape(activeShape)
    else renderer.clearLive()
  })
}

/**
 * Laser frames run while any sample is alive, so the trail fades even after
 * the button is released. Expired samples are pruned at the start of a frame.
 */
function laserTick(): void {
  laserFrame = 0
  const now = performance.now()
  laserPoints = pruneLaser(laserPoints, now)
  renderer.renderLaser(laserPoints, now)
  if (laserPoints.length > 0) laserFrame = requestAnimationFrame(laserTick)
}

function scheduleLaserTick(): void {
  if (laserFrame !== 0) return
  laserFrame = requestAnimationFrame(laserTick)
}

function cancelLaser(): void {
  if (laserFrame !== 0) {
    cancelAnimationFrame(laserFrame)
    laserFrame = 0
  }
  laserPoints = []
  laserDown = false
}

/**
 * Updates the in-progress shape from a raw pointer position. Shift snaps lines
 * to 45° and squares up boxes; the preview always matches what will commit.
 */
function updateShapePreview(point: Point, shift: boolean): void {
  if (!activeShape) return
  activeShape = {
    ...activeShape,
    end: shift ? constrainShapeEnd(activeShape.tool, activeShape.start, point) : point
  }
  scheduleShapeRender()
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

/**
 * Pixel eraser drag: clear the new trail pixels on the committed layer and
 * keep the cursor ring on the live layer. Both are coalesced to one frame.
 */
function erasePixel(point: Point): void {
  if (!eraserPoints) return
  const last = eraserPoints[eraserPoints.length - 1]
  if (!last || isDistinctPoint(last, point)) eraserPoints.push(point)

  erasePoint = point
  eraseCursorRadius = eraserRadius()

  if (eraseFrame !== 0) return
  eraseFrame = requestAnimationFrame(() => {
    eraseFrame = 0
    if (eraserPoints) renderer.renderEraseTrail(eraserPoints, eraserRadius())
    if (erasePoint) renderer.renderEraserCursor(erasePoint, eraseCursorRadius)
  })
}

/** Starts either eraser mode: id-based removal or destructive pixels. */
function beginErase(point: Point): void {
  erasing = true
  erasedIds = new Set()
  eraserPoints = appState.eraserMode === 'pixel' ? [point] : null
  eraseCursorRadius = eraserRadius()
  erasePoint = point

  if (eraserPoints) erasePixel(point)
  else renderErasePreview(point)
}

function collectPoints(event: PointerEvent, pointerType: string): Point[] {
  const coalesced = event.getCoalescedEvents?.() ?? []
  const samples = coalesced.length > 0 ? coalesced : [event]
  return samples.map((sample) => {
    const world = toWorld(zoomTransform, { x: sample.clientX, y: sample.clientY })
    return {
      x: world.x,
      y: world.y,
      // A stylus reports real pressure; everything else derives it from speed.
      pressure:
        pointerType === 'pen'
          ? sample.pressure
          : velocityPressure.sample(sample.clientX, sample.clientY, sample.timeStamp)
    }
  })
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

function cancelShapeFrame(): void {
  if (shapeFrame !== 0) {
    cancelAnimationFrame(shapeFrame)
    shapeFrame = 0
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

  for (const item of history.strokes) {
    if (!erasedIds.has(item.id) && hitTestItem(item, point, radius)) {
      erasedIds.add(item.id)
      eraseRegion = unionBounds(eraseRegion, getItemBounds(item))
    }
  }

  erasePoint = point
  eraseCursorRadius = radius

  if (eraseFrame !== 0) return
  eraseFrame = requestAnimationFrame(() => {
    eraseFrame = 0
    if (eraseRegion) {
      const visible = history.strokes.filter((item) => !erasedIds.has(item.id))
      renderer.repaintItemRegion(visible, eraseRegion)
      eraseRegion = null
    }
    if (erasePoint) renderer.renderEraserCursor(erasePoint, eraseCursorRadius)
  })
}

/** Commits whichever gesture is running: ink stroke, shape or erase drag. */
function finishGesture(): void {
  cancelLiveFrame()
  cancelShapeFrame()
  cancelEraseFrame()

  // The laser leaves no history item; releasing simply stops feeding samples
  // and the fade loop keeps running until the trail expires.
  if (laserDown) {
    laserDown = false
    activePointerId = null
    scheduleLaserTick()
    return
  }

  if (erasing) {
    const pixelMode = appState.eraserMode === 'pixel'
    const points = eraserPoints
    const ids = Array.from(erasedIds)
    erasing = false
    erasedIds = new Set()
    eraserPoints = null
    activePointerId = null

    if (pixelMode) {
      // The committed layer already shows the swipe; the history item replays
      // it on undo/redo and survives region repaints.
      if (points && points.length > 0) {
        history.add(createEraserStroke(points, eraserRadius()))
        reportHistory()
      }
    } else if (history.remove(ids)) {
      renderCommitted()
      reportHistory()
    }
    renderer.clearLive()
    return
  }

  if (activeShape) {
    const shape = activeShape
    activeShape = null
    activePointerId = null
    renderer.clearLive()

    // A click with no drag should not leave an invisible zero-size item.
    if (isShapeDrag(shape.start, shape.end)) {
      history.add(shape)
      renderer.paintItem(shape)
      reportHistory()
    }
    return
  }

  if (activePoints && activeStyle) {
    if (activePoints.length > 0) {
      const stroke = createStroke(activePoints, activeStyle)
      history.add(stroke)
      // The committed layer already holds every earlier item; painting just
      // the new one avoids a full clear + full history replay per stroke.
      renderer.paintItem(stroke)
      reportHistory()
    }
    activePoints = null
    activeStyle = null
    activePointerId = null
    renderer.endLiveStroke()
  }
}

function cancelGesture(): void {
  // Pixel erasing is destructive, so an aborted gesture must repaint the
  // committed layer from history to bring the cleared pixels back.
  const restorePixels =
    erasing && appState.eraserMode === 'pixel' && (eraserPoints?.length ?? 0) > 0

  cancelLiveFrame()
  cancelShapeFrame()
  cancelEraseFrame()
  cancelLaser()
  activePoints = null
  activeStyle = null
  activeShape = null
  activePointerId = null
  erasing = false
  erasedIds = new Set()
  eraserPoints = null
  renderer.clearLive()
  if (restorePixels) renderCommitted()
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
  const panButton = appState.frozen && (event.button === 1 || event.button === 2)
  if (event.pointerType === 'mouse' && event.button !== 0 && !panButton) return

  event.preventDefault()
  finishGesture()

  // The options panel floats above the canvas; the first press on the canvas
  // dismisses it so it never covers the stroke.
  window.api.popover.close()

  // While frozen, middle/right drag pans the paused frame instead of drawing.
  if (panButton) {
    panPointerId = event.pointerId
    panLast = { x: event.clientX, y: event.clientY }
    document.body.dataset.panning = 'true'
    stage.setPointerCapture(event.pointerId)
    return
  }

  // A fading laser owns the live layer; any other gesture takes it over.
  if (appState.tool !== 'laser') {
    cancelLaser()
    renderer.clearLive()
  }

  if (appState.tool === 'eraser') {
    activePointerId = event.pointerId
    stage.setPointerCapture(event.pointerId)
    beginErase(worldPoint(event.clientX, event.clientY, event.pressure))
    return
  }

  if (appState.tool === 'laser') {
    laserDown = true
    const point = worldPoint(event.clientX, event.clientY, event.pressure)
    laserPoints = [{ ...point, time: performance.now() }]
    activePointerId = event.pointerId
    stage.setPointerCapture(event.pointerId)
    scheduleLaserTick()
    return
  }

  if (appState.tool === 'stamp') {
    const point = worldPoint(event.clientX, event.clientY, event.pressure)
    const stamp = createStamp(
      nextStampIndex++,
      point.x,
      point.y,
      { color: appState.color, opacity: 1 },
      stampRadius(appState.size)
    )
    history.add(stamp)
    renderer.paintItem(stamp)
    reportHistory()
    return
  }

  if (isShapeTool(appState.tool)) {
    const start = worldPoint(event.clientX, event.clientY, event.pressure)
    activeShape = createShape(appState.tool, start, start, shapeStyle())
    activePointerId = event.pointerId
    stage.setPointerCapture(event.pointerId)
    renderer.beginLiveStroke()
    scheduleShapeRender()
    return
  }

  if (appState.tool === 'text') {
    const point = worldPoint(event.clientX, event.clientY, event.pressure)
    window.api.overlay.openTextPopup({
      x: point.x,
      y: point.y,
      screenX: event.screenX,
      screenY: event.screenY
    })
    return
  }

  velocityPressure.reset()
  activePoints = collectPoints(event, event.pointerType)
  activeStyle = styleForTool()
  activePointerId = event.pointerId
  stage.setPointerCapture(event.pointerId)
  renderer.beginLiveStroke()
  scheduleLiveRender()
})

stage.addEventListener('pointermove', (event) => {
  if (panPointerId === event.pointerId) {
    event.preventDefault()
    if (panLast) {
      const next = panZoom(zoomTransform, event.clientX - panLast.x, event.clientY - panLast.y)
      zoomTransform = clampPan(next, window.innerWidth, window.innerHeight)
      applyZoom()
    }
    // Track the raw cursor even when the pan was clamped, otherwise the frame
    // would jump once the pointer comes back inside the allowed range.
    panLast = { x: event.clientX, y: event.clientY }
    return
  }

  // In draw mode the overlay sees the cursor directly, so the spotlight can
  // follow every event instead of waiting for the 25 Hz main poll. In
  // passthrough the overlay never receives pointer events; main polls instead.
  if (appState.backdrop === 'spotlight') {
    spotlight = { x: event.clientX, y: event.clientY, pressure: event.pressure }
    scheduleBackdropRender()
  }

  if (event.pointerId !== activePointerId) {
    // Hover feedback for the eraser before the user presses the button.
    if (appState.tool === 'eraser' && !erasing) {
      scheduleEraserHover(worldPoint(event.clientX, event.clientY, event.pressure))
    }
    return
  }

  if (laserDown) {
    event.preventDefault()
    const point: LaserPoint = {
      ...worldPoint(event.clientX, event.clientY, event.pressure),
      time: performance.now()
    }
    const last = laserPoints[laserPoints.length - 1]
    if (!last || isDistinctPoint(last, point)) laserPoints.push(point)
    scheduleLaserTick()
    return
  }

  if (activeShape) {
    event.preventDefault()
    updateShapePreview(worldPoint(event.clientX, event.clientY, event.pressure), event.shiftKey)
    return
  }

  if (erasing) {
    event.preventDefault()
    const point = worldPoint(event.clientX, event.clientY, event.pressure)
    if (appState.eraserMode === 'pixel') erasePixel(point)
    else renderErasePreview(point)
    return
  }

  if (!activePoints) return
  event.preventDefault()
  appendPoints(collectPoints(event, event.pointerType))
  scheduleLiveRender()
})

for (const type of ['pointerup', 'pointercancel'] as const) {
  stage.addEventListener(type, (event) => {
    if (event.pointerId === panPointerId) {
      endPan()
      return
    }
    if (event.pointerId !== activePointerId) return
    finishGesture()
  })
}

stage.addEventListener('contextmenu', (event) => event.preventDefault())

// Wheel zoom only exists while a frame is frozen. It is anchored at the
// pointer, and clamping keeps the screenshot covering the whole viewport.
stage.addEventListener(
  'wheel',
  (event) => {
    if (!appState.frozen) return
    event.preventDefault()
    const delta = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    const scale = zoomTransform.scale * Math.exp(-delta * 0.0015)
    zoomTransform = clampPan(
      zoomAt(zoomTransform, { x: event.clientX, y: event.clientY }, scale),
      window.innerWidth,
      window.innerHeight
    )
    applyZoom()
  },
  { passive: false }
)

function applyState(next: OverlayState): void {
  const modeChanged = next.mode !== appState.mode
  const toolChanged = next.tool !== appState.tool
  const eraserModeChanged = next.eraserMode !== appState.eraserMode
  const backdropChanged = next.backdrop !== appState.backdrop
  const frozenChanged = next.frozen !== appState.frozen

  // Commit a gesture before it could be misattributed to the new tool or
  // eraser mode. Switching to passthrough can also lose the pointerup, so the
  // gesture must be committed.
  if (toolChanged || eraserModeChanged || (modeChanged && next.mode === 'passthrough')) {
    finishGesture()
  }

  if (frozenChanged) {
    endPan()
    // Both directions start from a clean viewport: freezing always opens at 1×,
    // and unfreezing must not leave the live screen translated or scaled.
    zoomTransform = identityZoom()
    if (!next.frozen) {
      frozenImage = null
      freezeRenderer.clear()
    }
  }

  appState = next
  document.body.dataset.mode = next.mode
  document.body.dataset.tool = next.tool
  if (frozenChanged) {
    document.body.dataset.frozen = next.frozen ? 'true' : 'false'
    applyZoom()
  }

  if (backdropChanged) renderBackdropNow()
  if (toolChanged || modeChanged) {
    cancelLaser()
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
window.api.overlay.onSpotlight(moveSpotlight)
window.api.overlay.onFreezeFrame(applyFreezeFrame)
window.api.overlay.onScreenshotBase(composeScreenshot)
window.api.overlay.onCommitText((commit: TextCommit) => {
  finishGesture()
  const item = createTextItem(commit.text, commit.x, commit.y, {
    color: commit.color,
    fontSize: textFontSize(commit.size),
    opacity: 1
  })
  history.add(item)
  renderer.paintItem(item)
  reportHistory()
})
window.api.overlay.getState().then(applyState)

resize()
reportHistory()
