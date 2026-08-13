import type { ReactNode } from 'react'

export type IconName =
  | 'activity'
  | 'book'
  | 'calendar'
  | 'chevron'
  | 'droplet'
  | 'food'
  | 'home'
  | 'logout'
  | 'plus'
  | 'recipe'
  | 'scale'
  | 'settings'
  | 'sparkle'
  | 'trend'

const iconPaths: Record<IconName, ReactNode> = {
  activity: <path d="M4 13h3l2-7 4 13 2-6h5" />,
  book: <path d="M5 4h10a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V5a1 1 0 0 1 1-1Zm2 0v16" />,
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M8 3v4m8-4v4M3 10h18" />
    </>
  ),
  chevron: <path d="m9 18 6-6-6-6" />,
  droplet: <path d="M12 3s6 6.1 6 11a6 6 0 0 1-12 0c0-4.9 6-11 6-11Z" />,
  food: (
    <>
      <path d="M5 11h14a7 7 0 0 1-14 0Zm7-5v5m-3-3v3m6-3v3" />
      <path d="M4 19h16" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  logout: <path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4m5-4 4-3-4-3m4 3H9" />,
  plus: <path d="M12 5v14M5 12h14" />,
  recipe: (
    <>
      <path d="M7 5h10l1 16H6L7 5Z" />
      <path d="M9 5V3h6v2m-5 5h4m-4 4h4" />
    </>
  ),
  scale: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="4" />
      <path d="M8 10a4.3 4.3 0 0 1 8 0l-4 2-4-2Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.8-1.8l.9-1.9L15 4l-1.9.9a7 7 0 0 0-2.2 0L9 4 6.9 6.1 7.8 8A7 7 0 0 0 7 9.8l-2 .7v3l2 .7a7 7 0 0 0 .8 1.8l-.9 1.9L9 20l1.9-.9a7 7 0 0 0 2.2 0l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .8-1.8l2-.7Z" />
    </>
  ),
  sparkle: <path d="m12 3 1.2 4.2L17 9l-3.8 1.8L12 15l-1.2-4.2L7 9l3.8-1.8L12 3Zm6 11 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14ZM5 13l.8 2.2L8 16l-2.2.8L5 19l-.8-2.2L2 16l2.2-.8L5 13Z" />,
  trend: <path d="m4 17 5-5 4 4 7-9m-5 0h5v5" />,
}

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {iconPaths[name]}
      </g>
    </svg>
  )
}
