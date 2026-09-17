export function Emblem({ height = 22 }: { height?: number }) {
  return (
    <svg width={(height * 44) / 24} height={height} viewBox="0 0 44 24" aria-hidden="true" className="emblem shrink-0" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g stroke="var(--color-ink)" strokeWidth="2">
        <path d="M1 2 H33 A3 3 0 0 1 35.7 3.7 L41 14.5 V18 A2 2 0 0 1 39 20 H1" />
        <rect x="4" y="6" width="6.5" height="6.5" rx="1" />
        <rect x="14" y="6" width="6.5" height="6.5" rx="1" />
        <rect x="24" y="6" width="6.5" height="6.5" rx="1" />
        <path d="M1 23 H43" />
      </g>
      <path d="M33.5 6 H36.2 L39.4 12.5 H33.5 Z" stroke="var(--color-late-1)" strokeWidth="2" />
      <g fill="var(--color-ink)">
        <circle cx="8" cy="21.4" r="1.6" />
        <circle cx="13" cy="21.4" r="1.6" />
        <circle cx="28" cy="21.4" r="1.6" />
        <circle cx="33" cy="21.4" r="1.6" />
      </g>
    </svg>
  )
}
