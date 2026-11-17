import type { ReactElement } from 'react'
import { useToolbarStore } from './store'
import {
  EraserIcon,
  HighlighterIcon,
  PenIcon,
  PointerIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
  type IconComponent
} from './icons'
import type { ToolId } from '../../shared/ipc'

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

function GripDots(): ReactElement {
  return (
    <div className="grid grid-cols-2 gap-[3px] px-1 opacity-30" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <span key={index} className="h-[3px] w-[3px] rounded-full bg-white" />
      ))}
    </div>
  )
}

export default function App(): ReactElement {
  const mode = useToolbarStore((state) => state.mode)
  const tool = useToolbarStore((state) => state.tool)
  const color = useToolbarStore((state) => state.color)
  const size = useToolbarStore((state) => state.size)
  const canUndo = useToolbarStore((state) => state.canUndo)
  const canRedo = useToolbarStore((state) => state.canRedo)

  const selectTool = useToolbarStore((state) => state.selectTool)
  const selectColor = useToolbarStore((state) => state.selectColor)
  const changeSize = useToolbarStore((state) => state.changeSize)
  const toggleMode = useToolbarStore((state) => state.toggleMode)
  const undo = useToolbarStore((state) => state.undo)
  const redo = useToolbarStore((state) => state.redo)
  const clear = useToolbarStore((state) => state.clear)

  const drawing = mode === 'draw'

  const historyButton =
    'no-drag grid h-8 w-8 place-items-center rounded-lg text-white/60 transition enabled:hover:bg-white/10 enabled:hover:text-white disabled:cursor-default disabled:opacity-25'

  return (
    <div className="drag-region h-full w-full p-2">
      <div className="flex h-full items-center gap-2 rounded-2xl border border-white/10 bg-[#14161b]/95 px-2.5 text-white shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
        <GripDots />

        <div className="no-drag flex items-center gap-0.5 rounded-xl bg-black/35 p-1">
          {TOOLS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              title={label}
              aria-label={label}
              aria-pressed={tool === id}
              onClick={() => selectTool(id)}
              className={`grid h-8 w-9 place-items-center rounded-lg transition ${
                tool === id
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="h-[17px] w-[17px]" />
            </button>
          ))}
        </div>

        <div className="no-drag flex items-center gap-1.5 px-1">
          {PALETTE.map((swatch) => {
            const selected = swatch === color
            return (
              <button
                key={swatch}
                type="button"
                title={swatch}
                aria-label={`Colour ${swatch}`}
                aria-pressed={selected}
                onClick={() => selectColor(swatch)}
                style={{ backgroundColor: swatch }}
                className={`h-5 w-5 rounded-full border transition ${
                  selected
                    ? 'scale-110 border-white ring-2 ring-white/60'
                    : 'border-white/20 hover:scale-110'
                }`}
              />
            )
          })}
        </div>

        <div className="no-drag flex w-[136px] items-center gap-2 px-1">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
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
            className="ink-range w-full"
          />
          <span className="w-5 text-right text-[11px] tabular-nums text-white/60">{size}</span>
        </div>

        <div className="h-7 w-px bg-white/10" aria-hidden="true" />

        <button
          type="button"
          className={historyButton}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
          disabled={!canUndo}
          onClick={undo}
        >
          <UndoIcon className="h-[17px] w-[17px]" />
        </button>
        <button
          type="button"
          className={historyButton}
          title="Redo (Ctrl+Y)"
          aria-label="Redo"
          disabled={!canRedo}
          onClick={redo}
        >
          <RedoIcon className="h-[17px] w-[17px]" />
        </button>
        <button
          type="button"
          className={`${historyButton} hover:text-red-300`}
          title="Clear all (Ctrl+Shift+C)"
          aria-label="Clear all"
          disabled={!canUndo}
          onClick={clear}
        >
          <TrashIcon className="h-[17px] w-[17px]" />
        </button>

        <button
          type="button"
          onClick={toggleMode}
          title="Toggle drawing / passthrough (Ctrl+Shift+D)"
          aria-pressed={drawing}
          className={`ml-auto flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition ${
            drawing
              ? 'bg-red-500 text-white shadow-[0_0_18px_rgba(239,68,68,0.45)] hover:bg-red-400'
              : 'bg-white/10 text-white/70 hover:bg-white/15 hover:text-white'
          }`}
        >
          {drawing ? <PenIcon className="h-4 w-4" /> : <PointerIcon className="h-4 w-4" />}
          <span>{drawing ? 'Drawing' : 'Pass-through'}</span>
        </button>
      </div>
    </div>
  )
}
