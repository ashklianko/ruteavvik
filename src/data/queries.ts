export const STOP_PLACES_BY_BBOX = `
query($minLat: Float!, $minLon: Float!, $maxLat: Float!, $maxLon: Float!) {
  stopPlacesByBbox(minimumLatitude: $minLat, minimumLongitude: $minLon,
                   maximumLatitude: $maxLat, maximumLongitude: $maxLon) {
    id name latitude longitude transportMode
  }
}`

export const STOP_CALLS = `
query($id: String!, $start: DateTime!, $range: Int!) {
  stopPlace(id: $id) {
    id name
    estimatedCalls(startTime: $start, timeRange: $range, numberOfDepartures: 300, whiteListedModes: [rail]) {
      date aimedDepartureTime actualDepartureTime aimedArrivalTime actualArrivalTime
      realtime cancellation predictionInaccurate stopPositionInPattern
      quay { id publicCode }
      destinationDisplay { frontText }
      serviceJourney { id privateCode line { id publicCode name transportMode } }
    }
  }
}`

const journeyFields = (date: string | null) => `
  id privateCode line { id publicCode name transportMode }
  journeyPattern { id }
  estimatedCalls${date ? `(date: ${JSON.stringify(date)})` : ''} {
    aimedDepartureTime actualDepartureTime aimedArrivalTime actualArrivalTime
    realtime cancellation stopPositionInPattern
    quay { id publicCode stopPlace { id name latitude longitude } }
  }`

export interface JourneyRef {
  id: string
  date: string | null
}

export function journeysBatchQuery(refs: JourneyRef[]): string {
  const fields = refs
    .map((r, i) => `j${i}: serviceJourney(id: ${JSON.stringify(r.id)}) {${journeyFields(r.date)}}`)
    .join('\n')
  return `{\n${fields}\n}`
}

export function patternsBatchQuery(journeyIds: string[]): string {
  const fields = journeyIds
    .map(
      (id, i) => `p${i}: serviceJourney(id: ${JSON.stringify(id)}) {
    journeyPattern { id quays { stopPlace { name latitude longitude } } pointsOnLink { points } }
  }`,
    )
    .join('\n')
  return `{\n${fields}\n}`
}
