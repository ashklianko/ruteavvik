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
}

export interface Train {
  id: string
  number: string
  line: string
  destination: string
  calls: Call[]
}

const ms = (iso: string | null): number | null => (iso ? Date.parse(iso) : null)

export function toTrain(journey: RawJourney, destination: string): Train {
  return {
    id: journey.id,
    number: journey.privateCode ?? '',
    line: journey.line.publicCode ?? '',
    destination,
    calls: journey.estimatedCalls
      .filter((c) => c.quay?.stopPlace)
      .map((c) => ({
        station: normaliseName(c.quay!.stopPlace.name),
        position: c.stopPositionInPattern,
        aimedDeparture: ms(c.aimedDepartureTime),
        actualDeparture: ms(c.actualDepartureTime),
        aimedArrival: ms(c.aimedArrivalTime),
        actualArrival: ms(c.actualArrivalTime),
        cancelled: c.cancellation,
      }))
      .sort((a, b) => a.position - b.position),
  }
}

export function trainsFromSnapshot(snap: CorridorSnapshot): Train[] {
  const destinations = new Map<string, string>()
  for (const c of snap.stopCalls as RawStopCall[]) {
    const text = c.destinationDisplay?.frontText
    if (text && !destinations.has(c.serviceJourney.id)) destinations.set(c.serviceJourney.id, text)
  }
  return snap.journeys.map((j) => {
    const fallback = j.estimatedCalls.at(-1)?.quay?.stopPlace.name ?? ''
    return toTrain(j, destinations.get(j.id) ?? normaliseName(fallback))
  })
}
