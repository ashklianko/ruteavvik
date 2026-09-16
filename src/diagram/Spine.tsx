import { curveMonotoneY, line as d3line } from 'd3-shape'
import { useMemo, useState } from 'react'
import type { ArrivalWindow, CorridorTrain, SegmentObservation, SegmentStat } from '../data/derive.ts'
import { arrivalWindow, delayAt, segmentKey, WINDOW_MS } from '../data/derive.ts'
import { isPinned } from '../data/displacement.ts'
import type { Train } from '../data/model.ts'
import { fmtTime, signed } from '../format.ts'
import { buildLayout, HALF, ROW_H, SPINE_X, W, xOf, yOfCall, type Layout } from './layout.ts'
import { BAND_COLOUR, BAND_LABEL, lineColour } from './palette.ts'

interface Props {
  from: string | null
  to: string | null
  corridor: string[]
  upstreamOrder: string[]
  upstreamRows: string[]
  list: CorridorTrain[]
  trains: Train[]
  segments: Map<string, SegmentStat>
  observations: SegmentObservation[]
  now: number
  selected: string | null
  hovered: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  ariaLabel: string
}

const TICKS: Array<[number, string]> = [
  [-1, '−1'],
  [0, '0'],
  [1, '+1'],
  [2, '+2'],
  [5, '+5'],
  [10, '+10'],
  [15, '+15'],
]

const LABEL_CANDIDATES: Array<{ dx: number; dy: number }> = [
  { dx: 0, dy: -8 },
  { dx: 0, dy: 16 },
  { dx: 0, dy: -21 },
  { dx: 0, dy: 29 },
  { dx: 140, dy: -8 },
  { dx: 140, dy: 16 },
]
const CHAR_W = 6.6
const LABEL_H = 11

interface Mark {
  ct: CorridorTrain
  x: number
  y: number
  hollow: boolean
  label: string
  sub: string | null
  trail: Array<[number, number]>
  pinned: boolean
  ghost: { x: number; y: number; due: boolean } | null
}

const curve = d3line<[number, number]>()
  .x((d) => d[0])
  .y((d) => d[1])
  .curve(curveMonotoneY)

function ghostOf(train: Train, index: number, layout: Layout, from: string, x: number, now: number): Mark['ghost'] {
  const here = train.calls[index]
  const next = train.calls[index + 1]
  if (!next || here.actualDeparture === null || here.aimedDeparture === null) return null
  const nextAimed = next.aimedArrival ?? next.aimedDeparture
  if (nextAimed === null) return null
  const run = nextAimed - here.aimedDeparture
  if (run <= 0) return null
  const progress = Math.min(1, Math.max(0, (now - here.actualDeparture) / run))
  if (progress < 0.03) return null
  const y0 = yOfCall(layout, train, index, from)
  const y1 = yOfCall(layout, train, index + 1, from)
  return { x, y: y0 + (y1 - y0) * progress, due: progress >= 1 }
}

function marksOf(list: CorridorTrain[], layout: Layout, from: string, now: number): Mark[] {
  const marks: Mark[] = []
  const notDepartedCount = list.filter((c) => c.state.kind === 'not-departed').length
  const spacing = Math.min(56, (W - SPINE_X - 40) / Math.max(1, notDepartedCount))
  let notDeparted = 0
  for (const ct of list) {
    const { train, state } = ct
    if (state.kind === 'not-departed') {
      const fromCall = train.calls.find((c) => c.station === from)
      marks.push({
        ct,
        x: SPINE_X + 18 + notDeparted++ * spacing,
        y: layout.yNotDeparted ?? layout.horizonY,
        hollow: true,
        label: fromCall?.aimedDeparture ? fmtTime(fromCall.aimedDeparture) : train.number,
        sub: null,
        trail: [],
        pinned: false,
        ghost: null,
      })
      continue
    }
    if (state.kind === 'starts-here') {
      const startsHere = list.filter((c) => c.state.kind === 'starts-here')
      if (startsHere[0] !== ct) continue
      const label = startsHere.length === 1 ? train.number : `${startsHere.length}`
      const sub =
        startsHere.length === 1
          ? 'starts here'
          : `start here, next ${fmtTime(train.calls.find((c) => c.station === from)?.aimedDeparture ?? 0)}`
      marks.push({ ct, x: SPINE_X, y: layout.horizonY, hollow: true, label, sub, trail: [], pinned: false, ghost: null })
      continue
    }
    const y = yOfCall(layout, train, state.index, from)
    const x = xOf(state.delay)
    const onRow = ct.group === 'ahead' || layout.shownUpstream.has(state.at) || state.stopsAway <= 0
    const trail: Array<[number, number]> = []
    for (let i = state.index, n = 0; i >= 0 && n < 4; i--) {
      const d = delayAt(train.calls[i])
      if (d === null) continue
      trail.unshift([xOf(d), yOfCall(layout, train, i, from)])
      n++
    }
    marks.push({
      ct,
      x,
      y,
      hollow: false,
      label: `${train.number} ${signed(state.delay)}`,
      sub: onRow ? null : `at ${state.at}`,
      trail,
      pinned: isPinned(state.delay),
      ghost: ghostOf(train, state.index, layout, from, x, now),
    })
  }
  return marks
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

function labelSlots(marks: Mark[]): Map<string, { dx: number; dy: number }> {
  const placed: Rect[] = []
  const out = new Map<string, { dx: number; dy: number }>()
  const ordered = [...marks].sort((a, b) => a.y - b.y || a.x - b.x)
  for (const m of ordered) {
    const text = m.sub ? `${m.label} ${m.sub}` : m.label
    const w = text.length * CHAR_W
    const base = (m.pinned ? 20 : 10) + m.x
    let chosen = LABEL_CANDIDATES[0]
    for (const c of LABEL_CANDIDATES) {
      const rect = { x: base + c.dx, y: m.y + c.dy - LABEL_H, w, h: LABEL_H + 2 }
      if (!placed.some((p) => overlaps(p, rect))) {
        chosen = c
        break
      }
    }
    placed.push({ x: base + chosen.dx, y: m.y + chosen.dy - LABEL_H, w, h: LABEL_H + 2 })
    out.set(m.ct.train.id, chosen)
  }
  return out
}

export function Spine(props: Props) {
  const { from, to, corridor, upstreamOrder, upstreamRows, list, trains, segments, observations, now, selected, hovered, onSelect, onHover, ariaLabel } = props
  const empty = !from || !to
  const [hoverSegment, setHoverSegment] = useState<string | null>(null)

  const layout = useMemo(
    () => buildLayout({ corridor: corridor.length ? corridor : [from ?? ''], upstreamOrder, upstreamRows, from: from ?? '', list }),
    [corridor, upstreamOrder, upstreamRows, list, from],
  )
  const marks = useMemo(() => marksOf(list, layout, from ?? '', now), [list, layout, from, now])
  const slots = useMemo(() => labelSlots(marks), [marks])
  const labelX = useMemo(() => {
    const minX = new Map<number, number>()
    for (const m of marks) if (m.x < SPINE_X - 6) minX.set(Math.round(m.y), Math.min(minX.get(Math.round(m.y)) ?? Infinity, m.x))
    return (y: number) => Math.min(SPINE_X - 14, (minX.get(Math.round(y)) ?? Infinity) - 12)
  }, [marks])

  const focusId = hovered ?? selected
  const segmentTrains = useMemo(() => {
    if (!hoverSegment) return null
    const since = now - WINDOW_MS
    const m = new Map<string, number>()
    for (const o of observations) if (segmentKey(o.a, o.b) === hoverSegment && o.at >= since && o.at <= now) m.set(o.trainId, o.added)
    return m
  }, [hoverSegment, observations, now])
  const dimmed = focusId !== null || segmentTrains !== null
  const isLit = (id: string) => (segmentTrains ? segmentTrains.has(id) : focusId === id)

  const focusWindow: { ct: CorridorTrain; w: ArrivalWindow } | null = useMemo(() => {
    if (!focusId || !to) return null
    const ct = list.find((c) => c.train.id === focusId)
    if (!ct) return null
    const w = arrivalWindow(ct, to, trains, now)
    return w ? { ct, w } : null
  }, [focusId, list, to, trains, now])

  const colours = useMemo(() => [...new Set(list.map((c) => lineColour(c.train.line)))], [list])
  const gradId = (colour: string) => `fade-${colour.replace(/[^a-z0-9]/gi, '')}`

  return (
    <svg
      viewBox={`0 0 ${W} ${layout.height}`}
      role="img"
      aria-label={ariaLabel}
      className="spine block h-auto w-full max-w-full select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null)
      }}
    >
      <defs>
        <filter id="glow" x="-50%" y="-20%" width="200%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        {colours.map((c) => (
          <linearGradient key={c} id={gradId(c)} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c} stopOpacity={0.1} />
            <stop offset="1" stopColor={c} stopOpacity={0.9} />
          </linearGradient>
        ))}
      </defs>

      <line x1={SPINE_X} y1={layout.rows[0]?.y ?? 0} x2={SPINE_X} y2={layout.horizonY} stroke="var(--color-spine)" strokeWidth={3} />

      {layout.rows.map((row, i) => {
        if (row.kind !== 'corridor') return null
        const prev = layout.rows[i - 1]
        const a = prev.kind === 'corridor' || prev.kind === 'horizon' ? prev.station : null
        const key = a ? segmentKey(a, row.station) : ''
        const stat = a ? segments.get(key) : undefined
        const band = stat?.band ?? 'few'
        const hot = band === 'plus1' || band === 'plus2' || band === 'worse'
        const active = hoverSegment === key
        const title =
          stat && stat.n >= 4
            ? `${a} to ${row.station}, ${BAND_LABEL[band]}, ${signed(stat.added)} over ${stat.n} trains`
            : `${a} to ${row.station}, ${BAND_LABEL.few} (${stat?.n ?? 0} measured)`
        return (
          <g key={`seg-${row.station}`} className="segment">
            {hot && <line x1={SPINE_X} y1={prev.y} x2={SPINE_X} y2={row.y} stroke={BAND_COLOUR[band]} strokeWidth={active ? 14 : 10} strokeOpacity={active ? 0.7 : 0.45} strokeLinecap="round" filter="url(#glow)" />}
            <line
              x1={SPINE_X}
              y1={prev.y}
              x2={SPINE_X}
              y2={row.y}
              stroke={BAND_COLOUR[band]}
              strokeWidth={band === 'few' ? 2 : band === 'steady' ? 3 : 5}
              strokeDasharray={band === 'few' ? '3 5' : undefined}
              strokeLinecap="round"
            />
            <line
              x1={SPINE_X}
              y1={prev.y + 4}
              x2={SPINE_X}
              y2={row.y - 4}
              stroke="transparent"
              strokeWidth={18}
              tabIndex={stat && stat.n >= 4 ? 0 : -1}
              aria-label={title}
              onMouseEnter={() => setHoverSegment(key)}
              onMouseLeave={() => setHoverSegment(null)}
              onFocus={() => setHoverSegment(key)}
              onBlur={() => setHoverSegment(null)}
            >
              <title>{title}</title>
            </line>
            {active && stat && (
              <text x={SPINE_X + 14} y={(prev.y + row.y) / 2 + 4} fontSize={11} fill="var(--color-ink)" style={{ paintOrder: 'stroke', stroke: 'var(--color-ground)', strokeWidth: 3 }}>
                <tspan className="num">{stat.n >= 4 ? signed(stat.added) : `${stat.n}`}</tspan>
                <tspan fill="var(--color-ink-muted)"> {stat.n >= 4 ? `added here, ${stat.n} trains` : 'trains, too few to say'}</tspan>
              </text>
            )}
          </g>
        )
      })}

      {!empty &&
        layout.rows.map((row) => {
          if (row.kind === 'horizon') return null
          const label = row.kind === 'not-departed' ? 'not departed yet' : row.kind === 'further' ? 'further out' : row.station
          return (
            <g key={`row-${row.kind}-${'station' in row ? row.station : ''}`}>
              <line x1={SPINE_X - 6} y1={row.y} x2={SPINE_X + 6} y2={row.y} stroke="var(--color-spine)" strokeWidth={1} />
              <text x={labelX(row.y)} y={row.y + 4} textAnchor="end" fontSize={12} fill={row.kind === 'corridor' || row.kind === 'upstream' ? 'var(--color-ink-muted)' : 'var(--color-ink-faint)'}>
                {label}
              </text>
            </g>
          )
        })}

      <g>
        <line x1={0} y1={layout.horizonY} x2={W} y2={layout.horizonY} stroke="var(--color-ink-muted)" strokeWidth={1} />
        <text x={labelX(layout.horizonY)} y={layout.horizonY + 4} textAnchor="end" fontSize={13} fontWeight={500} fill="var(--color-ink)">
          {from ?? ''}
        </text>
        {TICKS.map(([m, label]) => {
          const x = xOf(m * 60)
          return (
            <g key={m}>
              <line x1={x} y1={layout.horizonY - 4} x2={x} y2={layout.horizonY + 4} stroke="var(--color-ink-faint)" />
              <text x={x} y={layout.horizonY + 17} textAnchor="middle" className="num" fontSize={10} fill="var(--color-ink-faint)">
                {label}
              </text>
            </g>
          )
        })}
        <text x={SPINE_X + HALF} y={layout.horizonY - 8} textAnchor="end" fontSize={10} fill="var(--color-ink-faint)">
          minutes late
        </text>
      </g>

      {marks.map((m) => {
        const id = m.ct.train.id
        const lit = isLit(id)
        const colour = lineColour(m.ct.train.line)
        if (m.trail.length < 2) return null
        return (
          <g key={`trail-${id}`} className="trail" opacity={dimmed && !lit ? 0.15 : 1}>
            <path d={curve(m.trail) ?? undefined} fill="none" stroke={lit ? colour : `url(#${gradId(colour)})`} strokeWidth={lit ? 2.2 : 1.6} strokeLinejoin="round" strokeLinecap="round" />
            {m.trail.slice(0, -1).map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={2} fill={colour} fillOpacity={0.3 + (i / Math.max(1, m.trail.length - 1)) * 0.5} />
            ))}
          </g>
        )
      })}

      {marks.map((m) => {
        if (!m.ghost) return null
        const id = m.ct.train.id
        const lit = isLit(id)
        const colour = lineColour(m.ct.train.line)
        return (
          <g key={`ghost-${id}`} className="ghost" opacity={dimmed && !lit ? 0.15 : 0.8}>
            <line x1={m.x} y1={m.y} x2={m.ghost.x} y2={m.ghost.y} stroke={colour} strokeWidth={1} strokeDasharray="2 4" strokeOpacity={0.6} />
            <g className="ghost-mark" style={{ transform: `translate(${m.ghost.x}px, ${m.ghost.y}px)` }}>
              <circle r={4} fill="var(--color-ground)" stroke={colour} strokeWidth={1.4} strokeDasharray={m.ghost.due ? '2 2' : undefined} />
            </g>
          </g>
        )
      })}

      {focusWindow && (() => {
        const yTo = layout.yOfStation(to!)
        if (yTo === undefined) return null
        const { w } = focusWindow
        const d = focusWindow.ct.state.kind === 'measured' ? focusWindow.ct.state.delay : 0
        const x0 = xOf(d)
        const x1 = w.upper !== null ? xOf(d + (w.upper - w.lower) / 1000) : x0
        return (
          <g className="window">
            <line x1={x0} y1={yTo - 9} x2={x0} y2={yTo + 9} stroke="var(--color-ink)" strokeWidth={1.2} />
            {w.upper !== null && (
              <>
                <line x1={x0} y1={yTo} x2={x1} y2={yTo} stroke="var(--color-ink)" strokeWidth={1.2} />
                <line x1={x1} y1={yTo - 9} x2={x1} y2={yTo + 9} stroke="var(--color-ink)" strokeWidth={1.2} />
              </>
            )}
            <text x={Math.max(x1, x0) + 10} y={yTo + 4} fontSize={11} fill="var(--color-ink)" style={{ paintOrder: 'stroke', stroke: 'var(--color-ground)', strokeWidth: 3 }}>
              <tspan fill="var(--color-ink-muted)">arrives </tspan>
              <tspan className="num">{fmtTime(w.lower)}</tspan>
              {w.upper !== null && (
                <>
                  <tspan className="num">–{fmtTime(w.upper)}</tspan>
                  <tspan fill="var(--color-ink-muted)"> from the last {w.sample} trains</tspan>
                </>
              )}
              {w.upper === null && <tspan fill="var(--color-ink-muted)"> if it does not catch up</tspan>}
            </text>
          </g>
        )
      })()}

      {marks.map((m) => {
        const id = m.ct.train.id
        const lit = isLit(id)
        const isSel = selected === id
        const colour = lineColour(m.ct.train.line)
        const slot = slots.get(id) ?? LABEL_CANDIDATES[0]
        const segAdded = segmentTrains?.get(id)
        const label = segAdded !== undefined ? `${m.ct.train.number} ${signed(segAdded)}` : m.label
        const sub = segAdded !== undefined ? 'here' : m.sub
        return (
          <a
            key={id}
            href={`#train-${encodeURIComponent(id)}`}
            className="mark"
            style={{ transform: `translate(${m.x}px, ${m.y}px)`, opacity: dimmed && !lit ? 0.3 : 1 }}
            onClick={(e) => {
              e.preventDefault()
              onSelect(isSel ? null : id)
            }}
            onMouseEnter={() => onHover(id)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => onHover(id)}
            onBlur={() => onHover(null)}
          >
            <title>
              {m.ct.train.line} {m.ct.train.number} to {m.ct.train.destination}
              {m.ct.state.kind === 'measured' ? `, ${signed(m.ct.state.delay)} at ${m.ct.state.at}` : `, ${m.ct.state.kind === 'starts-here' ? 'starts here' : 'not departed yet'}`}
            </title>
            <circle r={14} fill="transparent" />
            {m.hollow ? (
              <circle r={5} fill="var(--color-ground)" stroke={colour} strokeWidth={1.5} />
            ) : (
              <circle r={isSel || lit ? 7 : 5.5} fill={colour} stroke={isSel ? 'var(--color-ink)' : 'var(--color-ground)'} strokeWidth={1.5} />
            )}
            {m.pinned && (
              <text x={10} y={4} fontSize={12} fill={colour}>
                »
              </text>
            )}
            {slot.dx > 0 && <line x1={8} y1={0} x2={(m.pinned ? 20 : 10) + slot.dx - 4} y2={slot.dy - 4} stroke="var(--color-ink-faint)" strokeWidth={0.75} />}
            <text x={(m.pinned ? 20 : 10) + slot.dx} y={slot.dy} className="num" fontSize={11} fill={m.hollow ? 'var(--color-ink-faint)' : 'var(--color-ink)'} style={{ paintOrder: 'stroke', stroke: 'var(--color-ground)', strokeWidth: 3 }}>
              {label}
              {sub && (
                <tspan fontFamily="var(--font-sans)" fill="var(--color-ink-muted)">
                  {' '}
                  {sub}
                </tspan>
              )}
            </text>
          </a>
        )
      })}

      {!empty && list.length === 0 && (
        <text x={SPINE_X + 20} y={layout.horizonY - ROW_H * 2} fontSize={13} fill="var(--color-ink-faint)">
          Nothing running on this pair right now.
        </text>
      )}
    </svg>
  )
}

