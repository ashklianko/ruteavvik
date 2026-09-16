import { gql } from './entur.ts'
import { journeysBatchQuery, STOP_CALLS } from './queries.ts'
import type { CorridorSnapshot, RawJourney, RawStopCall } from './types.ts'

export const LOOKBACK_MS = 60 * 60_000
export const RANGE_S = 150 * 60
const BATCH = 25

export async function fetchStopCalls(stopPlaceId: string, now: Date): Promise<RawStopCall[]> {
  const start = new Date(now.getTime() - LOOKBACK_MS).toISOString()
  const data = await gql<{ stopPlace: { estimatedCalls: RawStopCall[] } | null }>(STOP_CALLS, {
    id: stopPlaceId,
    start,
    range: RANGE_S,
  })
  return data.stopPlace?.estimatedCalls ?? []
}

export async function fetchJourneys(ids: string[]): Promise<RawJourney[]> {
  const out: RawJourney[] = []
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const data = await gql<Record<string, RawJourney | null>>(journeysBatchQuery(chunk))
    for (const j of Object.values(data)) if (j) out.push(j)
  }
  return out
}

export async function fetchCorridor(
  from: { name: string; id: string },
  to: string,
  now: Date = new Date(),
): Promise<CorridorSnapshot> {
  const stopCalls = await fetchStopCalls(from.id, now)
  const ids = [...new Set(stopCalls.map((c) => c.serviceJourney.id))]
  const journeys = await fetchJourneys(ids)
  return { recordedAt: now.toISOString(), from: from.name, to, stopPlaceId: from.id, stopCalls, journeys }
}
