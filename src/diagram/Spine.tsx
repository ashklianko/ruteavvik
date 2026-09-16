const W = 600
const H = 720
const SPINE_X = W / 2
const HORIZON_Y = H * 0.45
const HALF = W * 0.42
const TICKS: Array<[number, string]> = [
  [-1, '−1'],
  [0, '0'],
  [1, '+1'],
  [2, '+2'],
  [5, '+5'],
  [10, '+10'],
]

function xOfMinutes(m: number): number {
  const clamped = Math.max(-2, Math.min(15, m))
  const t = clamped <= 5 ? (clamped / 5) * 0.6 : 0.6 + ((clamped - 5) / 10) * 0.4
  return SPINE_X + t * HALF
}

export function Spine() {
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="Empty line diagram. Pick a station pair to see trains."
      className="block h-auto w-full max-w-full"
    >
      <line x1={SPINE_X} y1={24} x2={SPINE_X} y2={H - 24} stroke="var(--color-spine)" strokeWidth={3} />
      <line x1={0} y1={HORIZON_Y} x2={W} y2={HORIZON_Y} stroke="var(--color-spine)" strokeWidth={1.5} />
      {TICKS.map(([m, label]) => {
        const x = xOfMinutes(m)
        return (
          <g key={m}>
            <line x1={x} y1={HORIZON_Y - 5} x2={x} y2={HORIZON_Y + 5} stroke="var(--color-ink-faint)" />
            <text
              x={x}
              y={HORIZON_Y + 20}
              textAnchor="middle"
              className="num"
              fontSize={11}
              fill="var(--color-ink-faint)"
            >
              {label}
            </text>
          </g>
        )
      })}
      <text x={W - 8} y={HORIZON_Y + 36} textAnchor="end" fontSize={11} fill="var(--color-ink-faint)">
        minutes late →
      </text>
      <text x={8} y={HORIZON_Y - 10} fontSize={13} fill="var(--color-ink-muted)">
        your station
      </text>
    </svg>
  )
}
