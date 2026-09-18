import { useMemo } from 'react'
import type { CorridorSnapshot } from '../data/types.ts'
import {
  aggregateSegments,
  arrivalWindow,
  corridorStations,
  corridorTrains,
  headlineOf,
  officiallyLateCount,
  pickUpstreamRows,
  segmentObservations,
  servesCorridor,
  hasIncident,
  stationMood,
  trainsAsOf,
  upstreamOrder,
  upstreamRowCount,
  visibleTrains,
  type CorridorTrain,
} from '../data/derive.ts'
import { axisMax as pickAxisMax } from '../data/displacement.ts'
import { trainsFromSnapshot } from '../data/model.ts'
import { familyOf } from '../diagram/palette.ts'

interface Input {
  snap: CorridorSnapshot | undefined
  snapshot: boolean
  pairFrom: string | null
  pairTo: string | null
  lines: string[]
  wallClock: number
  scrub: number | null
  at?: number | null
}

export function useCorridorModel({ snap, snapshot, pairFrom, pairTo, lines, wallClock, scrub, at = null }: Input) {
  const fromName = snapshot ? (snap?.from ?? pairFrom) : pairFrom
  const toName = snapshot ? (snap?.to ?? pairTo) : pairTo
  const coarseClock = Math.floor(wallClock / 10_000) * 10_000
  const liveNow = snapshot && snap ? (at ?? Date.parse(snap.recordedAt)) : coarseClock
  const now = scrub ?? liveNow
  const ghostNow = snapshot && snap ? liveNow : scrub ?? wallClock

  const recorded = useMemo(() => (snap ? trainsFromSnapshot(snap) : []), [snap])
  const liveTrains = useMemo(() => (snapshot && at !== null ? trainsAsOf(recorded, at) : recorded), [recorded, snapshot, at])
  const trains = useMemo(() => (scrub !== null ? trainsAsOf(liveTrains, scrub) : liveTrains), [liveTrains, scrub])
  const fullList = useMemo(() => (fromName && toName ? corridorTrains(trains, fromName, toName) : []), [trains, fromName, toName])
  const available = useMemo(() => [...new Set(fullList.map((c) => c.train.line))].sort(), [fullList])
  const filtered = useMemo(() => (lines.length ? fullList.filter((c) => lines.includes(c.train.line)) : fullList), [fullList, lines])
  const visible = useMemo(() => visibleTrains(filtered, now), [filtered, now])
  const list = visible.shown
  const corridorRows = useMemo(() => (fromName && toName ? corridorStations(filtered, fromName, toName) : []), [filtered, fromName, toName])
  const relevant = useMemo(() => filtered.map((c) => c.train), [filtered])
  const servingAll = useMemo(
    () => (fromName && toName ? liveTrains.filter((t) => servesCorridor(t, fromName, toName) && (lines.length === 0 || lines.includes(t.line))) : []),
    [liveTrains, fromName, toName, lines],
  )
  const upOrder = useMemo(() => (fromName ? upstreamOrder(relevant, fromName) : []), [relevant, fromName])
  const upRows = useMemo(
    () => (fromName ? pickUpstreamRows(upOrder, relevant, fromName, upstreamRowCount(Math.max(1, corridorRows.length - 1))) : []),
    [upOrder, relevant, fromName, corridorRows],
  )
  const observations = useMemo(() => segmentObservations(trains), [trains])
  const segments = useMemo(() => aggregateSegments(observations, now), [observations, now])
  const mareyRows = useMemo(() => [...upRows].reverse().concat(corridorRows), [upRows, corridorRows])
  const minorStations = useMemo(() => {
    const regional = relevant.filter((t) => familyOf(t.line) === 'regional' || familyOf(t.line) === 'airport')
    if (regional.length === 0) return new Set<string>()
    const served = new Set<string>()
    for (const t of regional) for (const call of t.calls) served.add(call.station)
    const out = new Set<string>()
    for (const station of [...upRows, ...corridorRows]) {
      if (station === fromName || station === toName) continue
      if (!served.has(station)) out.add(station)
    }
    return out
  }, [relevant, upRows, corridorRows, fromName, toName])
  const headline = useMemo(() => headlineOf(list), [list])
  const axisMax = useMemo(() => pickAxisMax(list.flatMap((c) => (c.state.kind === 'measured' ? [c.state.delay] : []))), [list])
  const moodTrains = useMemo(() => (lines.length ? trains.filter((t) => lines.includes(t.line)) : trains), [trains, lines])
  const incidentCount = useMemo(() => list.filter((c) => c.group === 'approaching' && hasIncident(c.train)).length, [list])
  const mood = useMemo(() => (fromName && snap ? stationMood(moodTrains, fromName, now, undefined, incidentCount) : null), [moodTrains, fromName, now, snap, incidentCount])
  const following = useMemo(() => {
    const approaching = list.filter((c) => c.group === 'approaching' && !c.cancelled)
    const next = 'train' in headline ? headline.train : approaching[0]
    return approaching.filter((c) => c !== next).slice(0, 2)
  }, [list, headline])
  const windowFor = (ct: CorridorTrain) => (toName ? arrivalWindow(ct, toName, trains, now) : null)
  const headlineWindow = 'train' in headline ? windowFor(headline.train) : null
  const lateCount = useMemo(() => officiallyLateCount(trains, now), [trains, now])
  const ariaLabel = (() => {
    if (!fromName || !toName) return 'Empty line diagram. Pick a station pair to see trains.'
    const measured = list.filter((c) => c.state.kind === 'measured')
    return `Line diagram from ${fromName} to ${toName}: ${list.length} trains, ${measured.length} measured.`
  })()

  return {
    fromName,
    toName,
    liveNow,
    now,
    ghostNow,
    trains,
    list,
    visible,
    available,
    corridorRows,
    relevant,
    servingAll,
    upOrder,
    upRows,
    observations,
    segments,
    mareyRows,
    minorStations,
    headline,
    axisMax,
    mood,
    following,
    windowFor,
    headlineWindow,
    lateCount,
    ariaLabel,
  }
}
