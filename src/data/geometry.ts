import polyline from '@mapbox/polyline'
import { gql } from './entur.ts'
import { normaliseName } from './stations.ts'
import { patternsBatchQuery } from './queries.ts'
import type { RawPattern } from './types.ts'

export type LonLat = [number, number]

export interface Pattern {
  id: string
  coords: LonLat[]
  stops: Array<{ station: string; vertex: number; lonLat: LonLat | null }>
}

const CACHE_KEY = 'ruteavvik.patterns.v1'
const BATCH = 20

function haversineKm(a: LonLat, b: LonLat): number {
  const r = Math.PI / 180
  const dLat = (b[1] - a[1]) * r
  const dLon = (b[0] - a[0]) * r
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

export function nearestVertex(coords: LonLat[], target: LonLat, from = 0): number {
  let best = from
  let bestD = Infinity
  for (let i = from; i < coords.length; i++) {
    const d = haversineKm(coords[i], target)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

export function decodePattern(raw: RawPattern): Pattern {
  const coords: LonLat[] = raw.pointsOnLink ? polyline.decode(raw.pointsOnLink.points).map(([lat, lon]) => [lon, lat] as LonLat) : []
  let cursor = 0
  const stops = raw.quays.map((q) => {
    const lonLat: LonLat | null = q.stopPlace.latitude != null && q.stopPlace.longitude != null ? [q.stopPlace.longitude, q.stopPlace.latitude] : null
    let vertex = cursor
    if (lonLat && coords.length) {
      vertex = nearestVertex(coords, lonLat, cursor)
      cursor = vertex
    }
    return { station: normaliseName(q.stopPlace.name), vertex, lonLat }
  })
  return { id: raw.id, coords, stops }
}

export function subPath(p: Pattern, fromStop: number, toStop: number): LonLat[] {
  const a = p.stops[fromStop]
  const b = p.stops[toStop]
  if (!a || !b || !p.coords.length) return [a?.lonLat, b?.lonLat].filter((x): x is LonLat => x !== null && x !== undefined)
  const lo = Math.min(a.vertex, b.vertex)
  const hi = Math.max(a.vertex, b.vertex)
  const slice = p.coords.slice(lo, hi + 1)
  return a.vertex <= b.vertex ? slice : slice.reverse()
}

export function positionAlong(p: Pattern, fromStop: number, toStop: number, progress: number): LonLat | null {
  const path = subPath(p, fromStop, toStop)
  if (path.length === 0) return null
  if (path.length === 1 || progress <= 0) return path[0]
  if (progress >= 1) return path[path.length - 1]
  const lengths: number[] = []
  let total = 0
  for (let i = 1; i < path.length; i++) {
    const d = haversineKm(path[i - 1], path[i])
    lengths.push(d)
    total += d
  }
  let target = total * progress
  for (let i = 0; i < lengths.length; i++) {
    if (target <= lengths[i]) {
      const t = lengths[i] === 0 ? 0 : target / lengths[i]
      const [x0, y0] = path[i]
      const [x1, y1] = path[i + 1]
      return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]
    }
    target -= lengths[i]
  }
  return path[path.length - 1]
}

export function stopIndex(p: Pattern, station: string, hint?: number): number {
  if (hint !== undefined && p.stops[hint]?.station === station) return hint
  return p.stops.findIndex((s) => s.station === station)
}

const MAX_STORED = 40
const decoded = new Map<string, Pattern>()
let stored: Record<string, RawPattern> | null = null

function readCache(): Record<string, RawPattern> {
  if (stored) return stored
  try {
    stored = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, RawPattern>
  } catch {
    stored = {}
  }
  return stored
}

function writeCache(cache: Record<string, RawPattern>, recent: string[]) {
  const keep = new Set(recent.slice(-MAX_STORED))
  const evictable = Object.keys(cache).filter((id) => !keep.has(id))
  for (const id of evictable.slice(0, Math.max(0, Object.keys(cache).length - MAX_STORED))) delete cache[id]
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    /* quota or unavailable; the in-memory copy still serves this session */
  }
}

export async function fetchPatterns(wanted: Array<{ patternId: string; journeyId: string }>): Promise<Map<string, Pattern>> {
  const cache = readCache()
  const missing = wanted.filter((w) => !cache[w.patternId])
  const seen = new Set<string>()
  const toFetch = missing.filter((w) => (seen.has(w.patternId) ? false : (seen.add(w.patternId), true)))
  for (let i = 0; i < toFetch.length; i += BATCH) {
    const chunk = toFetch.slice(i, i + BATCH)
    const data = await gql<Record<string, { journeyPattern: RawPattern | null } | null>>(patternsBatchQuery(chunk.map((w) => w.journeyId)))
    for (const v of Object.values(data)) {
      const jp = v?.journeyPattern
      if (jp) cache[jp.id] = jp
    }
  }
  if (toFetch.length) writeCache(cache, wanted.map((w) => w.patternId))
  const out = new Map<string, Pattern>()
  for (const w of wanted) {
    if (out.has(w.patternId)) continue
    let p = decoded.get(w.patternId)
    if (!p) {
      const raw = cache[w.patternId]
      if (!raw) continue
      p = decodePattern(raw)
      decoded.set(w.patternId, p)
    }
    out.set(w.patternId, p)
  }
  return out
}
