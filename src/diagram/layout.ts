import type { CorridorTrain } from '../data/derive.ts'
import { indexOf } from '../data/derive.ts'
import { displacement, type AxisMax } from '../data/displacement.ts'
import type { Train } from '../data/model.ts'

export interface CrossGeom {
  W: number
  SPINE_X: number
  HALF: number
}
export const NORMAL_GEOM: CrossGeom = { W: 640, SPINE_X: 150, HALF: 460 }
export const COMPACT_GEOM: CrossGeom = { W: 400, SPINE_X: 118, HALF: 266 }
export const ROW_H = 44
export const ROW_MINOR = 24
export const PAD = 26

export type Row =
  | { kind: 'not-departed'; y: number; minor: false }
  | { kind: 'further'; y: number; minor: false }
  | { kind: 'upstream'; y: number; station: string; minor: boolean }
  | { kind: 'horizon'; y: number; station: string; minor: false }
  | { kind: 'corridor'; y: number; station: string; minor: boolean }

export interface Layout {
  rows: Row[]
  height: number
  horizonY: number
  yNotDeparted: number | null
  yFurther: number | null
  shownUpstream: Set<string>
  beyondRows: (station: string) => boolean
  yOfStation: (station: string) => number | undefined
  yOfUpstream: (station: string) => number
}

export interface LayoutInput {
  corridor: string[]
  upstreamOrder: string[]
  upstreamRows: string[]
  from: string
  list: CorridorTrain[]
  minor: Set<string>
  rowH?: number
  rowMinor?: number
}

export function buildLayout({ corridor, upstreamOrder, upstreamRows, from, list, minor, rowH = ROW_H, rowMinor = ROW_MINOR }: LayoutInput): Layout {
  const shown = new Set(upstreamRows)
  const lastShownIdx = upstreamRows.length ? upstreamOrder.indexOf(upstreamRows[upstreamRows.length - 1]) : -1
  const anyNotDeparted = list.some((c) => c.state.kind === 'not-departed')
  const farStations = [
    ...new Set(
      list
        .filter((c) => c.state.kind === 'measured' && c.group === 'approaching')
        .map((c) => (c.state.kind === 'measured' ? c.state.at : ''))
        .filter((st) => {
          const idx = upstreamOrder.indexOf(st)
          return idx > lastShownIdx || idx < 0
        }),
    ),
  ].sort((a, b) => upstreamOrder.indexOf(a) - upstreamOrder.indexOf(b))
  const anyFurther = farStations.length > 0
  const furtherSpan = Math.min(3, Math.max(1, farStations.length))

  const rows: Row[] = []
  let y = PAD
  const baseHeight = (minorRow: boolean) => (minorRow ? rowMinor : rowH)
  const upstreamWidth = upstreamRows.reduce((sum, st) => sum + baseHeight(minor.has(st)), 0)
  const corridorWidth = corridor.slice(1).reduce((sum, st) => sum + baseHeight(minor.has(st)), 0)
  const stretch = corridorWidth > 0 ? Math.min(2, Math.max(1, upstreamWidth / corridorWidth)) : 1
  const heightOf = (r: Row) =>
    r.kind === 'corridor' ? baseHeight(r.minor) * stretch : r.kind === 'horizon' ? (rowH * (1 + stretch)) / 2 : r.kind === 'further' ? rowH * furtherSpan : baseHeight(r.minor)
  const push = (r: Row) => {
    const prev = rows[rows.length - 1]
    if (prev) y += (heightOf(prev) + heightOf(r)) / 2
    r.y = y
    rows.push(r)
  }
  let yNotDeparted: number | null = null
  if (anyNotDeparted) {
    push({ kind: 'not-departed', y, minor: false })
    yNotDeparted = y
  }
  let yFurther: number | null = null
  if (anyFurther) {
    push({ kind: 'further', y, minor: false })
    yFurther = y
  }
  const upstreamY = new Map<string, number>()
  for (const station of [...upstreamRows].reverse()) {
    push({ kind: 'upstream', y, station, minor: minor.has(station) })
    upstreamY.set(station, y)
  }
  push({ kind: 'horizon', y, station: from, minor: false })
  const horizonY = y
  const stationY = new Map<string, number>([[from, horizonY]])
  for (const station of corridor.slice(1)) {
    push({ kind: 'corridor', y, station, minor: minor.has(station) })
    stationY.set(station, y)
  }

  const topY = yFurther ?? rows[0]?.y ?? PAD
  const yOfFar = (station: string): number => {
    if (yFurther === null || farStations.length <= 1) return topY
    const rank = farStations.indexOf(station)
    if (rank < 0) return topY
    const span = rowH * furtherSpan - 16
    return yFurther + span / 2 - ((rank + 0.5) / farStations.length) * span
  }
  const yOfUpstream = (station: string): number => {
    const direct = upstreamY.get(station)
    if (direct !== undefined) return direct
    const idx = upstreamOrder.indexOf(station)
    if (idx < 0) return farStations.includes(station) ? yOfFar(station) : horizonY
    if (idx > lastShownIdx) return yOfFar(station)
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
    height: y + PAD + 8,
    horizonY,
    yNotDeparted,
    yFurther,
    shownUpstream: shown,
    beyondRows: (station) => {
      if (shown.has(station)) return false
      const idx = upstreamOrder.indexOf(station)
      return idx < 0 || idx > lastShownIdx
    },
    yOfStation: (station) => stationY.get(station),
    yOfUpstream,
  }
}

export function xOf(delaySeconds: number, max: AxisMax = 15, g: CrossGeom = NORMAL_GEOM): number {
  return g.SPINE_X + displacement(delaySeconds, g.HALF, max)
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

export function isFar(layout: Layout, train: Train, callIndex: number, from: string): boolean {
  const fromIndex = indexOf(train, from)
  if (callIndex >= fromIndex) return false
  return layout.beyondRows(train.calls[callIndex].station)
}

export function ghostProgress(train: Train, index: number, now: number): { progress: number; due: boolean } | null {
  const here = train.calls[index]
  const next = train.calls[index + 1]
  if (!next || here.actualDeparture === null || here.aimedDeparture === null) return null
  const nextAimed = next.aimedArrival ?? next.aimedDeparture
  if (nextAimed === null) return null
  const run = nextAimed - here.aimedDeparture
  if (run <= 0) return null
  const progress = Math.min(1, Math.max(0, (now - here.actualDeparture) / run))
  if (progress < 0.03) return null
  return { progress, due: progress >= 1 }
}
