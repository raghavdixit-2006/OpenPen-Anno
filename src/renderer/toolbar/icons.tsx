import type { ReactElement } from 'react'
import type { BackdropMode } from '../../shared/ipc'

export interface IconProps {
  className?: string
}

export type IconComponent = (props: IconProps) => ReactElement

function Svg({ className, children }: IconProps & { children: ReactElement }): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function PenIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <path d="M21.2 6.8a1 1 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8l-1.3 4.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5z" />
        <path d="m15 5 4 4" />
      </>
    </Svg>
  )
}

export function HighlighterIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <path d="m9 11-6 6v3h9l3-3" />
        <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />
      </>
    </Svg>
  )
}

export function EraserIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <path d="m7 21-4.3-4.3a2 2 0 0 1 0-2.8l9.6-9.6a2 2 0 0 1 2.8 0l5.6 5.6a2 2 0 0 1 0 2.8L13 21" />
        <path d="M22 21H7" />
        <path d="m5 11 9 9" />
      </>
    </Svg>
  )
}

export function LineIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M4 20 20 4" />
    </Svg>
  )
}

export function ArrowIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <path d="M4 20 20 4" />
        <path d="M12 4h8v8" />
      </>
    </Svg>
  )
}

export function RectIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
    </Svg>
  )
}

export function EllipseIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="12" rx="9" ry="7" />
    </Svg>
  )
}

/** Generic glyph for the shape picker when no shape tool is active. */
export function ShapesIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <rect x="3.5" y="3.5" width="10" height="10" rx="2" />
        <circle cx="16" cy="16" r="4.5" />
      </>
    </Svg>
  )
}

export function TextIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <path d="M5 5h14" />
        <path d="M12 5v14" />
        <path d="M8.5 19h7" />
      </>
    </Svg>
  )
}

export function LaserIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <path d="M4 20 14.5 9.5" />
        <circle cx="17" cy="7" r="3" />
        <path d="M7 4v2M4 7h2M18.5 17v2M17 18.5h2" />
      </>
    </Svg>
  )
}

export function StampIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 8.5v7" />
        <path d="M10.3 10.2 12 8.5" />
      </>
    </Svg>
  )
}

/** Snowflake: the paused-screen state of the freeze-frame view. */
export function FreezeIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <path d="M12 2.5v19" />
        <path d="M3.8 7.3l16.4 9.4" />
        <path d="M3.8 16.7l16.4-9.4" />
        <path d="M9.2 4.6 12 2.5l2.8 2.1" />
        <path d="M9.2 19.4 12 21.5l2.8-2.1" />
        <path d="M5.1 9.3 4.1 5.9l3.4 1" />
        <path d="M18.9 14.7l1 3.4-3.4-1" />
      </>
    </Svg>
  )
}

export function ScreenshotIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <path d="M4.5 7.5h2.6l1.5-2.2h6.8l1.5 2.2h2.6a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V9a1.5 1.5 0 0 1 1.5-1.5z" />
        <circle cx="12" cy="13" r="3.2" />
      </>
    </Svg>
  )
}

/** Small state glyph for the backdrop cycle button. */
export function BackdropIcon({
  mode,
  className
}: IconProps & { mode: BackdropMode }): ReactElement {
  if (mode === 'spotlight') {
    return (
      <Svg className={className}>
        <>
          <circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" />
          <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8" />
        </>
      </Svg>
    )
  }

  if (mode === 'black') {
    return (
      <Svg className={className}>
        <rect x="4" y="5" width="16" height="14" rx="2" fill="currentColor" />
      </Svg>
    )
  }

  if (mode === 'white') {
    return (
      <Svg className={className}>
        <>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8.5 12h7" />
        </>
      </Svg>
    )
  }

  return (
    <Svg className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
    </Svg>
  )
}

export function UndoIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <path d="M3 7v6h6" />
        <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
      </>
    </Svg>
  )
}

export function RedoIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <path d="M21 7v6h-6" />
        <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
      </>
    </Svg>
  )
}

export function TrashIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <>
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    </Svg>
  )
}

export function PointerIcon(props: IconProps): ReactElement {
  return (
    <Svg {...props}>
      <path d="M4 3l7.5 17 2.4-6.8L21 10.5z" />
    </Svg>
  )
}

const CHEVRON_ROTATION = { down: 0, up: 180, left: 90, right: -90 } as const

export type ChevronDirection = keyof typeof CHEVRON_ROTATION

/** Chevron used by the collapse/expand affordances, pointing at the dock edge. */
export function ChevronIcon({
  direction = 'down',
  className
}: IconProps & { direction?: ChevronDirection }): ReactElement {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: `rotate(${CHEVRON_ROTATION[direction]}deg)` }}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/**
 * A tiny screen with the dock bar highlighted on one edge. Reading the glyph
 * tells you where the toolbar will land, which a tooltip alone cannot.
 */
export function DockIcon({
  position,
  className
}: IconProps & { position: 'bottom' | 'top' | 'left' | 'right' }): ReactElement {
  const bar =
    position === 'top'
      ? { x: 6, y: 6, width: 12, height: 3 }
      : position === 'bottom'
        ? { x: 6, y: 15, width: 12, height: 3 }
        : position === 'left'
          ? { x: 6, y: 6, width: 3, height: 12 }
          : { x: 15, y: 6, width: 3, height: 12 }

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3.25" y="3.25" width="17.5" height="17.5" rx="3.2" />
      <rect
        x={bar.x}
        y={bar.y}
        width={bar.width}
        height={bar.height}
        rx="1.3"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  )
}
