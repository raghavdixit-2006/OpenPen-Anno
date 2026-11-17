import type { ReactElement } from 'react'
import { useToolbarStore } from './store'
import {
  DockIcon,
  EraserIcon,
  HighlighterIcon,
  PenIcon,
  PointerIcon,
  RedoIcon,
  TrashIcon,
  UndoIcon,
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
  'grid shrink-0 place-items-center rounded-lg text-zinc-500 transition enabled:hover:bg-zinc-100 enabled:hover:text-zinc-900 disabled:cursor-default disabled:opacity-30'

function Grip({ vertical }: { vertical: boolean }): ReactElement {
  return (
    <div className="flex shrink-0 items-center justify-center" aria-hidden="true">
      <span className={`rounded-full bg-zinc-200 ${vertical ? 'h-6 w-1' : 'h-1 w-6'}`} />
    </div>
  )
}

function Divider({ vertical }: { vertical: boolean }): ReactElement {
  return (
    <div
      className={`shrink-0 bg-zinc-200 ${vertical ? 'h-px w-6' : 'h-6 w-px'}`}
      aria-hidden="true"
    />
  )
}

function SizeControl({ vertical }: { vertical: boolean }): ReactElement {
  const size = useToolbarStore((state) => state.size)
  const changeSize = useToolbarStore((state) => state.changeSize)

  if (vertical) {
    return (
      <div className="no-drag flex shrink-0 flex-col items-center gap-1">
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
        <span className="text-[11px] font-medium tabular-nums text-zinc-500">{size}</span>
      </div>
    )
  }

  return (
    <div className="no-drag flex shrink-0 items-center gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
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
      <span className="w-4 text-right text-[11px] font-medium tabular-nums text-zinc-500">
        {size}
      </span>
    </div>
  )
}

export default function App(): ReactElement {
  const mode = useToolbarStore((state) => state.mode)
  const tool = useToolbarStore((state) => state.tool)
  const color = useToolbarStore((state) => state.color)
  const dock = useToolbarStore((state) => state.dock)
  const canUndo = useToolbarStore((state) => state.canUndo)
  const canRedo = useToolbarStore((state) => state.canRedo)

  const selectTool = useToolbarStore((state) => state.selectTool)
  const selectColor = useToolbarStore((state) => state.selectColor)
  const moveDock = useToolbarStore((state) => state.moveDock)
  const toggleMode = useToolbarStore((state) => state.toggleMode)
  const undo = useToolbarStore((state) => state.undo)
  const redo = useToolbarStore((state) => state.redo)
  const clear = useToolbarStore((state) => state.clear)

  // Side docks stack everything into a single narrow column; top and bottom
  // docks keep the original single-row strip.
  const vertical = dock === 'left' || dock === 'right'
  const drawing = mode === 'draw'

  return (
    <div className="drag-region h-full w-full p-2">
      <div
        className={`flex h-full w-full items-center bg-white/95 text-zinc-700 ring-1 ring-black/5 ${
          vertical
            ? 'flex-col justify-center gap-1.5 rounded-[22px] px-2 py-3'
            : 'flex-row gap-2 rounded-[20px] px-3'
        }`}
        style={{ boxShadow: '0 12px 30px rgba(15, 23, 42, 0.2), 0 2px 6px rgba(15, 23, 42, 0.08)' }}
      >
        <Grip vertical={vertical} />

        <div
          className={`no-drag flex shrink-0 gap-1 rounded-xl bg-zinc-100 p-1 ${
            vertical ? 'flex-col' : 'flex-row'
          }`}
        >
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
                  ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(15,23,42,0.16)]'
                  : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </button>
          ))}
        </div>

        <div
          className={`no-drag shrink-0 ${
            vertical ? 'grid grid-cols-2 gap-2 py-1' : 'flex items-center gap-1.5'
          }`}
        >
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
                className={`h-[18px] w-[18px] rounded-full border border-black/10 transition ${
                  selected
                    ? 'ring-2 ring-zinc-900 ring-offset-2 ring-offset-white'
                    : 'hover:scale-110'
                }`}
              />
            )
          })}
        </div>

        <SizeControl vertical={vertical} />

        <Divider vertical={vertical} />

        <div
          className={`no-drag flex shrink-0 items-center gap-0.5 ${
            vertical ? 'flex-col' : 'flex-row'
          }`}
        >
          <button
            type="button"
            className={`${ICON_BUTTON} h-8 w-8`}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={undo}
          >
            <UndoIcon className="h-[17px] w-[17px]" />
          </button>
          <button
            type="button"
            className={`${ICON_BUTTON} h-8 w-8`}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={redo}
          >
            <RedoIcon className="h-[17px] w-[17px]" />
          </button>
          <button
            type="button"
            className={`${ICON_BUTTON} h-8 w-8 enabled:hover:text-red-500`}
            title="Clear all (Ctrl+Shift+C)"
            aria-label="Clear all"
            disabled={!canUndo}
            onClick={clear}
          >
            <TrashIcon className="h-[17px] w-[17px]" />
          </button>
        </div>

        <button
          type="button"
          onClick={toggleMode}
          title={
            drawing
              ? 'Drawing — click for pass-through (Ctrl+Shift+D)'
              : 'Pass-through — click to draw (Ctrl+Shift+D)'
          }
          aria-label={drawing ? 'Drawing, switch to pass-through' : 'Pass-through, start drawing'}
          aria-pressed={drawing}
          className={`no-drag shrink-0 font-semibold transition ${
            vertical
              ? 'grid h-10 w-10 place-items-center rounded-xl'
              : 'ml-auto flex h-9 items-center gap-2 rounded-xl px-3 text-xs'
          } ${
            drawing
              ? 'bg-red-500 text-white shadow-[0_6px_16px_rgba(239,68,68,0.35)] hover:bg-red-600'
              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700'
          }`}
        >
          {drawing ? (
            <PenIcon className="h-[17px] w-[17px]" />
          ) : (
            <PointerIcon className="h-[17px] w-[17px]" />
          )}
          {!vertical && <span>{drawing ? 'Drawing' : 'Pass-through'}</span>}
        </button>

        <div
          className={`no-drag flex shrink-0 gap-0.5 ${
            vertical ? 'w-full flex-wrap justify-center' : 'items-center'
          }`}
          role="group"
          aria-label="Dock position"
        >
          {DOCK_OPTIONS.map(({ id, label }) => {
            const selected = dock === id
            return (
              <button
                key={id}
                type="button"
                title={label}
                aria-label={label}
                aria-pressed={selected}
                onClick={() => moveDock(id)}
                className={`grid h-6 w-6 place-items-center rounded-md transition ${
                  selected
                    ? 'bg-zinc-100 text-zinc-900'
                    : 'text-zinc-300 hover:bg-zinc-50 hover:text-zinc-500'
                }`}
              >
                <DockIcon position={id} className="h-[15px] w-[15px]" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
