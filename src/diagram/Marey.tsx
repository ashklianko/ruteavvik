import { scaleLinear } from 'd3-scale'
import { useMemo } from 'react'
import { delayAt, indexOf, lastMeasuredIndex, measuredAt } from '../data/derive.ts'
import type { Train } from '../data/model.ts'
import { fmtTime, signed } from '../format.ts'
import { delayColour } from './palette.ts'

interface Props {
  from: string
  to: string
  rows: string[]
  trains: Train[]
  now: number
  selected: string | null
  hovered: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  scrub: number | null
  onScrub: (t: number | null) => void
  compact?: boolean
  ariaLabel: string
}

export const MW = 640
const PAD_TOP = 44
const PAD_BOTTOM = 14
const PAST_MS = 100 * 60_000
const FUTURE_MS = 30 * 60_000

type Pt = [number, number]

interface Series {
  train: Train
  measured: Pt[]
  timetable: Pt[]
  projected: Pt[]
  last: { x: number; y: number; delay: number } | null
}

export function Marey({ from, to, rows, trains, now, selected, hovered, onSelect, onHover, scrub, onScrub, compact = false, ariaLabel }: Props) {
  const LABEL_W = compact ? 92 : 124
  const ROW = compact ? 26 : 36
  const TICK_MS = compact ? 30 * 60_000 : 15 * 60_000
  const height = PAD_TOP + (rows.length - 1) * ROW + PAD_BOTTOM
  const t0 = now - PAST_MS
  const t1 = now + FUTURE_MS
  const x = useMemo(() => scaleLinear().domain([t0, t1]).range([LABEL_W, MW - 16]), [t0, t1, LABEL_W])
  const rowY = useMemo(() => new Map(rows.map((s, i) => [s, PAD_TOP + i * ROW])), [rows, ROW])

  const series = useMemo<Series[]>(() => {
    const out: Series[] = []
    const toIndex = (t: Train) => indexOf(t, to)
    for (const train of trains) {
      const end = toIndex(train)
      if (end < 0) continue
      const measured: Pt[] = []
      const timetable: Pt[] = []
      const projected: Pt[] = []
      const lastIdx = lastMeasuredIndex(train)
      const delay = lastIdx >= 0 ? delayAt(train.calls[lastIdx]) : null
      let last: Series['last'] = null
      for (let i = 0; i <= end; i++) {
        const c = train.calls[i]
        const y = rowY.get(c.station)
        if (y === undefined) continue
        const aimed = c.aimedDeparture ?? c.aimedArrival
        if (aimed !== null) timetable.push([x(aimed), y])
        const at = measuredAt(c)
        const d = delayAt(c)
        if (at !== null && d !== null && i <= lastIdx) {
          measured.push([x(at), y])
          last = { x: x(at), y, delay: d }
        } else if (aimed !== null && delay !== null && i > lastIdx) {
          projected.push([x(aimed + delay * 1000), y])
        }
      }
      if (last && projected.length) projected.unshift([last.x, last.y])
      if (measured.length + timetable.length === 0) continue
      out.push({ train, measured, timetable, projected, last })
    }
    return out
  }, [trains, to, rowY, x])

  const ticks = useMemo(() => {
    const step = TICK_MS
    const first = Math.ceil(t0 / step) * step
    const list: number[] = []
    for (let t = first; t <= t1; t += step) list.push(t)
    return list
  }, [t0, t1, TICK_MS])

  const focusId = hovered ?? selected
  const dimmed = focusId !== null
  const pts = (p: Pt[]) => p.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')

  return (
    <svg
      viewBox={`0 0 ${MW} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="marey block h-auto w-full max-w-full select-none"
      onClick={(e) => e.target === e.currentTarget && onSelect(null)}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return
        const rect = e.currentTarget.getBoundingClientRect()
        const sx = ((e.clientX - rect.left) / rect.width) * MW
        if (sx < LABEL_W || sx > MW - 16) {
          onScrub(null)
          return
        }
        const t = x.invert(sx)
        onScrub(t < now ? t : null)
      }}
      onPointerLeave={() => onScrub(null)}
    >
      <defs>
        <clipPath id="marey-clip">
          <rect x={LABEL_W - 4} y={0} width={MW - LABEL_W + 4} height={height} />
        </clipPath>
      </defs>

      {ticks.map((t) => (
        <g key={t}>
          <line x1={x(t)} y1={PAD_TOP - 6} x2={x(t)} y2={height - PAD_BOTTOM} stroke="var(--color-spine-dim)" strokeWidth={1} />
          <text x={x(t)} y={PAD_TOP - 14} textAnchor="middle" className="num" fontSize={11} fill="var(--color-ink-faint)">
            {fmtTime(t)}
          </text>
        </g>
      ))}

      {rows.map((s) => {
        const y = rowY.get(s)!
        const isFrom = s === from
        return (
          <g key={s}>
            <line x1={LABEL_W - 4} y1={y} x2={MW - 16} y2={y} stroke={isFrom ? 'var(--color-ink-muted)' : 'var(--color-spine-dim)'} strokeWidth={isFrom ? 1 : 0.5} />
            <text x={LABEL_W - 12} y={y + 4} textAnchor="end" fontSize={compact ? (isFrom ? 12 : 11) : isFrom ? 14 : 13} fontWeight={isFrom ? 500 : 400} fill={isFrom ? 'var(--color-ink)' : 'var(--color-ink-muted)'}>
              {s}
            </text>
          </g>
        )
      })}

      <g clipPath="url(#marey-clip)">
        {series.map((s) => {
          const id = s.train.id
          const lit = focusId === id
          const colour = delayColour(s.last?.delay ?? null)
          return (
            <g key={`tt-${id}`} opacity={dimmed && !lit ? 0.08 : 0.28}>
              {s.timetable.length > 1 && <polyline points={pts(s.timetable)} fill="none" stroke={colour} strokeWidth={1} strokeDasharray="2 3" />}
            </g>
          )
        })}
        {series.map((s) => {
          const id = s.train.id
          const lit = focusId === id
          const colour = delayColour(s.last?.delay ?? null)
          return (
            <g
              key={id}
              className="marey-train"
              data-train={s.train.number}
              tabIndex={0}
              role="button"
              aria-label={`${s.train.line} ${s.train.number} to ${s.train.destination}${s.last ? `, ${signed(s.last.delay)}` : ', not measured'}`}
              onFocus={() => onHover(id)}
              onBlur={() => onHover(null)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(selected === id ? null : id)
                }
              }}
              opacity={dimmed && !lit ? 0.18 : 1}
              onMouseEnter={() => onHover(id)}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(selected === id ? null : id)
              }}
            >
              <title>
                {s.train.line} {s.train.number} to {s.train.destination}
                {s.last ? `, ${signed(s.last.delay)}` : ', not measured'}
              </title>
              {s.projected.length > 1 && <polyline points={pts(s.projected)} fill="none" stroke={colour} strokeWidth={1} strokeDasharray="1 3" opacity={0.7} />}
              {s.measured.length > 1 && <polyline points={pts(s.measured)} fill="none" stroke="transparent" strokeWidth={12} />}
              {s.measured.length > 1 && <polyline points={pts(s.measured)} fill="none" stroke={colour} strokeWidth={lit ? 2.4 : 1.5} strokeLinejoin="round" strokeLinecap="round" />}
              {s.measured.map(([px, py], i) => (
                <circle key={i} cx={px} cy={py} r={lit ? 2.6 : 1.8} fill={colour} />
              ))}
              {s.last && lit && (
                <text x={s.last.x > MW - 180 ? s.last.x - 8 : s.last.x + 8} y={s.last.y - 8} textAnchor={s.last.x > MW - 180 ? 'end' : 'start'} className="num" fontSize={11} fill="var(--color-ink)" style={{ paintOrder: 'stroke', stroke: 'var(--color-ground)', strokeWidth: 3 }}>
                  {s.train.line} {s.train.number} {signed(s.last.delay)}
                  <tspan fontFamily="var(--font-sans)" fill="var(--color-ink-muted)">
                    {' '}
                    to {s.train.destination}
                  </tspan>
                </text>
              )}
            </g>
          )
        })}
      </g>

      {scrub !== null && (
        <g className="scrub">
          <line x1={x(scrub)} y1={PAD_TOP - 8} x2={x(scrub)} y2={height - PAD_BOTTOM} stroke="var(--color-focus)" strokeWidth={1} strokeDasharray="3 3" />
          <text x={x(scrub)} y={PAD_TOP - 24} textAnchor="middle" className="num" fontSize={11} fill="var(--color-focus)" style={{ paintOrder: 'stroke', stroke: 'var(--color-ground)', strokeWidth: 3 }}>
            {fmtTime(scrub)}
          </text>
        </g>
      )}
      <g>
        <line x1={x(now)} y1={PAD_TOP - 8} x2={x(now)} y2={height - PAD_BOTTOM} stroke="var(--color-ink)" strokeWidth={1} strokeOpacity={0.7} />
        <text x={x(now) + 4} y={height - PAD_BOTTOM + 10} className="num" fontSize={11} fill="var(--color-ink-muted)">
          now {fmtTime(now)}
        </text>
      </g>
    </svg>
  )
}
