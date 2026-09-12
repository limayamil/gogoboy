// Iconos como SVG inline: sin dependencias y heredan currentColor.
type Props = { size?: number; className?: string }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

export const IconSun = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
)

export const IconGrid = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <rect x="3" y="3" width="7" height="9" rx="2" />
    <rect x="14" y="3" width="7" height="5" rx="2" />
    <rect x="14" y="12" width="7" height="9" rx="2" />
    <rect x="3" y="16" width="7" height="5" rx="2" />
  </svg>
)

export const IconCalendar = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
)

export const IconPlus = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconBolt = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />
  </svg>
)

export const IconEye = ({ size = 18, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const IconEyeOff = ({ size = 18, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M10.6 5.2A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a18.4 18.4 0 0 1-3.2 4.2M6.6 6.7A18.2 18.2 0 0 0 2 12s3.6 7 10 7a10.6 10.6 0 0 0 4.5-1" />
    <path d="m3 3 18 18M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </svg>
)

export const IconTrash = ({ size = 18, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
  </svg>
)

export const IconClose = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const IconChevronLeft = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="m15 5-7 7 7 7" />
  </svg>
)

export const IconChevronRight = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="m9 5 7 7-7 7" />
  </svg>
)

export const IconChevronDown = ({ size = 18, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="m6 9 6 6 6-6" />
  </svg>
)

export const IconMoon = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
  </svg>
)

export const IconPaperclip = ({ size = 18, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M21 11.5 12.5 20a5 5 0 0 1-7-7l8.5-8.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3l8-8" />
  </svg>
)

export const IconSpinner = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" opacity="0.2" />
    <path d="M21 12a9 9 0 0 0-9-9" />
  </svg>
)

export const IconFolder = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
)

export const IconAlert = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16.5h.01" />
  </svg>
)

export const IconInbox = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M3 12h5l2 3h4l2-3h5v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    <path d="M3 12 6.2 4.8A2 2 0 0 1 8 4h8a2 2 0 0 1 1.8.8L21 12" />
  </svg>
)

export const IconFlag = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M5 21V4h10l-1.5 4L19 12H5" />
  </svg>
)

export const IconList = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
  </svg>
)

export const IconLink = ({ size = 16, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </svg>
)

export const IconImage = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="3" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m3 16 4.5-4.5 4 4L15 12l6 5" />
  </svg>
)

export const IconFile = ({ size = 20, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </svg>
)

export const IconUpload = ({ size = 22, className }: Props) => (
  <svg {...base(size)} className={className} aria-hidden="true">
    <path d="M12 16V4M8 8l4-4 4 4" />
    <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </svg>
)
