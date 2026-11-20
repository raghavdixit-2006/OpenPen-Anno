import type { ReactElement } from 'react'
import type { EraserMode } from '../../shared/ipc'
import { ERASER_MODES, MAX_BRUSH_SIZE, MIN_BRUSH_SIZE } from './catalog'

interface InlineOptionsProps {
  vertical: boolean
  size: number
  eraserMode: EraserMode
  onChangeSize: (size: number) => void
  onChangeEraserMode: (mode: EraserMode) => void
}

const SIZE_SPAN = MAX_BRUSH_SIZE - MIN_BRUSH_SIZE

function clampSize(value: number): number {
  return Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, Math.round(value)))
}

/**
 * Quick eraser-mode and brush-size controls that live inside the rail, so the
 * two most-used settings do not need the floating options window. Horizontal
 * docks use a segmented control plus slider; the 56px side rail stacks the
 * segments above a compact stepper. The full options panel stays available
 * from the Tool Menu for colour and shape styles.
 */
export default function InlineOptions({
  vertical,
  size,
  eraserMode,
  onChangeSize,
  onChangeEraserMode
}: InlineOptionsProps): ReactElement {
  const value = clampSize(size)
  const percent = ((value - MIN_BRUSH_SIZE) / SIZE_SPAN) * 100

  const modes = (
    <div
      role="group"
      aria-label="Eraser mode"
      className={`flex shrink-0 gap-0.5 rounded-[7px] bg-white/[0.05] p-0.5 ${
        vertical ? 'w-8 flex-col' : 'flex-row'
      }`}
    >
      {ERASER_MODES.map(({ id, label, title }) => {
        const selected = eraserMode === id
        return (
          <button
            key={id}
            type="button"
            title={title}
            aria-label={title}
            aria-pressed={selected}
            onClick={() => onChangeEraserMode(id)}
            className={`rounded-[5px] font-semibold transition-colors ${
              vertical ? 'h-[18px] w-7 text-[8px]' : 'h-5 px-1.5 text-[9px]'
            } ${
              selected
                ? 'bg-zinc-100 text-zinc-900 shadow-[0_1px_3px_rgba(0,0,0,0.35)]'
                : 'text-zinc-400 hover:text-zinc-100'
            }`}
          >
            {label}
          </button>
        )
      })}
    </div>
  )

  const shell = `flex shrink-0 items-center rounded-[10px] bg-white/[0.06] ring-1 ring-white/10 ${
    vertical ? 'w-10 flex-col gap-1.5 p-1' : 'h-8 gap-1.5 px-1.5'
  }`

  if (vertical) {
    return (
      <div className={shell}>
        {modes}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            title="Increase brush size"
            aria-label="Increase brush size"
            disabled={value >= MAX_BRUSH_SIZE}
            onClick={() => onChangeSize(value + 1)}
            className="h-[18px] w-8 rounded-[5px] bg-white/[0.06] text-xs font-semibold text-zinc-300 transition-colors enabled:hover:bg-white/[0.12] enabled:hover:text-white disabled:cursor-default disabled:opacity-30"
          >
            +
          </button>
          <span className="h-[18px] w-8 rounded-[5px] bg-white/10 text-center text-[10px] font-semibold leading-[18px] tabular-nums text-zinc-200">
            {value}
          </span>
          <button
            type="button"
            title="Decrease brush size"
            aria-label="Decrease brush size"
            disabled={value <= MIN_BRUSH_SIZE}
            onClick={() => onChangeSize(value - 1)}
            className="h-[18px] w-8 rounded-[5px] bg-white/[0.06] text-xs font-semibold text-zinc-300 transition-colors enabled:hover:bg-white/[0.12] enabled:hover:text-white disabled:cursor-default disabled:opacity-30"
          >
            −
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={shell}>
      {modes}
      <span className="h-[18px] w-px shrink-0 bg-white/10" aria-hidden="true" />
      <div className="flex items-center gap-[5px]">
        <span className="text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-500">Size</span>
        <input
          type="range"
          min={MIN_BRUSH_SIZE}
          max={MAX_BRUSH_SIZE}
          step={1}
          value={value}
          aria-label="Brush size"
          onChange={(event) => onChangeSize(Number(event.target.value))}
          className="ink-range h-1 w-[58px] shrink-0"
          style={{
            background: `linear-gradient(to right, #d4d4d8 0 ${percent}%, rgba(255,255,255,0.16) ${percent}% 100%)`
          }}
        />
        <span className="h-[18px] min-w-5 shrink-0 rounded-[5px] bg-white/10 px-1 text-center text-[10px] font-semibold leading-[18px] tabular-nums text-zinc-200">
          {value}
        </span>
      </div>
    </div>
  )
}
