import type { CorridorTrain } from '../data/derive.ts'
import { indexOf } from '../data/derive.ts'
import { displacement } from '../data/displacement.ts'
import type { Train } from '../data/model.ts'

export const W = 640
export const SPINE_X = 214
export const HALF = 372
export const ROW_H = 44
export const PAD = 26

export type Row =
  | { kind: 'not-departed'; y: number }
  | { kind: 'further'; y: number }
  | { kind: 'upstream'; y: number; station: string }
  | { kind: 'horizon'; y: number; station: string }
  | { kind: 'corridor'; y: number; station: string }

export interface Layout {
  rows: Row[]
  height: number
  horizonY: number
  yNotDeparted: number | null
  yFurther: number | null
  shownUpstream: Set<string>
  yOfStation: (station: string) => number | undefined
  yOfUpstream: (station: string) => number
}

export interface LayoutInput {
  corridor: string[]
  upstreamOrder: string[]
  upstreamRows: string[]
  from: string
  list: CorridorTrain[]
}

export function buildLayout({ corridor, upstreamOrder, upstreamRows, from, list }: LayoutInput): Layout {
  const shown = new Set(upstreamRows)
  const lastShownIdx = upstreamRows.length ? upstreamOrder.indexOf(upstreamRows[upstreamRows.length - 1]) : -1
  const anyNotDeparted = list.some((c) => c.state.kind === 'not-departed')
  const anyFurther = list.some((c) => {
    if (c.state.kind !== 'measured' || c.group !== 'approaching') return false
    const idx = upstreamOrder.indexOf(c.state.at)
    return idx > lastShownIdx || (idx < 0 && c.state.stopsAway > 0)
  })

  const rows: Row[] = []
  let y = PAD
  const push = (r: Row) => {
    rows.push(r)
    y += ROW_H
  }
  let yNotDeparted: number | null = null
  if (anyNotDeparted) {
    yNotDeparted = y
    push({ kind: 'not-departed', y })
  }
  let yFurther: number | null = null
  if (anyFurther) {
    yFurther = y
    push({ kind: 'further', y })
  }
  const upstreamY = new Map<string, number>()
  for (const station of [...upstreamRows].reverse()) {
    upstreamY.set(station, y)
    push({ kind: 'upstream', y, station })
  }
  const horizonY = y
  push({ kind: 'horizon', y, station: from })
  const stationY = new Map<string, number>([[from, horizonY]])
  for (const station of corridor.slice(1)) {
    stationY.set(station, y)
    push({ kind: 'corridor', y, station })
  }

  const topY = yFurther ?? rows[0]?.y ?? PAD
  const yOfUpstream = (station: string): number => {
    const direct = upstreamY.get(station)
    if (direct !== undefined) return direct
    const idx = upstreamOrder.indexOf(station)
    if (idx < 0) return horizonY
    if (idx > lastShownIdx) return topY
    let nearIdx = -1
    let farIdx = Infinity
    for (const s of upstreamRows) {
      const i = upstreamOrder.indexOf(s)
      if (i < idx && i > nearIdx) nearIdx = i
      if (i > idx && i < farIdx) farIdx = i
    }
    const nearY = nearIdx < 0 ? horizonY : upstreamY.get(upstreamOrder[nearIdx])!
    const farY = upstreamY.get(upstreamOrder[farIdx])!
    return nearY + ((farY - nearY) * (idx - nearIdx)) / (farIdx - nearIdx)
  }

  return {
    rows,
    height: y - ROW_H + PAD + 8,
    horizonY,
    yNotDeparted,
    yFurther,
    shownUpstream: shown,
    yOfStation: (station) => stationY.get(station),
    yOfUpstream,
  }
}

export function xOf(delaySeconds: number): number {
  return SPINE_X + displacement(delaySeconds, HALF)
}

export function yOfCall(layout: Layout, train: Train, callIndex: number, from: string): number {
  const fromIndex = indexOf(train, from)
  if (callIndex < fromIndex) return layout.yOfUpstream(train.calls[callIndex].station)
  for (let i = callIndex; i >= fromIndex; i--) {
    const y = layout.yOfStation(train.calls[i].station)
    if (y !== undefined) return y
  }
  return layout.horizonY
}
