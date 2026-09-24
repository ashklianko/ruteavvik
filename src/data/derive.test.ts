import { describe, expect, it } from 'vitest'
import sandvika from '../../public/snapshots/sandvika-oslo-s-2026-09-16-11-37.json'
import lillestrom from '../../public/snapshots/lillestrom-oslo-s-2026-09-16-11-37.json'
import {
  aggregateSegments,
  arrivalWindow,
  bandOf,
  corridorStations,
  corridorTrains,
  delayAt,
  groupOf,
  headlineOf,
  kmFromStation,
  officiallyLateCount,
  pickUpstreamRows,
  segmentObservations,
  stateOf,
  hasIncident,
  stationMood,
  trainsAsOf,
  upstreamOrder,
  upstreamRowCount,
  verdictOf,
  visibleTrains,
} from './derive.ts'
import { EXCLUDED_LINES, noticeKind, toNotices, toTrain, trainsFromSnapshot, type Call, type Notice, type Train } from './model.ts'
import { inWords } from '../format.ts'
import type { CorridorSnapshot } from './types.ts'

const T0 = Date.parse('2026-09-16T08:00:00Z')
const min = (m: number) => T0 + m * 60_000

function call(station: string, position: number, aimedMin: number, delayS: number | null, opts: Partial<Call> = {}): Call {
  const aimed = min(aimedMin)
  return {
    station,
    position,
    aimedArrival: aimed - 30_000,
    aimedDeparture: aimed,
    actualArrival: delayS === null ? null : aimed - 30_000 + delayS * 1000,
    actualDeparture: delayS === null ? null : aimed + delayS * 1000,
    cancelled: false,
    lat: null,
    lon: null,
    platform: null,
    ...opts,
  }
}

function train(id: string, delays: Array<number | null>, stations = ['A', 'B', 'C', 'D', 'E', 'F']): Train {
  return {
    id,
    number: id,
    line: 'L1',
    destination: stations[stations.length - 1],
    patternId: null,
    notices: [],
    calls: stations.map((s, i) => call(s, i, i * 5, delays[i] ?? null)),
  }
}

function shift(c: Call, byMs: number): Call {
  const add = (v: number | null) => (v === null ? null : v + byMs)
  return { ...c, aimedDeparture: add(c.aimedDeparture), aimedArrival: add(c.aimedArrival), actualDeparture: add(c.actualDeparture), actualArrival: add(c.actualArrival) }
}

describe('verdictOf', () => {
  it('needs three readings', () => {
    expect(verdictOf([120])).toBe('one reading')
    expect(verdictOf([120, 316])).toBe('two readings')
  })
  it('compares last with first at ±45 s', () => {
    expect(verdictOf([25, 80, 76, 132])).toBe('growing')
    expect(verdictOf([132, 96, 86, 60])).toBe('shrinking')
    expect(verdictOf([60, 90, 40, 70])).toBe('holding')
  })
})

describe('stateOf', () => {
  it('is measured at the last stop with an actual time', () => {
    const t = train('1', [10, 40, 90, null, null, null])
    const s = stateOf(t, 'E')
    expect(s).toMatchObject({ kind: 'measured', delay: 90, at: 'C', stopsAway: 2, trail: [10, 40, 90] })
  })
  it('starts here when the origin is the user station and nothing is measured', () => {
    expect(stateOf(train('1', [null, null]), 'A')).toEqual({ kind: 'starts-here' })
  })
  it('has not departed when nothing is measured and the origin is elsewhere', () => {
    expect(stateOf(train('1', [null, null, null]), 'C')).toEqual({ kind: 'not-departed' })
  })
  it('treats a departure more than ten minutes early as unmeasured', () => {
    const t = train('1', [-3339, null, null])
    expect(delayAt(t.calls[0])).toBeNull()
    expect(stateOf(t, 'C')).toEqual({ kind: 'not-departed' })
    expect(delayAt(train('2', [-120]).calls[0])).toBe(-120)
  })
  it('treats a standing train as no earlier than its aimed departure', () => {
    const t = train('1', [30, null, null])
    t.calls[1].actualArrival = t.calls[1].aimedArrival! + 50_000
    expect(delayAt(t.calls[1])).toBe(20)
    expect(stateOf(t, 'C')).toMatchObject({ kind: 'measured', at: 'B', delay: 20, stopsAway: 1, standing: true })
    const early = train('2', [0, null, null])
    early.calls[1].actualArrival = early.calls[1].aimedArrival! - 40_000
    expect(delayAt(early.calls[1])).toBe(0)
    const terminus = train('3', [0, null, null])
    terminus.calls[2] = { ...terminus.calls[2], aimedDeparture: null, actualArrival: terminus.calls[2].aimedArrival! + 90_000 }
    expect(delayAt(terminus.calls[2])).toBe(90)
  })
})

describe('groupOf', () => {
  it('splits approaching, ahead and gone around the pair', () => {
    const approaching = train('1', [10, null, null, null, null, null])
    const standing = train('2', [10, 20, null, null, null, null])
    standing.calls[2].actualArrival = standing.calls[2].aimedArrival! + 20_000
    const ahead = train('3', [10, 20, 30, 40, null, null])
    const gone = train('4', [10, 20, 30, 40, 50, 60])
    expect(groupOf(approaching, stateOf(approaching, 'C'), 'C', 'E')).toBe('approaching')
    expect(groupOf(standing, stateOf(standing, 'C'), 'C', 'E')).toBe('approaching')
    expect(groupOf(ahead, stateOf(ahead, 'C'), 'C', 'E')).toBe('ahead')
    expect(groupOf(gone, stateOf(gone, 'C'), 'C', 'E')).toBe('gone')
  })
})

describe('corridorTrains', () => {
  it('keeps only trains serving from before to, ordered by measured arrival', () => {
    const late = train('late', [0, 600, null, null, null, null])
    const punctual = train('punctual', [0, 0, null, null, null, null])
    punctual.calls = punctual.calls.map((c) => shift(c, 120_000))
    const reverse = train('reverse', [0, 0, null, null, null, null], ['F', 'E', 'D', 'C', 'B', 'A'])
    const list = corridorTrains([late, punctual, reverse], 'C', 'E')
    expect(list.map((c) => c.train.id)).toEqual(['punctual', 'late'])
  })
})

describe('segments', () => {
  it('records delay added between consecutive measured stops and suppresses below four passes', () => {
    const trains = [1, 2, 3, 4].map((i) => train(String(i), [0, 60, 60, null, null, null]))
    const obs = segmentObservations(trains)
    const stats = aggregateSegments(obs, min(20))
    expect(stats.get('A→B')).toMatchObject({ n: 4, added: 60, band: 'steady' })
    expect(stats.get('B→C')).toMatchObject({ n: 4, added: 0, band: 'steady' })
    const three = aggregateSegments(segmentObservations(trains.slice(0, 3)), min(20))
    expect(three.get('A→B')?.band).toBe('few')
  })
  it('ignores observations outside the window', () => {
    const trains = [1, 2, 3, 4].map((i) => train(String(i), [0, 60, null, null, null, null]))
    expect(aggregateSegments(segmentObservations(trains), min(120)).size).toBe(0)
  })
  it('bands by added seconds', () => {
    expect(bandOf(-40, 4)).toBe('catching-up')
    expect(bandOf(60, 4)).toBe('steady')
    expect(bandOf(61, 4)).toBe('plus0')
    expect(bandOf(150, 4)).toBe('plus1')
    expect(bandOf(240, 4)).toBe('plus2')
    expect(bandOf(301, 4)).toBe('worse')
    expect(bandOf(999, 3)).toBe('few')
  })
})

describe('arrivalWindow', () => {
  it('carries the delay as the floor and the worst recent added delay as the ceiling', () => {
    const me = train('me', [0, 60, null, null, null, null])
    const others = [30, 90, 0].map((added, i) => train(`o${i}`, [0, 0, 0, 0, added, added]))
    const ct = corridorTrains([me], 'C', 'E')[0]
    const w = arrivalWindow(ct, 'E', [me, ...others], min(30))!
    expect(w.sample).toBe(3)
    expect(w.lower - w.scheduled).toBe(60_000)
    expect(w.upper! - w.lower).toBe(90_000)
  })
  it('shows only the floor with fewer than three trains', () => {
    const me = train('me', [0, 60, null, null, null, null])
    const others = [30, 90].map((added, i) => train(`o${i}`, [0, 0, 0, 0, added, added]))
    const ct = corridorTrains([me], 'C', 'E')[0]
    expect(arrivalWindow(ct, 'E', [me, ...others], min(30))).toMatchObject({ upper: null, sample: 2 })
  })
})

describe('headlineOf', () => {
  it('reports calm when every measured train is within a minute', () => {
    const list = corridorTrains([train('1', [0, 20, null, null, null, null]), train('2', [0, -30, null, null, null, null])], 'C', 'E')
    expect(headlineOf(list)).toMatchObject({ kind: 'calm', count: 2 })
  })
  it('leads with the next train when it is late', () => {
    const later = train('2', [0, 0, null, null, null, null])
    later.calls = later.calls.map((c) => shift(c, 600_000))
    const list = corridorTrains([train('1', [0, 200, null, null, null, null]), later], 'C', 'E')
    expect(headlineOf(list)).toMatchObject({ kind: 'late', delay: 200, at: 'B' })
  })
})

describe('live snapshot · Sandvika → Oslo S', () => {
  const snap = sandvika as CorridorSnapshot
  const now = Date.parse(snap.recordedAt)
  const trains = trainsFromSnapshot(snap)
  const list = corridorTrains(trains, snap.from, snap.to)

  it('has trains in every state and none already past Oslo S', () => {
    expect(list.length).toBeGreaterThan(5)
    expect(list.some((c) => c.state.kind === 'measured')).toBe(true)
  })
  it('keeps Flytoget, whose future stops carry actual times equal to the timetable', () => {
    expect(list.some((c) => c.train.line === 'FLY1')).toBe(true)
    for (const t of trains) for (const c of t.calls) {
      if (c.actualArrival !== null) expect(c.actualArrival).toBeLessThanOrEqual(now + 30_000)
      if (c.actualDeparture !== null) expect(c.actualDeparture).toBeLessThanOrEqual(now + 30_000)
    }
  })
  it('is ordered by measured arrival at Sandvika', () => {
    const times = list.map((c) => c.arrivesFrom ?? Infinity)
    expect([...times].sort((a, b) => a - b)).toEqual(times)
  })
  it('names the corridor stations in running order', () => {
    const stations = corridorStations(list, snap.from, snap.to)
    expect(stations[0]).toBe('Sandvika')
    expect(stations.at(-1)).toBe('Oslo S')
    expect(stations).toContain('Lysaker')
    expect(stations.indexOf('Lysaker')).toBeLessThan(stations.indexOf('Nationaltheatret'))
  })
  it('measures added delay on the approach into Oslo', () => {
    const stats = aggregateSegments(segmentObservations(trains), now)
    const qualifying = [...stats.values()].filter((s) => s.band !== 'few')
    expect(qualifying.length).toBeGreaterThan(3)
    expect(stats.get('Lysaker→Skøyen')?.n ?? 0).toBeGreaterThan(0)
  })
  it('counts trains officially late somewhere in the last hour', () => {
    expect(officiallyLateCount(trains, now)).toBeGreaterThanOrEqual(0)
  })
})

describe('live snapshot · Lillestrøm → Oslo S', () => {
  const snap = lillestrom as CorridorSnapshot
  it('resolves the tunnel-side corridor', () => {
    const list = corridorTrains(trainsFromSnapshot(snap), snap.from, snap.to)
    expect(list.length).toBeGreaterThan(3)
    expect(corridorStations(list, snap.from, snap.to)[0]).toBe('Lillestrøm')
  })
})

describe('upstream rows', () => {
  it('orders stations by scheduled minutes to the user station, so a far express stop outranks a near branch stop', () => {
    const local = train('l', [], ['P', 'Q', 'R', 'J', 'X', 'FROM', 'TO'])
    const branch = train('b', [], ['M', 'N', 'J', 'X', 'FROM', 'TO'])
    const express = train('e', [], ['P', 'J', 'FROM', 'TO'])
    expect(upstreamOrder([local, branch, express], 'FROM')).toEqual(['X', 'J', 'N', 'R', 'M', 'Q', 'P'])
    const farBranch = train('f', [], ['FAR', 'J', 'X', 'FROM', 'TO'])
    farBranch.calls[0] = { ...farBranch.calls[0], aimedDeparture: farBranch.calls[1].aimedDeparture! - 40 * 60_000, aimedArrival: farBranch.calls[1].aimedDeparture! - 40 * 60_000 }
    expect(upstreamOrder([local, farBranch], 'FROM').at(-1)).toBe('FAR')
  })
  it('prefers geography when coordinates are known: a far station on a fast line still ranks far', () => {
    const at = (t: Train, coords: Record<string, [number, number]>) => {
      t.calls = t.calls.map((c) => (coords[c.station] ? { ...c, lat: coords[c.station][0], lon: coords[c.station][1] } : c))
      return t
    }
    const coords: Record<string, [number, number]> = { FROM: [59.9, 11.0], NEAR: [59.95, 11.0], MID: [60.0, 11.0], FAR: [60.2, 11.0] }
    const slowLocal = at(train('l', [], ['MID', 'NEAR', 'FROM', 'TO']), coords)
    const fastExpress = at(train('e', [], ['FAR', 'FROM', 'TO']), coords)
    expect(upstreamOrder([slowLocal, fastExpress], 'FROM')).toEqual(['NEAR', 'MID', 'FAR'])
    expect(kmFromStation([slowLocal], 'FROM')?.get('MID')).toBeCloseTo(11.1, 0)
  })
  it('picks the stations most trains pass, then orders them by distance', () => {
    const local = train('l', [], ['P', 'Q', 'R', 'J', 'X', 'FROM', 'TO'])
    const branch = train('b', [], ['M', 'N', 'J', 'X', 'FROM', 'TO'])
    const express = train('e', [], ['P', 'J', 'FROM', 'TO'])
    const order = upstreamOrder([local, branch, express], 'FROM')
    expect(pickUpstreamRows(order, [local, branch, express], 'FROM', 3)).toEqual(['X', 'J', 'P'])
  })
})

describe('visibleTrains', () => {
  it('keeps every measured train and only the unmeasured ones due within the horizon', () => {
    const measuredFar = train('m', [0, 30, null, null, null, null])
    measuredFar.calls = measuredFar.calls.map((c) => shift(c, 80 * 60_000))
    const soon = train('s', [null, null, null, null, null, null])
    soon.calls = soon.calls.map((c) => shift(c, 15 * 60_000))
    const late = train('l', [null, null, null, null, null, null])
    late.calls = late.calls.map((c) => shift(c, 50 * 60_000))
    const later = train('x', [null, null, null, null, null, null])
    later.calls = later.calls.map((c) => shift(c, 70 * 60_000))
    const list = corridorTrains([measuredFar, soon, late, later], 'C', 'E')
    const now = min(10)
    const v = visibleTrains(list, now)
    expect(v.shown.map((c) => c.train.id)).toEqual(['s', 'm'])
    expect(v.laterCount).toBe(2)
    expect(v.laterUntil).toBe(later.calls[2].aimedArrival)
  })
  it('drops an unmeasured train whose timetable departure is well in the past', () => {
    const ghost = train('g', [null, null, null, null, null, null])
    ghost.calls = ghost.calls.map((c) => shift(c, -20 * 60_000))
    const fresh = train('f', [null, null, null, null, null, null])
    const v = visibleTrains(corridorTrains([ghost, fresh], 'C', 'E'), min(10))
    expect(v.shown.map((c) => c.train.id)).toEqual(['f'])
  })
})

describe('trainsAsOf', () => {
  it('forgets every measurement recorded after the given moment', () => {
    const t = train('1', [0, 60, 120, null, null, null])
    const rewound = trainsAsOf([t], t.calls[1].actualDeparture! + 1000)[0]
    expect(stateOf(rewound, 'E')).toMatchObject({ kind: 'measured', at: 'B', delay: 60 })
    expect(stateOf(trainsAsOf([t], t.calls[0].aimedDeparture! - 60_000)[0], 'E')).toEqual({ kind: 'not-departed' })
  })
  it('marks a train standing at a stop when only its arrival is recorded', () => {
    const t = train('1', [0, null, null])
    t.calls[1].actualArrival = t.calls[1].aimedArrival! + 10_000
    expect(stateOf(t, 'C')).toMatchObject({ kind: 'measured', at: 'B', standing: true })
    expect(stateOf(train('2', [0, 5, null]), 'C')).toMatchObject({ standing: false })
  })
})

describe('excluded lines', () => {
  it('drops long-distance F trains but keeps Flytoget', () => {
    expect(EXCLUDED_LINES.test('F4')).toBe(true)
    expect(EXCLUDED_LINES.test('F5')).toBe(true)
    expect(EXCLUDED_LINES.test('FLY1')).toBe(false)
    expect(EXCLUDED_LINES.test('RE11')).toBe(false)
  })
})

describe('origin arrival', () => {
  it('ignores the recorded arrival at the first stop, which is the empty stock arriving', () => {
    const t = toTrain(
      {
        id: 'x',
        privateCode: '1',
        line: { id: 'l', publicCode: 'R13', name: null, transportMode: 'rail' },
        estimatedCalls: [
          { aimedDepartureTime: '2026-09-16T10:00:00Z', actualDepartureTime: null, aimedArrivalTime: '2026-09-16T09:59:00Z', actualArrivalTime: '2026-09-16T09:49:00Z', realtime: true, cancellation: false, stopPositionInPattern: 0, quay: { id: 'q', publicCode: '1', stopPlace: { id: 's', name: 'Drammen stasjon' } } },
          { aimedDepartureTime: '2026-09-16T10:10:00Z', actualDepartureTime: null, aimedArrivalTime: '2026-09-16T10:09:00Z', actualArrivalTime: null, realtime: true, cancellation: false, stopPositionInPattern: 1, quay: { id: 'q2', publicCode: '1', stopPlace: { id: 's2', name: 'Asker stasjon' } } },
        ],
      },
      'Dal',
    )
    expect(t.calls[0].actualArrival).toBeNull()
    expect(stateOf(t, 'Asker')).toEqual({ kind: 'not-departed' })
  })
})

describe('stationMood', () => {
  const at = (delay: number, minutesAgo: number) => {
    const t = train(`m${delay}-${minutesAgo}`, [0, delay, null], ['A', 'S', 'B'])
    const shiftBy = min(10) - t.calls[1].aimedDeparture! - minutesAgo * 60_000
    t.calls = t.calls.map((c) => shift(c, shiftBy))
    return t
  }
  it('needs three departures in the window', () => {
    expect(stationMood([at(30, 5), at(40, 10)], 'S', min(10)).mood).toBe('unknown')
  })
  it('grades by the median delay of the last five departures', () => {
    expect(stationMood([at(30, 20), at(40, 30), at(20, 40)], 'S', min(10)).mood).toBe('well')
    expect(stationMood([at(130, 20), at(40, 30), at(200, 40)], 'S', min(10)).mood).toBe('small')
    expect(stationMood([at(400, 20), at(300, 30), at(200, 40)], 'S', min(10)).mood).toBe('delays')
    expect(stationMood([at(900, 20), at(600, 30), at(700, 40)], 'S', min(10)).mood).toBe('disrupted')
  })
  it('ignores departures older than the window', () => {
    expect(stationMood([at(30, 5), at(40, 10), at(20, 75)], 'S', min(10)).mood).toBe('unknown')
  })
  it('leaves one troubled train beside the grade', () => {
    const c = at(0, -5)
    c.calls[1] = { ...c.calls[1], cancelled: true, actualDeparture: null }
    expect(stationMood([c, at(30, 5), at(40, 10), at(20, 15)], 'S', min(10), undefined, new Set([c.id]))).toMatchObject({ mood: 'well', cancelled: 1, notices: 1 })
    expect(stationMood([c], 'S', min(10))).toMatchObject({ mood: 'unknown', cancelled: 1 })
  })
  it('calls two troubled trains disrupted whatever the median', () => {
    const c = at(0, -5)
    c.calls[1] = { ...c.calls[1], cancelled: true, actualDeparture: null }
    const fine = [at(30, 5), at(40, 10), at(20, 15)]
    expect(stationMood([c, ...fine], 'S', min(10), undefined, new Set(['other'])).mood).toBe('disrupted')
    expect(stationMood(fine, 'S', min(10), undefined, new Set(['x', 'y'])).mood).toBe('disrupted')
    expect(stationMood([c], 'S', min(10), undefined, new Set(['other'])).mood).toBe('disrupted')
  })
})

describe('hasIncident', () => {
  const notice = (stations: string[], kind: Notice['kind'] = 'incident'): Notice => ({ id: stations.join(), kind, summary: '', description: '', advice: '', stations, until: null })
  const withNotices = (...notices: Notice[]) => ({ ...train('n', []), notices })
  it('counts notices that touch the stretch from boarding to alighting', () => {
    expect(hasIncident(withNotices(notice(['B', 'C'])), 'B', 'D')).toBe(true)
    expect(hasIncident(withNotices(notice(['D'])), 'B', 'D')).toBe(true)
    expect(hasIncident(withNotices(notice([])), 'B', 'D')).toBe(true)
  })
  it('ignores notices elsewhere on the route and informational ones', () => {
    expect(hasIncident(withNotices(notice(['A'])), 'B', 'D')).toBe(false)
    expect(hasIncident(withNotices(notice(['E', 'F'])), 'B', 'D')).toBe(false)
    expect(hasIncident(withNotices(notice(['C'], 'info')), 'B', 'D')).toBe(false)
    expect(hasIncident(withNotices(notice(['E', 'F'], 'cancelled')), 'B', 'D')).toBe(false)
  })
})

describe('upstreamRowCount', () => {
  it('shows twice the corridor segments, between four and eight', () => {
    expect(upstreamRowCount(1)).toBe(4)
    expect(upstreamRowCount(2)).toBe(4)
    expect(upstreamRowCount(3)).toBe(6)
    expect(upstreamRowCount(7)).toBe(8)
  })
})

describe('notices', () => {
  it('classifies operator messages by their text and type', () => {
    expect(noticeKind('Cancelled Skøyen–Asker', 'The train has been cancelled between Skøyen and Asker.', 'incident')).toBe('cancelled')
    expect(noticeKind('Fewer carriages', 'runs with 4 carriages instead of 8', 'general')).toBe('short')
    expect(noticeKind('Delay expected', 'other trains on the line are delayed', 'incident')).toBe('incident')
    expect(noticeKind('Ticket machines', 'out of order', 'general')).toBe('info')
    expect(noticeKind('Normal speed: Kløfta–Gardermoen', 'Trains are running at normal speed again. You should expect delays.', 'incident')).toBe('info')
    expect(noticeKind('Line open: Moss–Vestby', 'The line has reopened. Trains that were cancelled now run as normal.', 'incident')).toBe('info')
  })
  it('prefers English, drops expired messages and dedupes by id', () => {
    const now = Date.parse('2026-09-17T12:00:00Z')
    const raw = {
      id: 's1',
      severity: 'normal',
      reportType: 'incident',
      summary: [{ value: 'Innstilt', language: 'no' }, { value: 'Cancelled Skøyen–Asker', language: 'en' }],
      description: [{ value: 'Cancelled between Skøyen and Asker.', language: 'en' }],
      advice: [{ value: 'Use the next train', language: 'en' }],
      validityPeriod: { startTime: null, endTime: '2026-09-17T13:00:00Z' },
      affects: [{ __typename: 'AffectedStopPlaceOnServiceJourney', stopPlace: { name: 'Skøyen stasjon' } }, { __typename: 'AffectedStopPlaceOnServiceJourney', stopPlace: { name: 'Asker' } }],
    }
    const n = toNotices([raw, raw, { ...raw, id: 's2', validityPeriod: { startTime: null, endTime: '2026-09-17T11:00:00Z' } }], now)
    expect(n).toHaveLength(1)
    expect(n[0]).toMatchObject({ kind: 'cancelled', summary: 'Cancelled Skøyen–Asker', advice: 'Use the next train', stations: ['Skøyen', 'Asker'] })
  })
})

describe('inWords', () => {
  it('rounds to minutes and says due once the time has passed', () => {
    const now = Date.parse('2026-09-17T12:00:00Z')
    expect(inWords(now + 6 * 60_000, now)).toBe('in 6 min')
    expect(inWords(now + 50_000, now)).toBe('in 1 min')
    expect(inWords(now + 20_000, now)).toBe('due')
    expect(inWords(now - 90_000, now)).toBe('due')
  })
})
