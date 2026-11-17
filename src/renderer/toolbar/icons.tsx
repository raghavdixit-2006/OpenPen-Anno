import type { ReactElement } from 'react'

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
