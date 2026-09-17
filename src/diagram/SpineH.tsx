import { useCallback, useMemo, useState } from 'react'
import type { CorridorTrain, SegmentObservation, SegmentStat } from '../data/derive.ts'
import { delayAt, MIN_PASSES, segmentKey, WINDOW_MS } from '../data/derive.ts'
import { displacement, isPinned, ticksFor, type AxisMax } from '../data/displacement.ts'
import { delayWords, fmtTime, signed, STATE_WORDS } from '../format.ts'
import { buildLayout, ghostProgress, isFar, PAD, yOfCall, type Layout } from './layout.ts'
import { BAND_COLOUR, BAND_LABEL, delayColour } from './palette.ts'

interface Props {
  from: string | null
  to: string | null
  corridor: string[]
  upstreamOrder: string[]
  upstreamRows: string[]
  list: CorridorTrain[]
  segments: Map<string, SegmentStat>
  observations: SegmentObservation[]
  now: number
  minor: Set<string>
  axisMax: AxisMax
  narrow?: boolean
  ghostNow?: number
  ariaLabel?: string
  selected: string | null
  hovered: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}

const FULL = { HW: 1000, HH: 430, LEFT: 104, RIGHT: 30, BASE: 330, HALFY: 280 }
const NARROW = { HW: 1000, HH: 560, LEFT: 104, RIGHT: 30, BASE: 450, HALFY: 400 }


export function SpineH({ from, to, corridor, upstreamOrder, upstreamRows, list, segments, observations, now, ghostNow = now, minor, axisMax, narrow = false, ariaLabel, selected, hovered, onSelect, onHover }: Props) {
  const { HW, HH, LEFT, RIGHT, BASE, HALFY } = narrow ? NARROW : FULL
  const [hoverSegment, setHoverSegment] = useState<string | null>(null)
  const [openCluster, setOpenCluster] = useState<string | null>(null)
  const yOfDelay = useCallback((s: number) => BASE - displacement(s, HALFY, axisMax), [axisMax, BASE, HALFY])
  const empty = !from || !to
  const layout: Layout = useMemo(
    () => buildLayout({ corridor: corridor.length ? corridor : [from ?? ''], upstreamOrder, upstreamRows, from: from ?? '', list, minor }),
    [corridor, upstreamOrder, upstreamRows, list, from, minor],
  )
  const xOfY = useMemo(() => {
    const span = Math.max(1, layout.height - 2 * PAD - 8)
    const k = (HW - LEFT - RIGHT) / span
    return (y: number) => LEFT + (y - PAD) * k
  }, [layout, HW, LEFT, RIGHT])
  const focusId = hovered ?? selected
  const segmentTrains = useMemo(() => {
    if (!hoverSegment) return null
    const since = now - WINDOW_MS
    const m = new Map<string, number>()
    for (const o of observations) if (segmentKey(o.a, o.b) === hoverSegment && o.at >= since && o.at <= now) m.set(o.trainId, o.added)
    return m
  }, [hoverSegment, observations, now])

  const allMarks = useMemo(() => {
    const notDeparted = list.filter((c) => c.state.kind === 'not-departed')
    const startsHere = list.filter((c) => c.state.kind === 'starts-here')
    return list.flatMap((ct) => {
      const { train, state } = ct
      if (state.kind === 'not-departed') {
        if (notDeparted[0] !== ct) return []
        const call = train.calls.find((c) => c.station === from)
        const first = call?.aimedDeparture ? fmtTime(call.aimedDeparture) : ''
        return [{ ct, x: layout.yNotDeparted !== null ? xOfY(layout.yNotDeparted) : LEFT, y: BASE, hollow: true, label: notDeparted.length === 1 ? `${first} ${STATE_WORDS.notDeparted}` : `${notDeparted.length} ${STATE_WORDS.notDeparted}`, trail: [] as Array<[number, number]>, ghost: null as { x: number; due: boolean } | null }]
      }
      if (state.kind === 'starts-here') {
        if (startsHere[0] !== ct) return []
        return [{ ct, x: xOfY(layout.horizonY), y: BASE, hollow: true, label: startsHere.length === 1 ? `${train.line} ${STATE_WORDS.startsHere}` : `${startsHere.length} start here`, trail: [] as Array<[number, number]>, ghost: null as { x: number; due: boolean } | null }]
      }
      const trail: Array<[number, number]> = []
      for (let i = state.index, n = 0; i >= 0 && n < 4; i--) {
        const d = delayAt(train.calls[i])
        if (d === null) continue
        if (i !== state.index && isFar(layout, train, i, from ?? '')) break
        trail.unshift([xOfY(yOfCall(layout, train, i, from ?? '')), yOfDelay(d)])
        n++
      }
      const x = xOfY(yOfCall(layout, train, state.index, from ?? ''))
      const gp = ghostProgress(train, state.index, ghostNow)
      const ghost = gp ? { x: x + (xOfY(yOfCall(layout, train, state.index + 1, from ?? '')) - x) * gp.progress, due: gp.due } : null
      return [
        {
          ct,
          x,
          y: yOfDelay(state.delay),
          hollow: false,
          label: isPinned(state.delay, axisMax) ? `${train.line} » ${delayWords(state.delay)}` : train.line,
          trail,
          ghost,
        },
      ]
    })
  }, [list, layout, from, xOfY, yOfDelay, axisMax, BASE, LEFT, ghostNow])

  const clusters = useMemo(() => {
    const groups = new Map<string, typeof allMarks>()
    for (const m of allMarks) {
      if (m.hollow || m.ct.state.kind !== 'measured') continue
      const key = `${m.ct.state.at}:${Math.round(m.x)}:${Math.round(m.y / 10)}`
      const grp = groups.get(key)
      if (grp) grp.push(m)
      else groups.set(key, [m])
    }
    return new Map([...groups].filter(([, grp]) => grp.length > 1))
  }, [allMarks])
  const clusterOf = (id: string) => {
    for (const [key, grp] of clusters) if (grp.some((m) => m.ct.train.id === id)) return key
    return null
  }
  const marks = useMemo(() => {
    const collapsed = new Set<string>()
    for (const [key, grp] of clusters) if (key !== openCluster) for (const m of grp.slice(1)) collapsed.add(m.ct.train.id)
    return allMarks.filter((m) => !collapsed.has(m.ct.train.id))
  }, [allMarks, clusters, openCluster])
  const openMembers = openCluster ? new Set(clusters.get(openCluster)?.map((m) => m.ct.train.id)) : null
  const dimmed = focusId !== null || segmentTrains !== null
  const isLit = (id: string) => (segmentTrains ? segmentTrains.has(id) : focusId === id || (openMembers?.has(id) ?? false))
  const labelDy = useMemo(() => {
    const placed: Array<{ x: number; y: number; w: number; h: number }> = marks.map((m) => ({ x: m.x - 8, y: m.y - 8, w: 16, h: 16 }))
    const out = new Map<string, number>()
    const candidates = [-8, 18, -22, 32]
    const sorted = [...marks].filter((m) => m.label).sort((a, b) => a.x - b.x || a.y - b.y)
    for (const m of sorted) {
      const w = m.label.length * 6.6
      let chosen = candidates[0]
      for (const dy of candidates) {
        const rect = { x: m.x + 9, y: m.y + dy - 11, w, h: 13 }
        if (!placed.some((p) => rect.x < p.x + p.w && p.x < rect.x + rect.w && rect.y < p.y + p.h && p.y < rect.y + rect.h)) {
          chosen = dy
          break
        }
      }
      placed.push({ x: m.x + 9, y: m.y + chosen - 11, w, h: 13 })
      out.set(m.ct.train.id, chosen)
    }
    return out
  }, [marks])

  return (
    <svg viewBox={`0 0 ${HW} ${HH}`} role="group" aria-label={ariaLabel ?? 'Line diagram, stations across and delay upwards'} className="spine block h-auto w-full max-w-full select-none" onClick={(e) => e.target === e.currentTarget && onSelect(null)} onMouseLeave={() => setOpenCluster(null)}>
      <defs>
        <filter id="glow-h" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {ticksFor(axisMax).map((m) => {
        const label = m === 0 ? '0' : `+${m}`
        const y = yOfDelay(m * 60)
        return (
          <g key={m}>
            <line x1={LEFT - 8} y1={y} x2={HW - RIGHT} y2={y} stroke="var(--color-spine-dim)" strokeWidth={m === 0 ? 0 : 0.5} />
            <line x1={LEFT - 12} y1={y} x2={LEFT - 6} y2={y} stroke="var(--color-ink-faint)" />
            <text x={LEFT - 16} y={y + 4} textAnchor="end" className="num" fontSize={11} fill="var(--color-ink-faint)">
              {label}
            </text>
          </g>
        )
      })}
      <text x={LEFT - 6} y={yOfDelay(axisMax * 60) - 16} textAnchor="end" fontSize={12} fill="var(--color-ink-muted)">
        minutes late ↑
      </text>

      <line x1={LEFT - 8} y1={BASE} x2={HW - RIGHT} y2={BASE} stroke="var(--color-spine)" strokeWidth={3} strokeLinecap="round" />

      {layout.rows.map((row, i) => {
        if (row.kind !== 'corridor') return null
        const prev = layout.rows[i - 1]
        const a = prev.kind === 'corridor' || prev.kind === 'horizon' ? prev.station : null
        const stat = a ? segments.get(segmentKey(a, row.station)) : undefined
        const band = stat?.band ?? 'few'
        const hot = band === 'plus1' || band === 'plus2' || band === 'worse'
        const key = a ? segmentKey(a, row.station) : ''
        const active = hoverSegment === key
        const title = stat && stat.n >= MIN_PASSES ? `${a} to ${row.station}, ${BAND_LABEL[band]}, ${signed(stat.added)} over ${stat.n} trains` : `${a} to ${row.station}, ${BAND_LABEL.few} (${stat?.n ?? 0} measured)`
        const x0 = xOfY(prev.y)
        const x1 = xOfY(row.y)
        return (
          <g key={`seg-${row.station}`} className="segment">
            {hot && <line x1={x0} y1={BASE} x2={x1} y2={BASE} stroke={BAND_COLOUR[band]} strokeWidth={active ? 14 : 10} strokeOpacity={active ? 0.7 : 0.45} strokeLinecap="round" filter="url(#glow-h)" />}
            <line x1={x0} y1={BASE} x2={x1} y2={BASE} stroke={BAND_COLOUR[band]} strokeWidth={band === 'few' ? 2 : band === 'steady' ? 3 : band === 'plus0' ? 4 : 5} strokeDasharray={band === 'few' ? '3 5' : undefined} strokeLinecap="round" />
            <line
              x1={x0 + 4}
              y1={BASE}
              x2={x1 - 4}
              y2={BASE}
              stroke="transparent"
              strokeWidth={18}
              tabIndex={stat && stat.n >= MIN_PASSES ? 0 : -1}
              aria-label={title}
              onMouseEnter={() => setHoverSegment(key)}
              onMouseLeave={() => setHoverSegment(null)}
              onFocus={() => setHoverSegment(key)}
              onBlur={() => setHoverSegment(null)}
            >
              <title>{title}</title>
            </line>
          </g>
        )
      })}

      {!empty &&
        layout.rows.map((row) => {
          const x = xOfY(row.y)
          const label = row.kind === 'not-departed' ? STATE_WORDS.notDeparted : row.kind === 'further' ? 'further out' : row.station
          const isHorizon = row.kind === 'horizon'
          const isMinor = row.minor
          return (
            <g key={`col-${row.kind}-${'station' in row ? row.station : ''}`}>
              <line x1={x} y1={BASE - (isMinor ? 3 : 6)} x2={x} y2={BASE + (isMinor ? 3 : 6)} stroke="var(--color-spine)" strokeWidth={1} />
              {isHorizon && <line x1={x} y1={yOfDelay(axisMax * 60) - 8} x2={x} y2={BASE + 6} stroke="var(--color-ink-muted)" strokeWidth={1} />}
              {(
              <text
                transform={`translate(${x + 4} ${BASE + 18}) rotate(-45)`}
                textAnchor="end"
                fontSize={isHorizon ? 13 : isMinor ? 10 : 12}
                fontWeight={isHorizon ? 500 : 400}
                fill={isHorizon ? 'var(--color-ink)' : isMinor ? 'var(--color-ink-faint)' : 'var(--color-ink-muted)'}
              >
                {label}
              </text>
              )}
            </g>
          )
        })}

      {!empty && (
        <>
          <text x={xOfY(layout.horizonY)} y={yOfDelay(axisMax * 60) - 28} textAnchor="middle" fontSize={11} fill="var(--color-ink-muted)">
            you are here
          </text>
        </>
      )}

      {marks.map((m) => {
        const id = m.ct.train.id
        const lit = isLit(id)
        const colour = delayColour(m.ct.state.kind === 'measured' ? m.ct.state.delay : null)
        if (m.trail.length < 2) return null
        return (
          <g key={`trail-${id}`} opacity={dimmed && !lit ? 0.15 : 1}>
            <polyline points={m.trail.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={colour} strokeWidth={1} strokeOpacity={0.35} strokeDasharray="2 4" />
            {m.trail.slice(0, -1).map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={2.4} fill="var(--color-ground)" stroke={colour} strokeWidth={1.2} strokeOpacity={0.5} />
            ))}
          </g>
        )
      })}

      {marks.map((m) => {
        if (!m.ghost || focusId !== m.ct.train.id) return null
        const colour = delayColour(m.ct.state.kind === 'measured' ? m.ct.state.delay : null)
        return (
          <g key={`ghost-${m.ct.train.id}`} className="ghost" opacity={0.85}>
            <line x1={m.x} y1={m.y} x2={m.ghost.x} y2={m.y} stroke={colour} strokeWidth={1} strokeDasharray="2 4" strokeOpacity={0.6} />
            <g className="ghost-mark" style={{ transform: `translate(${m.ghost.x}px, ${m.y}px)` }}>
              <circle r={4} fill="var(--color-ground)" stroke={colour} strokeWidth={1.4} strokeDasharray={m.ghost.due ? '2 2' : undefined} />
            </g>
          </g>
        )
      })}

      {marks.map((m) => {
        const id = m.ct.train.id
        const lit = isLit(id)
        const isSel = selected === id
        const segAdded = segmentTrains?.get(id)
        const clusterKey = clusterOf(id)
        const cluster = clusterKey && clusterKey !== openCluster ? clusters.get(clusterKey)! : null
        const colour = delayColour(m.ct.state.kind === 'measured' ? m.ct.state.delay : null)
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
            onMouseEnter={() => {
              onHover(id)
              if (clusterKey) setOpenCluster(clusterKey)
            }}
            onMouseLeave={() => onHover(null)}
            onFocus={() => {
              onHover(id)
              if (clusterKey) setOpenCluster(clusterKey)
            }}
            onBlur={() => onHover(null)}
          >
            <title>
              {m.ct.train.line} {m.ct.train.number} to {m.ct.train.destination}
              {m.ct.state.kind === 'measured' ? `, ${delayWords(m.ct.state.delay)} at ${m.ct.state.at}` : `, ${m.ct.state.kind === 'starts-here' ? STATE_WORDS.startsHere : STATE_WORDS.notDeparted}`}
            </title>
            <circle r={14} fill="transparent" />
            {m.hollow ? (
              <circle r={5} fill="var(--color-ground)" stroke={colour} strokeWidth={1.5} />
            ) : cluster ? (
              <>
                <circle r={8} fill={colour} fillOpacity={0.25} />
                <circle r={5.5} fill={colour} stroke="var(--color-ground)" strokeWidth={1.5} />
                <text y={3.5} textAnchor="middle" className="num" fontSize={8} fontWeight={600} fill="var(--color-ground)">
                  {cluster.length}
                </text>
              </>
            ) : (
              <circle r={isSel || lit ? 7 : 5.5} fill={colour} stroke={isSel ? 'var(--color-ink)' : 'var(--color-ground)'} strokeWidth={1.5} />
            )}
            {(m.label || lit) && (
              <text x={m.x > HW - 230 ? -9 : 9} y={labelDy.get(m.ct.train.id) ?? -8} textAnchor={m.x > HW - 230 ? 'end' : 'start'} className="num" fontSize={11} fill={m.hollow ? 'var(--color-ink-faint)' : 'var(--color-ink)'} style={{ paintOrder: 'stroke', stroke: 'var(--color-ground)', strokeWidth: 3 }}>
                {cluster
                  ? `${cluster.length} trains`
                  : segAdded !== undefined
                  ? `${m.ct.train.line} ${signed(segAdded)} here`
                  : lit && !m.hollow && m.ct.state.kind === 'measured'
                    ? `${m.ct.train.line}, ${delayWords(m.ct.state.delay)}, at ${m.ct.state.at}`
                    : m.label}
              </text>
            )}
          </a>
        )
      })}
    </svg>
  )
}
