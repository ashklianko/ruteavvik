import { gql } from './entur.ts'
import { STOP_PLACES_BY_BBOX } from './queries.ts'
import type { RawStopPlace } from './types.ts'

export const SCOPE_BBOX = { minLat: 59.55, minLon: 10.3, maxLat: 60.45, maxLon: 11.6 }

export interface Station {
  name: string
  id: string
  lat: number
  lon: number
}

export function normaliseName(raw: string): string {
  return raw.trim().replace(/\s+stasjon$/i, '')
}

export function toStations(raw: RawStopPlace[]): Station[] {
  const byName = new Map<string, Station>()
  for (const s of raw) {
    if (!(s.transportMode ?? []).some((m) => m.toLowerCase() === 'rail')) continue
    const name = normaliseName(s.name)
    if (!byName.has(name)) byName.set(name, { name, id: s.id, lat: s.latitude, lon: s.longitude })
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'nb'))
}

export async function fetchStations(): Promise<Station[]> {
  const data = await gql<{ stopPlacesByBbox: RawStopPlace[] }>(STOP_PLACES_BY_BBOX, SCOPE_BBOX)
  return toStations(data.stopPlacesByBbox)
}
