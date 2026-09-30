import { gql } from './entur.ts'
import { corridorTrains, MIN_UPCOMING } from './derive.ts'
import { trainsFromSnapshot } from './model.ts'
import { journeysBatchQuery, STOP_CALLS, type JourneyRef } from './queries.ts'
import type { CorridorSnapshot, RawJourney, RawStopCall } from './types.ts'

export const LOOKBACK_MS = 90 * 60_000
export const RANGE_S = 150 * 60
export const EXTEND_S = 60 * 60
export const MAX_AHEAD_MS = 6 * 3_600_000
const BATCH = 25

export async function fetchStopCalls(stopPlaceId: string, start: Date, rangeS = RANGE_S): Promise<RawStopCall[]> {
  const data = await gql<{ stopPlace: { estimatedCalls: RawStopCall[] } | null }>(STOP_CALLS, {
    id: stopPlaceId,
    start: start.toISOString(),
    range: rangeS,
  })
  return data.stopPlace?.estimatedCalls ?? []
}

export async function fetchJourneys(refs: JourneyRef[]): Promise<RawJourney[]> {
  const out: RawJourney[] = []
  for (let i = 0; i < refs.length; i += BATCH) {
    const chunk = refs.slice(i, i + BATCH)
    const data = await gql<Record<string, RawJourney | null>>(journeysBatchQuery(chunk))
    for (const j of Object.values(data)) if (j) out.push(j)
  }
  return out
}

function upcoming(snap: CorridorSnapshot, lines: string[], now: number): number {
  return corridorTrains(trainsFromSnapshot(snap), snap.from, snap.to).filter(
    (c) => c.group === 'approaching' && !c.cancelled && c.arrivesFrom !== null && c.arrivesFrom >= now && (lines.length === 0 || lines.includes(c.train.line)),
  ).length
}

export async function fetchCorridor(
  from: { name: string; id: string },
  to: string,
  now: Date = new Date(),
  lines: string[] = [],
  want = MIN_UPCOMING,
): Promise<CorridorSnapshot> {
  const seen = new Set<string>()
  const refsOf = (calls: RawStopCall[], keep: (c: RawStopCall) => boolean) => {
    const out: JourneyRef[] = []
    for (const c of calls) {
      const key = `${c.serviceJourney.id}@${c.date ?? ''}`
      if (seen.has(key) || !keep(c)) continue
      seen.add(key)
      out.push({ id: c.serviceJourney.id, date: c.date ?? null })
    }
    return out
  }
  let start = new Date(now.getTime() - LOOKBACK_MS)
  const stopCalls = await fetchStopCalls(from.id, start)
  const journeys = await fetchJourneys(refsOf(stopCalls, () => true))
  const snap: CorridorSnapshot = { recordedAt: now.toISOString(), from: from.name, to, stopPlaceId: from.id, stopCalls, journeys }
  start = new Date(start.getTime() + RANGE_S * 1000)
  const onLine = (c: RawStopCall) => lines.length === 0 || lines.includes(c.serviceJourney.line.publicCode ?? '')
  while (upcoming(snap, lines, now.getTime()) < want && start.getTime() < now.getTime() + MAX_AHEAD_MS) {
    const more = await fetchStopCalls(from.id, start, EXTEND_S)
    stopCalls.push(...more)
    journeys.push(...(await fetchJourneys(refsOf(more, onLine))))
    start = new Date(start.getTime() + EXTEND_S * 1000)
  }
  return { ...snap, recordedAt: new Date().toISOString(), exhausted: start.getTime() >= now.getTime() + MAX_AHEAD_MS }
}
