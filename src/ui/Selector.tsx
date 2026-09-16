import type { Station } from '../data/stations.ts'
import { lineColour } from '../diagram/palette.ts'
import { StationInput } from './StationInput.tsx'

interface Props {
  stations: Station[]
  from: string | null
  to: string | null
  lines: string[]
  available: string[]
  onChange: (next: { from?: string | null; to?: string | null; lines?: string[] }) => void
}

export function Selector({ stations, from, to, lines, available, onChange }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-2 text-base text-ink-muted">
        <span>From</span>
        <StationInput stations={stations} value={from} exclude={to} placeholder="your station" label="Your station" onChange={(v) => onChange({ from: v })} />
        <span>to</span>
        <StationInput stations={stations} value={to} exclude={from} placeholder="destination" label="Destination" onChange={(v) => onChange({ to: v })} />
        <button
          type="button"
          className="swap"
          onClick={() => onChange({ from: to, to: from })}
          disabled={!from && !to}
          aria-label="Swap stations"
          title="Swap"
        >
          ⇅
        </button>
      </p>
      {available.length > 1 && (
        <ul className="flex flex-wrap gap-2" aria-label="Lines">
          {available.map((code) => {
            const on = lines.includes(code)
            return (
              <li key={code}>
                <button
                  type="button"
                  className="chip"
                  aria-pressed={on}
                  onClick={() => onChange({ lines: on ? lines.filter((l) => l !== code) : [...lines, code] })}
                >
                  <span className="dot" style={{ background: lineColour(code) }} />
                  {code}
                </button>
              </li>
            )
          })}
          {lines.length > 0 && (
            <li>
              <button type="button" className="chip chip-clear" onClick={() => onChange({ lines: [] })}>
                all lines
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
