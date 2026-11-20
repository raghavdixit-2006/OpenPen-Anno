import { useEffect, useState, type ReactElement } from 'react'
import { MotionConfig, motion, useReducedMotion } from 'motion/react'
import type { EraserMode, PopoverContext, ShapeTool } from '../../shared/ipc'
import {
  ERASER_MODES,
  MAX_BRUSH_SIZE,
  MIN_BRUSH_SIZE,
  PALETTE,
  SHAPE_TOOLS
} from '../toolbar/catalog'

const TAP_SPRING = { type: 'spring', stiffness: 460, damping: 30 } as const

function Palette({
  value,
  onChoose
}: {
  value: string
  onChoose: (color: string) => void
}): ReactElement {
  return (
    <div
      role="group"
      aria-label="Colour"
      className="flex h-6 shrink-0 items-center justify-between"
    >
      {PALETTE.map((swatch) => {
        const selected = swatch === value
        return (
          <motion.button
            key={swatch}
            type="button"
            title={swatch}
            aria-label={`Colour ${swatch}`}
            aria-pressed={selected}
            onClick={() => onChoose(swatch)}
            whileHover={{ scale: 1.16 }}
            whileTap={{ scale: 0.9 }}
            transition={TAP_SPRING}
            style={{ backgroundColor: swatch }}
            className={`h-[22px] w-[22px] rounded-full border border-white/25 ${
              selected ? 'ring-2 ring-white ring-offset-2 ring-offset-zinc-950' : ''
            }`}
          />
        )
      })}
    </div>
  )
}

function SizeRow({
  value,
  onChange
}: {
  value: number
  onChange: (size: number) => void
}): ReactElement {
  return (
    <div className="flex h-6 shrink-0 items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Size
      </span>
      <input
        type="range"
        min={MIN_BRUSH_SIZE}
        max={MAX_BRUSH_SIZE}
        step={1}
        value={value}
        aria-label="Brush size"
        onChange={(event) => onChange(Number(event.target.value))}
        className="ink-range min-w-0 flex-1"
      />
      <span className="w-7 shrink-0 rounded-md bg-white/10 py-0.5 text-center text-[11px] font-medium tabular-nums text-zinc-200">
        {value}
      </span>
    </div>
  )
}

function EraserModes({
  value,
  onChoose
}: {
  value: EraserMode
  onChoose: (mode: EraserMode) => void
}): ReactElement {
  return (
    <div
      role="group"
      aria-label="Eraser mode"
      className="grid shrink-0 grid-cols-2 gap-1 rounded-lg bg-white/[0.06] p-1 ring-1 ring-white/10"
    >
      {ERASER_MODES.map(({ id, label, title }) => {
        const selected = value === id
        return (
          <motion.button
            key={id}
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={selected}
            onClick={() => onChoose(id)}
            whileTap={{ scale: 0.96 }}
            transition={TAP_SPRING}
            className={`h-6 rounded-md text-[11px] font-medium transition-colors ${
              selected
                ? 'bg-zinc-100 text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.5)]'
                : 'text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
            }`}
          >
            {label}
          </motion.button>
        )
      })}
    </div>
  )
}

function ShapePicker({
  value,
  onChoose
}: {
  value: string
  onChoose: (shape: ShapeTool) => void
}): ReactElement {
  return (
    <div role="group" aria-label="Shape tools" className="grid shrink-0 grid-cols-4 gap-1.5">
      {SHAPE_TOOLS.map(({ id, label, Icon }) => {
        const selected = value === id
        return (
          <motion.button
            key={id}
            type="button"
            title={label}
            aria-label={label}
            aria-pressed={selected}
            onClick={() => onChoose(id)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.94 }}
            transition={TAP_SPRING}
            className={`grid h-9 place-items-center rounded-lg transition-colors ${
              selected
                ? 'bg-zinc-100 text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.5)]'
                : 'bg-white/[0.06] text-zinc-400 hover:bg-white/10 hover:text-zinc-100'
            }`}
          >
            <Icon className="h-[18px] w-[18px]" />
          </motion.button>
        )
      })}
    </div>
  )
}

/**
 * Contents of the floating options window. The toolbar owns the rail; this
 * panel owns everything that used to bloat it. Main provides the context (kind
 * plus the current style) and broadcasts every change, so the panel always
 * mirrors authoritative state.
 */
export default function Popover(): ReactElement {
  const [context, setContext] = useState<PopoverContext | null>(null)
  const reduce = useReducedMotion() === true

  useEffect(() => {
    let live = true
    void window.api.popover.getContext().then((next) => {
      if (live) setContext(next)
    })
    return () => {
      live = false
    }
  }, [])

  useEffect(
    () =>
      window.api.toolbar.onStateChange((state) => {
        setContext((current) =>
          current
            ? {
                ...current,
                tool: state.tool,
                color: state.color,
                size: state.size,
                eraserMode: state.eraserMode
              }
            : current
        )
      }),
    []
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') window.api.popover.close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (!context) return <div className="h-full w-full" />

  const shapes = context.kind === 'shapes'
  const eraser = !shapes && context.tool === 'eraser'

  const chooseColor = (color: string): void => {
    setContext((current) => (current ? { ...current, color } : current))
    window.api.toolbar.setColor(color)
  }

  const changeSize = (size: number): void => {
    setContext((current) => (current ? { ...current, size } : current))
    window.api.toolbar.setSize(size)
  }

  const chooseEraserMode = (eraserMode: EraserMode): void => {
    setContext((current) => (current ? { ...current, eraserMode } : current))
    window.api.toolbar.setEraserMode(eraserMode)
  }

  const chooseShape = (shape: ShapeTool): void => {
    window.api.toolbar.setTool(shape)
    // Picking a shape completes the task; the panel should not linger over the
    // canvas the user is about to draw on.
    window.api.popover.close()
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        initial={reduce ? false : { opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className="h-full w-full p-1"
      >
        <div
          role="dialog"
          aria-label={shapes ? 'Shape options' : 'Tool options'}
          className="flex h-full w-full flex-col justify-center gap-2 rounded-2xl bg-zinc-950/95 px-3 text-zinc-300 ring-1 ring-white/10"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)' }}
        >
          {shapes && <ShapePicker value={context.tool} onChoose={chooseShape} />}

          {!shapes && eraser && (
            <EraserModes value={context.eraserMode} onChoose={chooseEraserMode} />
          )}

          {!eraser && <Palette value={context.color} onChoose={chooseColor} />}

          <SizeRow value={context.size} onChange={changeSize} />
        </div>
      </motion.div>
    </MotionConfig>
  )
}
