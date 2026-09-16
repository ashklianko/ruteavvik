import { mean } from 'd3-array'
import type { Call, Train } from './model.ts'

export const WINDOW_MS = 60 * 60_000
export const MIN_PASSES = 4
export const TRAIL_LENGTH = 4
export const VERDICT_THRESHOLD_S = 45
export const CALM_S = 60
export const OFFICIAL_LATE_S = 240
export const ARRIVAL_SAMPLE_MAX = 5
export const ARRIVAL_SAMPLE_MIN = 3
export const IMPLAUSIBLE_EARLY_S = -600

const plausible = (s: number): number | null => (s < IMPLAUSIBLE_EARLY_S ? null : s)

export function delayAt(call: Call): number | null {
  if (call.actualDeparture !== null && call.aimedDeparture !== null)
    return plausible(Math.round((call.actualDeparture - call.aimedDeparture) / 1000))
  if (call.actualArrival !== null && call.aimedArrival !== null)
    return plausible(Math.round((call.actualArrival - call.aimedArrival) / 1000))
  return null
}

export function measuredAt(call: Call): number | null {
  return call.actualDeparture ?? call.actualArrival
}

export function indexOf(train: Train, station: string): number {
  return train.calls.findIndex((c) => c.station === station)
}

export function servesCorridor(train: Train, from: string, to: string): boolean {
  const a = indexOf(train, from)
  const b = indexOf(train, to)
  return a >= 0 && b > a
}

export function lastMeasuredIndex(train: Train): number {
  for (let i = train.calls.length - 1; i >= 0; i--) if (delayAt(train.calls[i]) !== null) return i
  return -1
}

export type Verdict = 'growing' | 'holding' | 'shrinking' | 'one reading' | 'two readings'

export function trailOf(train: Train, upTo = lastMeasuredIndex(train)): number[] {
  const out: number[] = []
  for (let i = upTo; i >= 0 && out.length < TRAIL_LENGTH; i--) {
    const d = delayAt(train.calls[i])
    if (d !== null) out.unshift(d)
  }
  return out
}

export function verdictOf(trail: number[]): Verdict {
  if (trail.length < 2) return 'one reading'
  if (trail.length < 3) return 'two readings'
  const change = trail[trail.length - 1] - trail[0]
  if (change > VERDICT_THRESHOLD_S) return 'growing'
  if (change < -VERDICT_THRESHOLD_S) return 'shrinking'
  return 'holding'
}

export type TrainState =
  | {
      kind: 'measured'
      delay: number
      at: string
      index: number
      stopsAway: number
      standing: boolean
      trail: number[]
      verdict: Verdict
    }
  | { kind: 'starts-here' }
  | { kind: 'not-departed' }

export function stateOf(train: Train, from: string): TrainState {
  const fromIndex = indexOf(train, from)
  const current = lastMeasuredIndex(train)
  if (current < 0) return fromIndex === 0 ? { kind: 'starts-here' } : { kind: 'not-departed' }
  const call = train.calls[current]
  const trail = trailOf(train, current)
  return {
    kind: 'measured',
    delay: delayAt(call)!,
    at: call.station,
    index: current,
    stopsAway: fromIndex - current,
    standing: call.actualDeparture === null && call.actualArrival !== null,
    trail,
    verdict: verdictOf(trail),
  }
}

export type Group = 'approaching' | 'ahead' | 'gone'

export function groupOf(train: Train, state: TrainState, from: string, to: string): Group {
  if (state.kind !== 'measured') return 'approaching'
  const toIndex = indexOf(train, to)
  if (state.index >= toIndex) return 'gone'
  const fromIndex = indexOf(train, from)
  if (state.index < fromIndex) return 'approaching'
  const atFrom = train.calls[fromIndex]
  if (state.index === fromIndex && atFrom.actualDeparture === null) return 'approaching'
  return 'ahead'
}

export function measuredArrivalAt(train: Train, station: string, state: TrainState): number | null {
  const call = train.calls[indexOf(train, station)]
  const aimed = call?.aimedArrival ?? call?.aimedDeparture ?? null
  if (aimed === null) return null
  return state.kind === 'measured' ? aimed + state.delay * 1000 : aimed
}

export interface CorridorTrain {
  train: Train
  state: TrainState
  group: Group
  arrivesFrom: number | null
  cancelled: boolean
}

export function corridorTrains(trains: Train[], from: string, to: string): CorridorTrain[] {
  return trains
    .filter((t) => servesCorridor(t, from, to))
    .map((train) => {
      const state = stateOf(train, from)
      const fromCall = train.calls[indexOf(train, from)]
      return {
        train,
        state,
        group: groupOf(train, state, from, to),
        arrivesFrom: measuredArrivalAt(train, from, state),
        cancelled: fromCall.cancelled,
      }
    })
    .filter((c) => c.group !== 'gone')
    .sort((a, b) => (a.arrivesFrom ?? Infinity) - (b.arrivesFrom ?? Infinity))
}

export interface SegmentObservation {
  a: string
  b: string
  added: number
  at: number
  trainId: string
}

export function segmentObservations(trains: Train[]): SegmentObservation[] {
  const out: SegmentObservation[] = []
  for (const t of trains) {
    for (let i = 0; i + 1 < t.calls.length; i++) {
      const x = t.calls[i]
      const y = t.calls[i + 1]
      if (x.cancelled || y.cancelled) continue
      if (x.actualDeparture === null || x.aimedDeparture === null) continue
      const dx = plausible(Math.round((x.actualDeparture - x.aimedDeparture) / 1000))
      const dy = delayAt(y)
      if (dx === null) continue
      const at = measuredAt(y)
      if (dy === null || at === null) continue
      out.push({ a: x.station, b: y.station, added: dy - dx, at, trainId: t.id })
    }
  }
  return out
}

export type Band = 'few' | 'catching-up' | 'steady' | 'plus1' | 'plus2' | 'worse'

export interface SegmentStat {
  a: string
  b: string
  n: number
  added: number
  band: Band
}

export function bandOf(added: number, n: number): Band {
  if (n < MIN_PASSES) return 'few'
  if (added < -20) return 'catching-up'
  if (added <= 30) return 'steady'
  if (added <= 90) return 'plus1'
  if (added <= 150) return 'plus2'
  return 'worse'
}

export const segmentKey = (a: string, b: string) => `${a}→${b}`

export function aggregateSegments(obs: SegmentObservation[], now: number): Map<string, SegmentStat> {
  const since = now - WINDOW_MS
  const groups = new Map<string, SegmentObservation[]>()
  for (const o of obs) {
    if (o.at < since || o.at > now) continue
    const k = segmentKey(o.a, o.b)
    const g = groups.get(k)
    if (g) g.push(o)
    else groups.set(k, [o])
  }
  const out = new Map<string, SegmentStat>()
  for (const [k, g] of groups) {
    const added = Math.round(mean(g, (o) => o.added) ?? 0)
    out.set(k, { a: g[0].a, b: g[0].b, n: g.length, added, band: bandOf(added, g.length) })
  }
  return out
}

export function corridorStations(trains: CorridorTrain[], from: string, to: string): string[] {
  let best: string[] = [from, to]
  for (const { train } of trains) {
    const a = indexOf(train, from)
    const b = indexOf(train, to)
    if (a < 0 || b <= a) continue
    const slice = train.calls.slice(a, b + 1).map((c) => c.station)
    if (slice.length > best.length) best = slice
  }
  return best
}

export interface ArrivalWindow {
  scheduled: number
  lower: number
  upper: number | null
  sample: number
}

export function arrivalWindow(
  ct: CorridorTrain,
  to: string,
  trains: Train[],
  now: number,
): ArrivalWindow | null {
  if (ct.state.kind !== 'measured') return null
  const toCall = ct.train.calls[indexOf(ct.train, to)]
  const scheduled = toCall?.aimedArrival ?? toCall?.aimedDeparture ?? null
  if (scheduled === null) return null
  const lower = scheduled + ct.state.delay * 1000
  const here = ct.state.at
  const since = now - WINDOW_MS
  const added: Array<{ at: number; added: number }> = []
  for (const t of trains) {
    if (t.id === ct.train.id) continue
    const i = indexOf(t, here)
    const j = indexOf(t, to)
    if (i < 0 || j <= i) continue
    const di = delayAt(t.calls[i])
    const dj = delayAt(t.calls[j])
    const at = measuredAt(t.calls[j])
    if (di === null || dj === null || at === null || at < since || at > now) continue
    added.push({ at, added: dj - di })
  }
  added.sort((a, b) => b.at - a.at)
  const sample = added.slice(0, ARRIVAL_SAMPLE_MAX)
  if (sample.length < ARRIVAL_SAMPLE_MIN) return { scheduled, lower, upper: null, sample: sample.length }
  const worst = Math.max(0, ...sample.map((s) => s.added))
  return { scheduled, lower, upper: lower + worst * 1000, sample: sample.length }
}

export type Headline =
  | { kind: 'none' }
  | { kind: 'calm'; count: number }
  | { kind: 'on-time'; train: CorridorTrain; stopsAway: number }
  | { kind: 'late'; train: CorridorTrain; delay: number; verdict: Verdict; at: string }
  | { kind: 'starts-here'; train: CorridorTrain }
  | { kind: 'not-departed'; train: CorridorTrain }

export function headlineOf(list: CorridorTrain[]): Headline {
  const approaching = list.filter((c) => c.group === 'approaching' && !c.cancelled)
  const next = approaching[0]
  if (!next) return { kind: 'none' }
  const measured = approaching.filter((c) => c.state.kind === 'measured')
  if (
    measured.length >= 2 &&
    measured.every((c) => c.state.kind === 'measured' && Math.abs(c.state.delay) <= CALM_S)
  )
    return { kind: 'calm', count: measured.length }
  const s = next.state
  if (s.kind === 'starts-here') return { kind: 'starts-here', train: next }
  if (s.kind === 'not-departed') return { kind: 'not-departed', train: next }
  if (Math.abs(s.delay) <= CALM_S) return { kind: 'on-time', train: next, stopsAway: s.stopsAway }
  return { kind: 'late', train: next, delay: s.delay, verdict: s.verdict, at: s.at }
}

export function officiallyLateCount(trains: Train[], now: number): number {
  const since = now - WINDOW_MS
  let n = 0
  for (const t of trains) {
    const hit = t.calls.some((c) => {
      const at = measuredAt(c)
      const d = delayAt(c)
      return at !== null && at >= since && at <= now && d !== null && d > OFFICIAL_LATE_S
    })
    if (hit) n++
  }
  return n
}

export const UPSTREAM_ROWS = 8

export function minutesToFrom(trains: Train[], from: string): Map<string, number> {
  const samples = new Map<string, number[]>()
  for (const t of trains) {
    const i = indexOf(t, from)
    if (i <= 0) continue
    const arriveFrom = t.calls[i].aimedArrival ?? t.calls[i].aimedDeparture
    if (arriveFrom === null) continue
    for (const c of t.calls.slice(0, i)) {
      const dep = c.aimedDeparture ?? c.aimedArrival
      if (dep === null) continue
      const minutes = (arriveFrom - dep) / 60_000
      if (minutes <= 0) continue
      const list = samples.get(c.station)
      if (list) list.push(minutes)
      else samples.set(c.station, [minutes])
    }
  }
  const out = new Map<string, number>()
  for (const [station, list] of samples) {
    list.sort((a, b) => a - b)
    out.set(station, list[Math.floor(list.length / 2)])
  }
  return out
}

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const r = Math.PI / 180
  const dLat = (lat2 - lat1) * r
  const dLon = (lon2 - lon1) * r
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

export function kmFromStation(trains: Train[], from: string): Map<string, number> | null {
  let origin: { lat: number; lon: number } | null = null
  for (const t of trains) {
    const c = t.calls.find((x) => x.station === from)
    if (c && c.lat !== null && c.lon !== null) {
      origin = { lat: c.lat, lon: c.lon }
      break
    }
  }
  if (!origin) return null
  const out = new Map<string, number>()
  for (const t of trains) {
    const i = indexOf(t, from)
    if (i <= 0) continue
    for (const c of t.calls.slice(0, i)) {
      if (out.has(c.station) || c.lat === null || c.lon === null) continue
      out.set(c.station, haversineKm(origin.lat, origin.lon, c.lat, c.lon))
    }
  }
  return out
}

export function upstreamOrder(trains: Train[], from: string): string[] {
  const minutes = minutesToFrom(trains, from)
  const km = kmFromStation(trains, from)
  const measure = (station: string): number => {
    const d = km?.get(station)
    if (d !== undefined) return d
    return 1000 + (minutes.get(station) ?? 0)
  }
  return [...minutes.keys()].sort((a, b) => measure(a) - measure(b) || a.localeCompare(b, 'nb'))
}

export function pickUpstreamRows(order: string[], trains: Train[], from: string, n = UPSTREAM_ROWS): string[] {
  const score = new Map<string, number>()
  for (const t of trains) {
    const i = indexOf(t, from)
    for (const c of t.calls.slice(0, Math.max(0, i))) score.set(c.station, (score.get(c.station) ?? 0) + 1)
  }
  return order
    .map((station, idx) => ({ station, idx, score: score.get(station) ?? 0 }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .slice(0, n)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.station)
}

export const TIMETABLE_HORIZON_MS = 30 * 60_000

export interface Visible {
  shown: CorridorTrain[]
  laterCount: number
  laterUntil: number | null
}

export function visibleTrains(list: CorridorTrain[], now: number, horizon = TIMETABLE_HORIZON_MS): Visible {
  const shown: CorridorTrain[] = []
  let laterCount = 0
  let laterUntil: number | null = null
  for (const c of list) {
    if (c.state.kind === 'measured' || c.arrivesFrom === null || c.arrivesFrom <= now + horizon) {
      shown.push(c)
      continue
    }
    laterCount++
    laterUntil = Math.max(laterUntil ?? 0, c.arrivesFrom)
  }
  return { shown, laterCount, laterUntil }
}

export function trainsAsOf(trains: Train[], at: number): Train[] {
  return trains.map((t) => ({
    ...t,
    calls: t.calls.map((c) => ({
      ...c,
      actualDeparture: c.actualDeparture !== null && c.actualDeparture > at ? null : c.actualDeparture,
      actualArrival: c.actualArrival !== null && c.actualArrival > at ? null : c.actualArrival,
    })),
  }))
}
