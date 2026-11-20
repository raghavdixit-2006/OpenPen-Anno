import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { DockPosition, ToolId } from '../../shared/ipc'
import { TOOL_MENU } from './catalog'
import { CONTROL_VARIANTS, tapProps, toolMenuVariants } from './animation'

interface ToolMenuProps {
  tool: ToolId
  dock: DockPosition
  reduce: boolean
  onSelect: (tool: ToolId, trigger: HTMLElement) => void
}

const CLOSE_DELAY = 150

/**
 * The Active Tool trigger and its hover-expandable Tool Menu.
 *
 * The trigger and menu share one hover container: moving from the trigger
 * across the 12px gap onto the menu's invisible bridge keeps the menu open.
 * Leaving the whole subtree starts a 150ms close timer so a quick diagonal
 * movement does not make the menu flicker. Selecting a tool or pressing Escape
 * closes it immediately.
 */
export default function ToolMenu({ tool, dock, reduce, onSelect }: ToolMenuProps): ReactElement {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const closeTimer = useRef<number | null>(null)
  const menuVariants = useMemo(() => toolMenuVariants(dock, reduce), [dock, reduce])
  const active = TOOL_MENU.find((item) => item.id === tool) ?? TOOL_MENU[0]
  const ActiveIcon = active.Icon

  const clearClose = (): void => {
    if (closeTimer.current === null) return
    window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }

  const openNow = (): void => {
    clearClose()
    setOpen(true)
  }

  const scheduleClose = (): void => {
    clearClose()
    closeTimer.current = window.setTimeout(() => {
      closeTimer.current = null
      setOpen(false)
    }, CLOSE_DELAY)
  }

  useEffect(
    () => () => {
      if (closeTimer.current === null) return
      window.clearTimeout(closeTimer.current)
    },
    []
  )

  // A dock change moves the rail under the menu; close instead of letting the
  // old anchor follow the window to the new edge.
  useEffect(() => {
    setOpen(false)
  }, [dock])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const choose = (id: ToolId): void => {
    setOpen(false)
    clearClose()
    if (triggerRef.current) onSelect(id, triggerRef.current)
  }

  const placement =
    dock === 'bottom'
      ? { bottom: 'calc(100% + 12px)', left: 0 }
      : dock === 'top'
        ? { top: 'calc(100% + 12px)', left: 0 }
        : dock === 'left'
          ? { left: 'calc(100% + 12px)', top: 0 }
          : { right: 'calc(100% + 12px)', top: 0 }

  const origin =
    dock === 'bottom'
      ? 'bottom left'
      : dock === 'top'
        ? 'top left'
        : dock === 'left'
          ? 'top left'
          : 'top right'

  // The menu is mounted only while open; this invisible strip covers the 12px
  // gap so the pointer never leaves the hover subtree on its way to the card.
  const bridge =
    dock === 'bottom'
      ? "before:absolute before:inset-x-0 before:bottom-full before:h-3 before:content-['']"
      : dock === 'top'
        ? "before:absolute before:inset-x-0 before:top-full before:h-3 before:content-['']"
        : dock === 'left'
          ? "before:absolute before:inset-y-0 before:right-full before:w-3 before:content-['']"
          : "before:absolute before:inset-y-0 before:left-full before:w-3 before:content-['']"

  return (
    <motion.div
      variants={CONTROL_VARIANTS}
      className="relative z-20 h-10 w-10 shrink-0"
      onPointerEnter={openNow}
      onPointerLeave={scheduleClose}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <motion.button
        ref={triggerRef}
        type="button"
        {...tapProps}
        title={`${active.label} — open tool menu`}
        aria-label={`Active tool: ${active.label}, open tool menu`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          clearClose()
          setOpen((current) => !current)
        }}
        className={`relative grid h-10 w-10 place-items-center rounded-2xl ring-1 transition-colors ${
          open
            ? 'bg-[#2e2a3d] text-white ring-white/30'
            : 'bg-[#262333] text-white ring-white/20 hover:bg-[#2e2a3d]'
        }`}
        style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.35)' }}
      >
        <ActiveIcon className="h-5 w-5" />
        <span
          aria-hidden="true"
          className="absolute bottom-1.5 right-1.5 h-1 w-1 rounded-full bg-white/45"
        />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Tool menu"
            data-toolbar-ui="menu"
            variants={menuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`pointer-events-auto absolute z-50 grid w-[236px] grid-cols-2 gap-1.5 rounded-2xl bg-zinc-950/95 p-2 text-zinc-300 shadow-2xl ring-1 ring-white/15 backdrop-blur-md ${bridge}`}
            style={{ ...placement, transformOrigin: origin }}
          >
            {TOOL_MENU.map(({ id, label, menuLabel, Icon }) => {
              const selected = id === tool
              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  aria-label={label}
                  aria-pressed={selected}
                  onClick={() => choose(id)}
                  className={`flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 text-left text-xs font-medium transition-colors ${
                    selected
                      ? 'bg-white/15 text-white ring-1 ring-white/20'
                      : 'text-zinc-400 hover:bg-white/[0.07] hover:text-zinc-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{menuLabel}</span>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
