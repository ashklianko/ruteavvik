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
      aimedDepartureTime actualDepartureTime aimedArrivalTime actualArrivalTime
      realtime cancellation predictionInaccurate stopPositionInPattern
      quay { id publicCode }
      destinationDisplay { frontText }
      serviceJourney { id privateCode line { id publicCode name transportMode } }
    }
  }
}`

const JOURNEY_FIELDS = `
  id privateCode line { id publicCode name transportMode }
  estimatedCalls {
    aimedDepartureTime actualDepartureTime aimedArrivalTime actualArrivalTime
    realtime cancellation stopPositionInPattern
    quay { id publicCode stopPlace { id name } }
  }`

export function journeysBatchQuery(ids: string[]): string {
  const fields = ids
    .map((id, i) => `j${i}: serviceJourney(id: ${JSON.stringify(id)}) {${JOURNEY_FIELDS}}`)
    .join('\n')
  return `{\n${fields}\n}`
}
