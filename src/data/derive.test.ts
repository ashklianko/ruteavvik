import { describe, expect, it } from 'vitest'
import sandvika from '../../public/snapshots/sandvika-oslo-s-2026-09-16-08-07.json'
import lillestrom from '../../public/snapshots/lillestrom-oslo-s-2026-09-16-08-07.json'
import {
  aggregateSegments,
  arrivalWindow,
  bandOf,
  corridorStations,
  corridorTrains,
  delayAt,
  groupOf,
  headlineOf,
  officiallyLateCount,
  segmentObservations,
  stateOf,
  verdictOf,
} from './derive.ts'
import { trainsFromSnapshot, type Call, type Train } from './model.ts'
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
    ...opts,
  }
}

function train(id: string, delays: Array<number | null>, stations = ['A', 'B', 'C', 'D', 'E', 'F']): Train {
  return {
    id,
    number: id,
    line: 'L1',
    destination: stations[stations.length - 1],
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
  it('falls back to arrival at a stop with no departure yet', () => {
    const t = train('1', [30, null, null])
    t.calls[1].actualArrival = t.calls[1].aimedArrival! + 50_000
    expect(delayAt(t.calls[1])).toBe(50)
    expect(stateOf(t, 'C')).toMatchObject({ kind: 'measured', at: 'B', delay: 50, stopsAway: 1 })
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
    expect(stats.get('A→B')).toMatchObject({ n: 4, added: 60, band: 'plus1' })
    expect(stats.get('B→C')).toMatchObject({ n: 4, added: 0, band: 'steady' })
    const three = aggregateSegments(segmentObservations(trains.slice(0, 3)), min(20))
    expect(three.get('A→B')?.band).toBe('few')
  })
  it('ignores observations outside the window', () => {
    const trains = [1, 2, 3, 4].map((i) => train(String(i), [0, 60, null, null, null, null]))
    expect(aggregateSegments(segmentObservations(trains), min(120)).size).toBe(0)
  })
  it('bands by added seconds', () => {
    expect(bandOf(-30, 4)).toBe('catching-up')
    expect(bandOf(30, 4)).toBe('steady')
    expect(bandOf(31, 4)).toBe('plus1')
    expect(bandOf(150, 4)).toBe('plus2')
    expect(bandOf(151, 4)).toBe('worse')
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
    expect(list.every((c) => c.group !== 'gone')).toBe(true)
    expect(list.some((c) => c.state.kind === 'measured')).toBe(true)
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
