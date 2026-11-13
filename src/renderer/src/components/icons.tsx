import type { ReactNode } from 'react'

function Svg({ children }: { children: ReactNode }): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const RefreshIcon = (): JSX.Element => (
  <Svg>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.8 3.8v4.4h-4.4" />
  </Svg>
)

export const ThemeIcon = (): JSX.Element => (
  <Svg>
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" />
  </Svg>
)

export const SettingsIcon = (): JSX.Element => (
  <Svg>
    <circle cx="12" cy="12" r="4.6" />
    <path d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8" />
  </Svg>
)

export const PowerIcon = (): JSX.Element => (
  <Svg>
    <path d="M12 3.5v8" />
    <path d="M7 6.6a7.5 7.5 0 1 0 10 0" />
  </Svg>
)

export const UserIcon = (): JSX.Element => (
  <Svg>
    <circle cx="12" cy="9" r="3.6" />
    <path d="M4.8 20a7.3 7.3 0 0 1 14.4 0" />
  </Svg>
)

export const ChatIcon = (): JSX.Element => (
  <Svg>
    <path d="M4.5 5.5h15a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17H4.5A1.5 1.5 0 0 1 3 15.5V7a1.5 1.5 0 0 1 1.5-1.5z" />
    <path d="M9 10.5h6M9 13.5h3.5" />
  </Svg>
)

export const GlobeIcon = (): JSX.Element => (
  <Svg>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.8 2.4 2.8 14.6 0 17M12 3.5c-2.8 2.4-2.8 14.6 0 17" />
  </Svg>
)

export const NewsIcon = (): JSX.Element => (
  <Svg>
    <rect x="4" y="4.5" width="16" height="15" rx="1.5" />
    <path d="M8 9h8M8 12.5h8M8 16h4.5" />
  </Svg>
)

export const ListIcon = (): JSX.Element => (
  <Svg>
    <rect x="7.5" y="3.5" width="12.5" height="17" rx="1.5" />
    <path d="M7.5 9.5H4v9.5a1.5 1.5 0 0 0 1.5 1.5H9M11 8.5h5.5M11 12h5.5M11 15.5h5.5" />
  </Svg>
)

export const BagIcon = (): JSX.Element => (
  <Svg>
    <path d="M4.5 9h15l-1 11h-13z" />
    <path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" />
  </Svg>
)

export const ImageIcon = (): JSX.Element => (
  <Svg>
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <path d="M6.5 16l4-4.5 3 3 2-2 2.5 3.5" />
    <circle cx="15.5" cy="9" r="1" />
  </Svg>
)

export const ShareIcon = (): JSX.Element => (
  <Svg>
    <rect x="4" y="11" width="16" height="8.5" rx="1.5" />
    <path d="M7 8a8 8 0 0 1 10 0M9.2 5a11 11 0 0 1 5.6 0" />
  </Svg>
)

export const PadIcon = (): JSX.Element => (
  <Svg>
    <rect x="3" y="8" width="18" height="9" rx="4.5" />
    <path d="M7.5 11v3M6 12.5h3" />
    <circle cx="15.2" cy="13.6" r="0.6" fill="currentColor" />
    <circle cx="17.3" cy="11.6" r="0.6" fill="currentColor" />
  </Svg>
)

export const CardIcon = (): JSX.Element => (
  <Svg>
    <rect x="6" y="3.5" width="12" height="17" rx="1.5" />
    <path d="M10 16.5h4" />
  </Svg>
)

export const WifiIcon = (): JSX.Element => (
  <Svg>
    <path d="M3 9.5a13 13 0 0 1 18 0" />
    <path d="M6.2 13a8.4 8.4 0 0 1 11.6 0" />
    <path d="M9.4 16.4a3.8 3.8 0 0 1 5.2 0" />
    <circle cx="12" cy="19.4" r="0.9" fill="currentColor" stroke="none" />
  </Svg>
)

/** Manette générique affichée en bas à gauche. */
export const GamepadIcon = (): JSX.Element => (
  <svg viewBox="0 0 44 28" aria-hidden="true">
    {/* Niveau de batterie : quatre carrés, le premier allumé. */}
    <rect x="0" y="2" width="4" height="4" fill="#4cb847" />
    <rect x="0" y="8" width="4" height="4" fill="#b4b4b4" />
    <rect x="0" y="14" width="4" height="4" fill="#b4b4b4" />
    <rect x="0" y="20" width="4" height="4" fill="#b4b4b4" />
    {/* Deux demi-manettes. */}
    <path d="M22 1.5h-4.5C13.6 1.5 11 4.5 11 8.5v11c0 4 2.6 7 6.5 7H22z" fill="#25282b" />
    <path d="M24 1.5h4.5C32.4 1.5 35 4.5 35 8.5v11c0 4-2.6 7-6.5 7H24z" fill="#25282b" />
    <circle cx="17.5" cy="9" r="2.2" fill="#fff" />
    <circle cx="16.5" cy="17" r="1" fill="#fff" />
    <circle cx="19.8" cy="17" r="1" fill="#fff" />
    <circle cx="18.2" cy="15" r="1" fill="#fff" />
    <circle cx="18.2" cy="19" r="1" fill="#fff" />
    <circle cx="28.5" cy="8" r="1" fill="#fff" />
    <circle cx="26.8" cy="10" r="1" fill="#fff" />
    <circle cx="30.2" cy="10" r="1" fill="#fff" />
    <circle cx="28.5" cy="12" r="1" fill="#fff" />
    <circle cx="28.5" cy="19" r="2.2" fill="#fff" />
  </svg>
)
