import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import {
  AnimatePresence,
  MotionConfig,
  animate,
  motion,
  useMotionValue,
  useReducedMotion
} from 'motion/react'
import { useToolbarStore } from './store'
import { dockMorph } from './geometry'
import {
  CONTROL_VARIANTS,
  TAP_SPRING,
  chevronNudge,
  chevronSpin,
  surfaceVariants,
  tabVariants,
  tapProps
} from './animation'
import {
  ChevronIcon,
  DockIcon,
  EraserIcon,
  HighlighterIcon,
  PenIcon,
  PointerIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
  type ChevronDirection,
  type IconComponent
} from './icons'
import type { DockPosition, ToolId } from '../../shared/ipc'

const PALETTE = [
  '#ff2d2d',
  '#ff8a00',
  '#ffd60a',
  '#34c759',
  '#00c7be',
  '#0a84ff',
  '#bf5af2',
  '#ffffff'
] as const

const TOOLS: Array<{ id: ToolId; label: string; Icon: IconComponent }> = [
  { id: 'pen', label: 'Pen', Icon: PenIcon },
  { id: 'highlighter', label: 'Highlighter', Icon: HighlighterIcon },
  { id: 'eraser', label: 'Eraser', Icon: EraserIcon }
]

const DOCK_OPTIONS: Array<{ id: DockPosition; label: string }> = [
  { id: 'bottom', label: 'Dock at the bottom' },
  { id: 'top', label: 'Dock at the top' },
  { id: 'left', label: 'Dock on the left' },
  { id: 'right', label: 'Dock on the right' }
]

const ICON_BUTTON =
  'grid shrink-0 place-items-center rounded-lg text-zinc-400 transition-colors enabled:hover:bg-white/10 enabled:hover:text-zinc-100 disabled:cursor-default disabled:opacity-30'

function Grip({ vertical }: { vertical: boolean }): ReactElement {
  return (
    <motion.div
      variants={CONTROL_VARIANTS}
      className={`app-drag flex shrink-0 items-center justify-center ${
        vertical ? 'h-8 w-11' : 'h-11 w-8'
      }`}
      aria-hidden="true"
    >
      <span className={`rounded-full bg-white/25 ${vertical ? 'h-6 w-1' : 'h-1 w-6'}`} />
    </motion.div>
  )
}

function Divider({ vertical }: { vertical: boolean }): ReactElement {
  return (
    <motion.div
      variants={CONTROL_VARIANTS}
      className={`shrink-0 bg-white/15 ${vertical ? 'h-px w-6' : 'h-6 w-px'}`}
      aria-hidden="true"
    />
  )
}

function SizeControl({ vertical }: { vertical: boolean }): ReactElement {
  const size = useToolbarStore((state) => state.size)
  const changeSize = useToolbarStore((state) => state.changeSize)

  if (vertical) {
    return (
      <motion.div variants={CONTROL_VARIANTS} className="flex shrink-0 flex-col items-center gap-1">
        <div className="relative h-24 w-4 shrink-0">
          <input
            type="range"
            min={1}
            max={32}
            step={1}
            value={size}
            aria-label="Brush size"
            onChange={(event) => changeSize(Number(event.target.value))}
            className="ink-range ink-range-vertical"
          />
        </div>
        <span className="text-[11px] font-medium tabular-nums text-zinc-400">{size}</span>
      </motion.div>
    )
  }

  return (
    <motion.div variants={CONTROL_VARIANTS} className="flex shrink-0 items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Size
      </span>
      <input
        type="range"
        min={1}
        max={32}
        step={1}
        value={size}
        aria-label="Brush size"
        onChange={(event) => changeSize(Number(event.target.value))}
        className="ink-range w-[80px]"
      />
      <span className="w-4 text-right text-[11px] font-medium tabular-nums text-zinc-400">
        {size}
      </span>
    </motion.div>
  )
}

export default function App(): ReactElement {
  const mode = useToolbarStore((state) => state.mode)
  const tool = useToolbarStore((state) => state.tool)
  const color = useToolbarStore((state) => state.color)
  const dock = useToolbarStore((state) => state.dock)
  const collapsed = useToolbarStore((state) => state.collapsed)
  const canUndo = useToolbarStore((state) => state.canUndo)
  const canRedo = useToolbarStore((state) => state.canRedo)

  const selectTool = useToolbarStore((state) => state.selectTool)
  const selectColor = useToolbarStore((state) => state.selectColor)
  const moveDock = useToolbarStore((state) => state.moveDock)
  const toggleCollapsed = useToolbarStore((state) => state.toggleCollapsed)
  const toggleMode = useToolbarStore((state) => state.toggleMode)
  const undo = useToolbarStore((state) => state.undo)
  const redo = useToolbarStore((state) => state.redo)
  const clear = useToolbarStore((state) => state.clear)

  const reduce = useReducedMotion() === true

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

  /**
   * Hover preview on the collapsed handle, driven from its chevron island:
   * the glassy circle lifts on a motion value (zero re-renders, zero bounds
   * churn). The island is the only part that gets pointer events — the drag
   * region around it swallows them — so it also forwards focus for keyboard
   * users.
   */
  const handleScale = useMotionValue(1)
  const previewHandle = (enter: boolean): void => {
    if (reduce) return
    animate(handleScale, enter ? 1.07 : 1, { type: 'spring', stiffness: 380, damping: 22 })
  }
  // If the handle unmounts while hovered (expand click), the value would stay
  // lifted for the next collapse — reset it whenever the circle mounts.
  useEffect(() => {
    if (uiCollapsed) handleScale.set(1)
  }, [uiCollapsed, handleScale])

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
                className={`flex h-full w-full items-center bg-zinc-950/85 text-zinc-300 ring-1 ring-white/10 ${
                  vertical
                    ? 'flex-col justify-center gap-1.5 rounded-[22px] px-2 py-3'
                    : 'flex-row gap-2 rounded-[20px] px-3'
                }`}
                style={{
                  transformOrigin: `${morph.originX}% ${morph.originY}%`,
                  boxShadow:
                    '0 12px 30px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.07)'
                }}
              >
                <Grip vertical={vertical} />

                <motion.button
                  type="button"
                  variants={CONTROL_VARIANTS}
                  {...tapProps}
                  className={`${ICON_BUTTON} h-6 w-6 shrink-0`}
                  title="Collapse toolbar"
                  aria-label="Collapse toolbar"
                  aria-expanded={true}
                  onClick={requestCollapse}
                >
                  <motion.span
                    {...chevronSpin('in', reduce)}
                    className="grid h-full w-full place-items-center"
                  >
                    <ChevronIcon direction={collapseDirection} className="h-4 w-4" />
                  </motion.span>
                </motion.button>

                <motion.div
                  variants={CONTROL_VARIANTS}
                  className={`flex shrink-0 gap-1 rounded-xl bg-white/[0.07] p-1 ring-1 ring-white/10 ${
                    vertical ? 'flex-col' : 'flex-row'
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
                      onClick={() => selectTool(id)}
                      className={`grid h-8 w-9 place-items-center rounded-lg transition-colors ${
                        tool === id
                          ? 'bg-zinc-100 text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.5)]'
                          : 'text-zinc-400 hover:text-zinc-100'
                      }`}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </motion.button>
                  ))}
                </motion.div>

                <motion.div
                  variants={CONTROL_VARIANTS}
                  className={`shrink-0 ${
                    vertical ? 'grid grid-cols-2 gap-2 py-1' : 'flex items-center gap-1.5'
                  }`}
                >
                  {PALETTE.map((swatch) => {
                    const selected = swatch === color
                    return (
                      <motion.button
                        key={swatch}
                        type="button"
                        variants={CONTROL_VARIANTS}
                        whileHover={{ scale: 1.18 }}
                        whileTap={{ scale: 0.85 }}
                        transition={TAP_SPRING}
                        title={swatch}
                        aria-label={`Colour ${swatch}`}
                        aria-pressed={selected}
                        onClick={() => selectColor(swatch)}
                        style={{ backgroundColor: swatch }}
                        className={`h-[18px] w-[18px] rounded-full border border-white/25 ${
                          selected ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950' : ''
                        }`}
                      />
                    )
                  })}
                </motion.div>

                <SizeControl vertical={vertical} />

                <Divider vertical={vertical} />

                <motion.div
                  variants={CONTROL_VARIANTS}
                  className={`flex shrink-0 items-center gap-0.5 ${vertical ? 'flex-col' : 'flex-row'}`}
                >
                  <motion.button
                    type="button"
                    variants={CONTROL_VARIANTS}
                    {...tapProps}
                    className={`${ICON_BUTTON} h-8 w-8`}
                    title="Undo (Ctrl+Z)"
                    aria-label="Undo"
                    disabled={!canUndo}
                    onClick={undo}
                  >
                    <UndoIcon className="h-[17px] w-[17px]" />
                  </motion.button>
                  <motion.button
                    type="button"
                    variants={CONTROL_VARIANTS}
                    {...tapProps}
                    className={`${ICON_BUTTON} h-8 w-8`}
                    title="Redo (Ctrl+Y)"
                    aria-label="Redo"
                    disabled={!canRedo}
                    onClick={redo}
                  >
                    <RedoIcon className="h-[17px] w-[17px]" />
                  </motion.button>
                  <motion.button
                    type="button"
                    variants={CONTROL_VARIANTS}
                    {...tapProps}
                    className={`${ICON_BUTTON} h-8 w-8 enabled:hover:text-red-400`}
                    title="Clear all (Ctrl+Shift+C)"
                    aria-label="Clear all"
                    disabled={!canUndo}
                    onClick={clear}
                  >
                    <TrashIcon className="h-[17px] w-[17px]" />
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
                      ? 'grid h-10 w-10 place-items-center rounded-xl'
                      : 'ml-auto flex h-9 items-center gap-2 rounded-xl px-3 text-xs'
                  } ${
                    drawing
                      ? 'bg-red-500 text-white shadow-[0_6px_16px_rgba(239,68,68,0.35)] hover:bg-red-600'
                      : 'bg-white/10 text-zinc-300 hover:bg-white/[0.16] hover:text-white'
                  }`}
                >
                  {drawing ? (
                    <PenIcon className="h-[17px] w-[17px]" />
                  ) : (
                    <PointerIcon className="h-[17px] w-[17px]" />
                  )}
                  {!vertical && <span>{drawing ? 'Drawing' : 'Pass-through'}</span>}
                </motion.button>

                <motion.div
                  variants={CONTROL_VARIANTS}
                  className={`flex shrink-0 gap-0.5 ${
                    vertical ? 'w-full flex-wrap justify-center' : 'items-center'
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
                        className={`grid h-6 w-6 place-items-center rounded-md ${
                          selected
                            ? 'bg-white/10 text-zinc-100'
                            : 'text-zinc-600 hover:bg-white/5 hover:text-zinc-300'
                        }`}
                      >
                        <DockIcon position={id} className="h-[15px] w-[15px]" />
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
              whileHover="peek"
              className={`absolute ${tabZ} ${tabAnchor} h-16 w-16`}
            >
              {/* The glassy circle is the native drag handle (~10px annulus
                  around the island); the chevron island at its centre opts out
                  of the drag region so it can take pointer events and expand
                  on click. Hovering lifts the circle via a motion value. */}
              <motion.div
                style={{ scale: handleScale }}
                className="app-drag absolute inset-1 grid h-14 w-14 place-items-center rounded-full bg-white/70 ring-1 ring-white/60 shadow-[0_6px_18px_rgba(0,0,0,0.28)] backdrop-blur-md"
              >
                <motion.button
                  type="button"
                  variants={chevronNudge(expandDirection)}
                  whileHover="peek"
                  onPointerEnter={() => previewHandle(true)}
                  onPointerLeave={() => previewHandle(false)}
                  onFocus={() => previewHandle(true)}
                  onBlur={() => previewHandle(false)}
                  onClick={requestExpand}
                  title={drawing ? 'Drawing — expand toolbar' : 'Pass-through — expand toolbar'}
                  aria-label="Expand toolbar"
                  aria-expanded={false}
                  className="app-no-drag grid h-9 w-9 cursor-pointer place-items-center rounded-full hover:bg-zinc-900/5 active:bg-zinc-900/10"
                >
                  <motion.span
                    {...chevronSpin('out', reduce)}
                    className="grid h-full w-full place-items-center text-zinc-900"
                  >
                    <ChevronIcon direction={expandDirection} className="h-4 w-4" />
                  </motion.span>
                </motion.button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
