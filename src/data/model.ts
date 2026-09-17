import { normaliseName } from './stations.ts'
import type { CorridorSnapshot, RawJourney, RawStopCall } from './types.ts'

export interface Call {
  station: string
  position: number
  aimedDeparture: number | null
  actualDeparture: number | null
  aimedArrival: number | null
  actualArrival: number | null
  cancelled: boolean
  lat: number | null
  lon: number | null
  platform: string | null
}

export interface Train {
  id: string
  number: string
  line: string
  destination: string
  patternId: string | null
  calls: Call[]
}

const ms = (iso: string | null): number | null => (iso ? Date.parse(iso) : null)

export function toTrain(journey: RawJourney, destination: string): Train {
  return {
    id: journey.id,
    number: journey.privateCode ?? '',
    line: journey.line.publicCode ?? '',
    destination,
    patternId: journey.journeyPattern?.id ?? null,
    calls: journey.estimatedCalls
      .filter((c) => c.quay?.stopPlace)
      .sort((a, b) => a.stopPositionInPattern - b.stopPositionInPattern)
      .map((c, i) => ({
        station: normaliseName(c.quay!.stopPlace.name),
        position: c.stopPositionInPattern,
        aimedDeparture: ms(c.aimedDepartureTime),
        actualDeparture: ms(c.actualDepartureTime),
        aimedArrival: ms(c.aimedArrivalTime),
        actualArrival: i === 0 ? null : ms(c.actualArrivalTime),
        cancelled: c.cancellation,
        lat: c.quay!.stopPlace.latitude ?? null,
        lon: c.quay!.stopPlace.longitude ?? null,
        platform: c.quay!.publicCode ?? null,
      })),
  }
}

export const EXCLUDED_LINES = /^F\d/i

export const FUTURE_SKEW_MS = 30_000

function dropFutureActuals(train: Train, recordedAt: number): Train {
  const limit = recordedAt + FUTURE_SKEW_MS
  return {
    ...train,
    calls: train.calls.map((c) => ({
      ...c,
      actualDeparture: c.actualDeparture !== null && c.actualDeparture > limit ? null : c.actualDeparture,
      actualArrival: c.actualArrival !== null && c.actualArrival > limit ? null : c.actualArrival,
    })),
  }
}

export function trainsFromSnapshot(snap: CorridorSnapshot): Train[] {
  const recordedAt = Date.parse(snap.recordedAt)
  const destinations = new Map<string, string>()
  for (const c of snap.stopCalls as RawStopCall[]) {
    const text = c.destinationDisplay?.frontText
    if (text && !destinations.has(c.serviceJourney.id)) destinations.set(c.serviceJourney.id, text)
  }
  return snap.journeys
    .filter((j) => !EXCLUDED_LINES.test(j.line.publicCode ?? ''))
    .map((j) => {
      const fallback = j.estimatedCalls.at(-1)?.quay?.stopPlace.name ?? ''
      return dropFutureActuals(toTrain(j, destinations.get(j.id) ?? normaliseName(fallback)), recordedAt)
    })
}
