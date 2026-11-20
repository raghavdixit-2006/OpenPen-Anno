import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react'
import { useToolbarStore } from './store'
import { dockMorph } from './geometry'
import {
  CONTROL_VARIANTS,
  chevronSpin,
  surfaceVariants,
  tabTuckVariants,
  tabVariants,
  tapProps
} from './animation'
import {
  BackdropIcon,
  ChevronIcon,
  DockIcon,
  FreezeIcon,
  PenIcon,
  PointerIcon,
  RedoIcon,
  ScreenshotIcon,
  ShapesIcon,
  TrashIcon,
  UndoIcon,
  type ChevronDirection
} from './icons'
import {
  BACKDROP_LABELS,
  DOCK_OPTIONS,
  SHAPE_TOOLS,
  TOOLS,
  nextBackdrop,
  optionsKindFor
} from './catalog'
import type { PopoverAnchor, PopoverKind, ToolId } from '../../shared/ipc'

const ICON_BUTTON =
  'grid shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors enabled:hover:bg-white/10 enabled:hover:text-zinc-100 disabled:cursor-default disabled:opacity-30'

/**
 * The toolbar window only owns the rail itself: colour, size, eraser mode and
 * the shape picker live in a separate options window (see `popoverWindow.ts`).
 * The trigger rect is sent in this window's CSS pixels; main adds the window
 * origin so panel placement stays correct on scaled displays.
 */
function panelAnchor(element: HTMLElement): PopoverAnchor {
  const rect = element.getBoundingClientRect()
  return {
    x: Math.round(rect.left),
    y: Math.round(rect.top),
    width: Math.round(rect.width),
    height: Math.round(rect.height)
  }
}

function Grip({ vertical }: { vertical: boolean }): ReactElement {
  return (
    <motion.div
      variants={CONTROL_VARIANTS}
      className={`app-drag flex shrink-0 items-center justify-center ${
        vertical ? 'h-4 w-full' : 'h-9 w-6'
      }`}
      aria-hidden="true"
    >
      <span className={`rounded-full bg-white/25 ${vertical ? 'h-1 w-6' : 'h-5 w-1'}`} />
    </motion.div>
  )
}

function Divider({ vertical }: { vertical: boolean }): ReactElement {
  return (
    <motion.div
      variants={CONTROL_VARIANTS}
      className={`shrink-0 bg-white/15 ${vertical ? 'h-px w-full' : 'h-5 w-px'}`}
      aria-hidden="true"
    />
  )
}

export default function App(): ReactElement {
  const mode = useToolbarStore((state) => state.mode)
  const tool = useToolbarStore((state) => state.tool)
  const backdrop = useToolbarStore((state) => state.backdrop)
  const frozen = useToolbarStore((state) => state.frozen)
  const dock = useToolbarStore((state) => state.dock)
  const collapsed = useToolbarStore((state) => state.collapsed)
  const canUndo = useToolbarStore((state) => state.canUndo)
  const canRedo = useToolbarStore((state) => state.canRedo)

  const selectTool = useToolbarStore((state) => state.selectTool)
  const changeBackdrop = useToolbarStore((state) => state.changeBackdrop)
  const toggleFrozen = useToolbarStore((state) => state.toggleFrozen)
  const moveDock = useToolbarStore((state) => state.moveDock)
  const toggleCollapsed = useToolbarStore((state) => state.toggleCollapsed)
  const toggleMode = useToolbarStore((state) => state.toggleMode)
  const undo = useToolbarStore((state) => state.undo)
  const redo = useToolbarStore((state) => state.redo)
  const clear = useToolbarStore((state) => state.clear)
  const saveScreenshot = useToolbarStore((state) => state.saveScreenshot)

  const reduce = useReducedMotion() === true
  const activeShape = SHAPE_TOOLS.find((shape) => shape.id === tool)
  const ShapeIcon = activeShape?.Icon ?? ShapesIcon

  /**
   * Collapse is optimistic: the bar folds first, and only when the fold has
   * finished (`onExitComplete`) does it ask main to shrink the window. Expand
   * follows main: the window grows before the broadcast, so the bar unfolds
   * inside its final bounds. Main stays the single source of truth.
   */
  const [uiCollapsed, setUiCollapsed] = useState(collapsed)
  const pendingCollapse = useRef(false)

  useEffect(() => {
    setUiCollapsed(collapsed)
  }, [collapsed])

  const requestCollapse = (): void => {
    if (uiCollapsed) return
    pendingCollapse.current = true
    setUiCollapsed(true)
  }

  const requestExpand = (): void => {
    if (!uiCollapsed) return
    pendingCollapse.current = false
    setUiCollapsed(false)
    toggleCollapsed(false)
  }

  const handleExitComplete = (): void => {
    if (pendingCollapse.current) {
      pendingCollapse.current = false
      toggleCollapsed(true)
    }
  }

  const vertical = dock === 'left' || dock === 'right'
  const drawing = mode === 'draw'

  // The chevrons point at the edge the bar is anchored to: collapsing tucks it
  // into that edge, expanding pulls it back out.
  const collapseDirection: ChevronDirection =
    dock === 'bottom' ? 'down' : dock === 'top' ? 'up' : dock === 'left' ? 'left' : 'right'
  const expandDirection: ChevronDirection =
    dock === 'bottom' ? 'up' : dock === 'top' ? 'down' : dock === 'left' ? 'right' : 'left'

  const morph = useMemo(() => dockMorph(dock), [dock])
  const barVariants = useMemo(() => surfaceVariants(morph, reduce), [morph, reduce])
  // Long-axis centring as Motion x/y values — Motion writes its own transform
  // and would clobber a CSS translate on the same element.
  const tabCentre = useMemo(() => (vertical ? { y: '-50%' } : { x: '-50%' }), [vertical])
  const tabV = useMemo(() => tabVariants(tabCentre, reduce), [tabCentre, reduce])

  // The tab is anchored to the spot it occupies in the collapsed window, which
  // is the same screen spot in the expanded window (geometry.ts; both window
  // shapes are flush to the edge and centred on the long axis), so the window
  // resize mid-transition never moves it. It sits above the folding bar and
  // below the unfolding one.
  const tabAnchor =
    dock === 'bottom'
      ? 'bottom-0 left-1/2'
      : dock === 'top'
        ? 'top-0 left-1/2'
        : dock === 'left'
          ? 'left-0 top-1/2'
          : 'right-0 top-1/2'
  const tabZ = uiCollapsed ? 'z-20' : 'z-0'

  const tuckV = useMemo(() => tabTuckVariants(dock, reduce), [dock, reduce])

  const openOptions = (kind: PopoverKind, element: HTMLElement): void => {
    window.api.toolbar.openPopover({ kind, anchor: panelAnchor(element) })
  }

  const chooseTool = (id: ToolId, element: HTMLElement): void => {
    selectTool(id)
    const kind = optionsKindFor(id)
    if (kind) openOptions(kind, element)
  }

  const toolSize = vertical ? 'h-7 w-full' : 'h-8 w-8'

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative h-full w-full">
        <AnimatePresence initial={false} onExitComplete={handleExitComplete}>
          {!uiCollapsed && (
            <motion.div key="bar" className="absolute inset-0 z-10 p-2">
              <motion.div
                variants={barVariants}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                className={`flex h-full w-full items-center bg-zinc-950/90 text-zinc-300 ring-1 ring-white/10 ${
                  vertical
                    ? 'flex-col justify-center gap-1.5 rounded-[20px] px-1.5 py-2'
                    : 'flex-row gap-1 rounded-[16px] px-2.5'
                }`}
                style={{
                  transformOrigin: `${morph.originX}% ${morph.originY}%`,
                  boxShadow:
                    '0 10px 26px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06)'
                }}
              >
                <Grip vertical={vertical} />

                <motion.button
                  type="button"
                  variants={CONTROL_VARIANTS}
                  {...tapProps}
                  className={`${ICON_BUTTON} h-6 w-6`}
                  title="Collapse toolbar"
                  aria-label="Collapse toolbar"
                  aria-expanded={true}
                  onClick={requestCollapse}
                >
                  <motion.span
                    {...chevronSpin('in', reduce)}
                    className="grid h-full w-full place-items-center"
                  >
                    <ChevronIcon direction={collapseDirection} className="h-3.5 w-3.5" />
                  </motion.span>
                </motion.button>

                <motion.div
                  variants={CONTROL_VARIANTS}
                  className={`grid shrink-0 gap-1 rounded-xl bg-white/[0.06] p-1 ring-1 ring-white/10 ${
                    vertical ? 'w-full grid-cols-2' : 'grid-flow-col'
                  }`}
                >
                  {TOOLS.map(({ id, label, Icon }) => (
                    <motion.button
                      key={id}
                      type="button"
                      variants={CONTROL_VARIANTS}
                      {...tapProps}
                      title={label}
                      aria-label={label}
                      aria-pressed={tool === id}
                      onClick={(event) => chooseTool(id, event.currentTarget)}
                      className={`grid place-items-center rounded-lg transition-colors ${toolSize} ${
                        tool === id
                          ? 'bg-zinc-100 text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.5)]'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      <Icon className={vertical ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
                    </motion.button>
                  ))}

                  {/* One slot for all four shape tools: it pops out the shape
                      picker plus the shared colour and size controls. */}
                  <motion.button
                    type="button"
                    variants={CONTROL_VARIANTS}
                    {...tapProps}
                    title="Shapes"
                    aria-label="Shapes"
                    aria-haspopup="dialog"
                    onClick={(event) => openOptions('shapes', event.currentTarget)}
                    className={`grid place-items-center rounded-lg transition-colors ${toolSize} ${
                      activeShape
                        ? 'bg-white/15 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <ShapeIcon className={vertical ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
                  </motion.button>

                  {/* Backdrop is a display toggle, not a tool; one click cycles
                      none → whiteboard → blackboard → spotlight. */}
                  <motion.button
                    type="button"
                    variants={CONTROL_VARIANTS}
                    {...tapProps}
                    title={`Backdrop: ${BACKDROP_LABELS[backdrop]} — click to cycle`}
                    aria-label={`Backdrop: ${BACKDROP_LABELS[backdrop]}, click to cycle`}
                    aria-pressed={backdrop !== 'none'}
                    onClick={() => changeBackdrop(nextBackdrop(backdrop))}
                    className={`grid place-items-center rounded-lg transition-colors ${toolSize} ${
                      backdrop !== 'none'
                        ? 'bg-white/15 text-zinc-100'
                        : 'text-zinc-400 hover:text-zinc-100'
                    }`}
                  >
                    <BackdropIcon
                      mode={backdrop}
                      className={vertical ? 'h-4 w-4' : 'h-[18px] w-[18px]'}
                    />
                  </motion.button>

                  {/* Freeze-frame: pauses the screen under the ink and turns on
                      wheel zoom plus middle/right-drag panning in the overlay. */}
                  <motion.button
                    type="button"
                    variants={CONTROL_VARIANTS}
                    {...tapProps}
                    title={
                      frozen
                        ? 'Frozen frame — click to resume (Ctrl+Shift+F)'
                        : 'Freeze frame (Ctrl+Shift+F)'
                    }
                    aria-label={frozen ? 'Frozen frame, click to resume' : 'Freeze frame'}
                    aria-pressed={frozen}
                    onClick={toggleFrozen}
                    className={`grid place-items-center rounded-lg transition-colors ${
                      vertical ? 'col-span-2 h-7 w-full' : 'h-8 w-8'
                    } ${frozen ? 'bg-sky-500/25 text-sky-200' : 'text-zinc-400 hover:text-zinc-100'}`}
                  >
                    <FreezeIcon className={vertical ? 'h-4 w-4' : 'h-[18px] w-[18px]'} />
                  </motion.button>
                </motion.div>

                <Divider vertical={vertical} />

                <motion.div
                  variants={CONTROL_VARIANTS}
                  className={`shrink-0 gap-0.5 ${
                    vertical ? 'grid w-full grid-cols-2' : 'flex flex-row items-center'
                  }`}
                >
                  <motion.button
                    type="button"
                    variants={CONTROL_VARIANTS}
                    {...tapProps}
                    className={`${ICON_BUTTON} ${vertical ? 'h-7 w-full' : 'h-8 w-8'}`}
                    title="Undo (Ctrl+Z)"
                    aria-label="Undo"
                    disabled={!canUndo}
                    onClick={undo}
                  >
                    <UndoIcon className={vertical ? 'h-4 w-4' : 'h-[17px] w-[17px]'} />
                  </motion.button>
                  <motion.button
                    type="button"
                    variants={CONTROL_VARIANTS}
                    {...tapProps}
                    className={`${ICON_BUTTON} ${vertical ? 'h-7 w-full' : 'h-8 w-8'}`}
                    title="Redo (Ctrl+Y)"
                    aria-label="Redo"
                    disabled={!canRedo}
                    onClick={redo}
                  >
                    <RedoIcon className={vertical ? 'h-4 w-4' : 'h-[17px] w-[17px]'} />
                  </motion.button>
                  <motion.button
                    type="button"
                    variants={CONTROL_VARIANTS}
                    {...tapProps}
                    className={`${ICON_BUTTON} ${vertical ? 'h-7 w-full' : 'h-8 w-8'}`}
                    title="Save annotated screenshot"
                    aria-label="Save annotated screenshot"
                    onClick={saveScreenshot}
                  >
                    <ScreenshotIcon className={vertical ? 'h-4 w-4' : 'h-[17px] w-[17px]'} />
                  </motion.button>
                  <motion.button
                    type="button"
                    variants={CONTROL_VARIANTS}
                    {...tapProps}
                    className={`${ICON_BUTTON} enabled:hover:text-red-400 ${
                      vertical ? 'h-7 w-full' : 'h-8 w-8'
                    }`}
                    title="Clear all (Ctrl+Shift+C)"
                    aria-label="Clear all"
                    disabled={!canUndo}
                    onClick={clear}
                  >
                    <TrashIcon className={vertical ? 'h-4 w-4' : 'h-[17px] w-[17px]'} />
                  </motion.button>
                </motion.div>

                <motion.button
                  type="button"
                  variants={CONTROL_VARIANTS}
                  {...tapProps}
                  onClick={toggleMode}
                  title={
                    drawing
                      ? 'Drawing — click for pass-through (Ctrl+Shift+D)'
                      : 'Pass-through — click to draw (Ctrl+Shift+D)'
                  }
                  aria-label={
                    drawing ? 'Drawing, switch to pass-through' : 'Pass-through, start drawing'
                  }
                  aria-pressed={drawing}
                  className={`shrink-0 font-semibold transition-colors ${
                    vertical
                      ? 'grid h-9 w-full place-items-center rounded-xl'
                      : 'ml-auto flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px]'
                  } ${
                    drawing
                      ? 'bg-red-500 text-white shadow-[0_4px_14px_rgba(239,68,68,0.35)] hover:bg-red-600'
                      : 'bg-white/10 text-zinc-300 hover:bg-white/[0.16] hover:text-white'
                  }`}
                >
                  {drawing ? <PenIcon className="h-4 w-4" /> : <PointerIcon className="h-4 w-4" />}
                  {!vertical && <span>{drawing ? 'Drawing' : 'Pass-through'}</span>}
                </motion.button>

                <motion.div
                  variants={CONTROL_VARIANTS}
                  className={`shrink-0 gap-0.5 ${
                    vertical ? 'grid w-full grid-cols-4' : 'flex items-center'
                  }`}
                  role="group"
                  aria-label="Dock position"
                >
                  {DOCK_OPTIONS.map(({ id, label }) => {
                    const selected = dock === id
                    return (
                      <motion.button
                        key={id}
                        type="button"
                        variants={CONTROL_VARIANTS}
                        {...tapProps}
                        title={label}
                        aria-label={label}
                        aria-pressed={selected}
                        onClick={() => moveDock(id)}
                        className={`grid place-items-center rounded-md ${
                          vertical ? 'h-5 w-full' : 'h-6 w-6'
                        } ${
                          selected
                            ? 'bg-white/10 text-zinc-100'
                            : 'text-zinc-600 hover:bg-white/5 hover:text-zinc-300'
                        }`}
                      >
                        <DockIcon position={id} className="h-[14px] w-[14px]" />
                      </motion.button>
                    )
                  })}
                </motion.div>
              </motion.div>
            </motion.div>
          )}

          {uiCollapsed && (
            <motion.div
              key="pill"
              variants={tabV}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className={`absolute ${tabZ} ${tabAnchor} h-12 w-12`}
            >
              {/* The rounded-square glass tab lives mostly behind the screen
                  edge (only its 12px sliver is visible) and pops out flush on
                  hover. The whole tab is the click target, so it is not a
                  native drag region — drag regions never receive hover. */}
              <motion.button
                type="button"
                variants={tuckV}
                initial="tucked"
                animate="tucked"
                exit="tucked"
                whileHover="popped"
                onClick={requestExpand}
                title={drawing ? 'Drawing — expand toolbar' : 'Pass-through — expand toolbar'}
                aria-label="Expand toolbar"
                aria-expanded={false}
                className="grid h-12 w-12 cursor-pointer place-items-center rounded-[10px] bg-white/70 ring-1 ring-white/60 shadow-[0_6px_18px_rgba(0,0,0,0.28)] backdrop-blur-md"
              >
                <motion.span
                  {...chevronSpin('out', reduce)}
                  className="grid h-full w-full place-items-center text-zinc-900"
                >
                  <ChevronIcon direction={expandDirection} className="h-4 w-4" />
                </motion.span>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
