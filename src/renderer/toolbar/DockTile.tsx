import { useMemo, useState, type CSSProperties, type ReactElement } from 'react'
import { AnimatePresence, motion, useTransform, type MotionValue } from 'motion/react'
import type { DockPosition } from '../../shared/ipc'
import {
  CONTROL_VARIANTS,
  labelPillOffset,
  labelPillVariants,
  magnificationPop,
  magnificationScale,
  tileTapProps
} from './animation'
import { TOOL_TILE, tileCentre } from './geometry'
import type { IconComponent } from './icons'

interface DockTileProps {
  index: number
  label: string
  Icon: IconComponent
  iconClassName: string
  active: boolean
  pressed?: boolean
  hasPopup?: boolean
  vertical: boolean
  dock: DockPosition
  pointerX: MotionValue<number>
  pointerY: MotionValue<number>
  reduce: boolean
  onSelect: (element: HTMLElement) => void
}

/**
 * One dock-style tool tile. Pointer position arrives as Motion values from the
 * tools group, so scale and pop-out never touch React state; only the label's
 * enter/leave toggle does.
 */
export default function DockTile({
  index,
  label,
  Icon,
  iconClassName,
  active,
  pressed,
  hasPopup,
  vertical,
  dock,
  pointerX,
  pointerY,
  reduce,
  onSelect
}: DockTileProps): ReactElement {
  const [hovered, setHovered] = useState(false)
  const centre = useMemo(() => tileCentre(index, vertical), [index, vertical])

  // Horizontal docks are one row and side docks are one column, so the bell
  // only needs the pointer's distance along that single axis.
  const distance = useTransform([pointerX, pointerY], ([x, y]: number[]) =>
    Math.abs((vertical ? y : x) - (vertical ? centre.y : centre.x))
  )
  const scale = useTransform(distance, (value) =>
    reduce ? 1 : magnificationScale(value, TOOL_TILE.step)
  )
  const lift = useTransform(distance, (value) =>
    reduce ? 0 : magnificationPop(value, TOOL_TILE.step)
  )
  const x = useTransform(lift, (value) => (dock === 'left' ? value : dock === 'right' ? -value : 0))
  const y = useTransform(lift, (value) => (dock === 'bottom' ? -value : dock === 'top' ? value : 0))

  const pillVariants = useMemo(() => labelPillVariants(dock, reduce), [dock, reduce])
  // Half the hovered growth, plus the pop-out, plus an 8px gap. Reduced motion
  // leaves the tile at its rest size, so only the gap remains.
  const pillOffset = labelPillOffset(TOOL_TILE.size, reduce)
  const pillPosition: CSSProperties =
    dock === 'bottom'
      ? { bottom: `calc(100% + ${pillOffset}px)`, left: '50%', transform: 'translateX(-50%)' }
      : dock === 'top'
        ? { top: `calc(100% + ${pillOffset}px)`, left: '50%', transform: 'translateX(-50%)' }
        : dock === 'left'
          ? { left: `calc(100% + ${pillOffset}px)`, top: '50%', transform: 'translateY(-50%)' }
          : { right: `calc(100% + ${pillOffset}px)`, top: '50%', transform: 'translateY(-50%)' }

  const tone = active
    ? 'bg-[#262333] text-white ring-white/20'
    : 'bg-[#1c1a24] text-zinc-400 ring-white/10 hover:bg-[#262333] hover:text-white hover:ring-white/20'

  return (
    <motion.div
      variants={CONTROL_VARIANTS}
      className="relative h-8 w-8 overflow-visible"
      style={{ zIndex: hovered ? 30 : undefined }}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <motion.div className="h-full w-full" style={{ scale, x, y }}>
        <motion.button
          type="button"
          {...tileTapProps}
          aria-label={label}
          aria-pressed={pressed}
          aria-haspopup={hasPopup ? 'dialog' : undefined}
          onClick={(event) => onSelect(event.currentTarget)}
          className={`grid h-full w-full place-items-center rounded-2xl ring-1 transition-colors ${tone}`}
        >
          <Icon className={iconClassName} />
        </motion.button>
      </motion.div>

      <AnimatePresence>
        {hovered && (
          <span className="pointer-events-none absolute z-20 overflow-visible" style={pillPosition}>
            <motion.span
              variants={pillVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              aria-hidden="true"
              className="pointer-events-none relative block whitespace-nowrap rounded-full border border-white/10 bg-zinc-950/95 px-2.5 py-1 text-xs font-semibold text-white shadow-lg"
            >
              {label}
              {/* Tiny dock-aware pointer on horizontal pills: bottom docks
                  point down at the icon, top docks point up. */}
              {!vertical && (
                <span
                  aria-hidden="true"
                  className={`absolute left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-white/10 bg-zinc-950/95 ${
                    dock === 'bottom'
                      ? '-bottom-[5px] border-b border-r'
                      : '-top-[5px] border-l border-t'
                  }`}
                />
              )}
            </motion.span>
          </span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
