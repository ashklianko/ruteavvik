export interface RawStopPlace {
  id: string
  name: string
  latitude: number
  longitude: number
  transportMode: string[] | null
}

export interface RawLine {
  id: string
  publicCode: string | null
  name: string | null
  transportMode: string | null
}

export interface RawStopCall {
  date?: string | null
  aimedDepartureTime: string | null
  actualDepartureTime: string | null
  aimedArrivalTime: string | null
  actualArrivalTime: string | null
  realtime: boolean
  cancellation: boolean
  predictionInaccurate: boolean
  stopPositionInPattern: number
  quay: { id: string; publicCode: string | null } | null
  destinationDisplay: { frontText: string | null } | null
  serviceJourney: { id: string; privateCode: string | null; line: RawLine }
}

export interface RawJourneyCall {
  aimedDepartureTime: string | null
  actualDepartureTime: string | null
  aimedArrivalTime: string | null
  actualArrivalTime: string | null
  realtime: boolean
  cancellation: boolean
  stopPositionInPattern: number
  quay: {
    id: string
    publicCode: string | null
    stopPlace: { id: string; name: string; latitude?: number | null; longitude?: number | null }
  } | null
}

export interface RawJourney {
  id: string
  privateCode: string | null
  line: RawLine
  journeyPattern?: { id: string } | null
  estimatedCalls: RawJourneyCall[]
}

export interface RawPattern {
  id: string
  quays: Array<{ stopPlace: { name: string; latitude: number | null; longitude: number | null } }>
  pointsOnLink: { points: string } | null
}

export interface CorridorSnapshot {
  recordedAt: string
  from: string
  to: string
  stopPlaceId: string
  stopCalls: RawStopCall[]
  journeys: RawJourney[]
}
