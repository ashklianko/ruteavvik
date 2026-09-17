import polyline from '@mapbox/polyline'
import { describe, expect, it } from 'vitest'
import { decodePattern, positionAlong, stopIndex, subPath } from './geometry.ts'

const line: Array<[number, number]> = Array.from({ length: 11 }, (_, i) => [59.9, 10.5 + i * 0.01])
const raw = {
  id: 'p',
  quays: [
    { stopPlace: { name: 'A stasjon', latitude: 59.9, longitude: 10.5 } },
    { stopPlace: { name: 'B stasjon', latitude: 59.9, longitude: 10.55 } },
    { stopPlace: { name: 'C', latitude: 59.9, longitude: 10.6 } },
  ],
  pointsOnLink: { points: polyline.encode(line) },
}

describe('geometry', () => {
  const p = decodePattern(raw)
  it('snaps stops to the nearest vertex in running order', () => {
    expect(p.stops.map((s) => s.station)).toEqual(['A', 'B', 'C'])
    expect(p.stops.map((s) => s.vertex)).toEqual([0, 5, 10])
  })
  it('cuts the track between two stops', () => {
    expect(subPath(p, 0, 1)).toHaveLength(6)
    expect(subPath(p, 1, 0)[0][0]).toBeCloseTo(10.55)
  })
  it('interpolates a position along the track', () => {
    const mid = positionAlong(p, 0, 1, 0.5)!
    expect(mid[0]).toBeCloseTo(10.525, 3)
    expect(positionAlong(p, 1, 2, 0)![0]).toBeCloseTo(10.55)
    expect(positionAlong(p, 1, 2, 1)![0]).toBeCloseTo(10.6)
  })
  it('finds a stop by name with an index hint', () => {
    expect(stopIndex(p, 'B', 1)).toBe(1)
    expect(stopIndex(p, 'B')).toBe(1)
    expect(stopIndex(p, 'Z')).toBe(-1)
  })
})
