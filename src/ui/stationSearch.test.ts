import { expect, it } from 'vitest'
import { fold, rank } from './stationSearch.ts'

const st = (name: string) => ({ name, id: name, lat: 0, lon: 0 })
const stations = ['Oslo S', 'Oslo lufthavn', 'Skøyen', 'Ås', 'Asker', 'Lillestrøm', 'Nationaltheatret', 'Sandvika'].map(st)

it('folds Norwegian letters so ASCII typing matches', () => {
  expect(fold('Skøyen')).toBe('skoyen')
  expect(fold('Ås')).toBe('as')
  expect(fold('Lillestrøm')).toBe('lillestrom')
})

it('ranks prefix matches before word starts before substrings', () => {
  expect(rank(stations, 'as', null).map((s) => s.name)).toEqual(['Asker', 'Ås'])
  expect(rank(stations, 'oslo', null).map((s) => s.name)).toEqual(['Oslo lufthavn', 'Oslo S'])
  expect(rank(stations, 'luft', null).map((s) => s.name)).toEqual(['Oslo lufthavn'])
  expect(rank(stations, 'theat', null).map((s) => s.name)).toEqual(['Nationaltheatret'])
})

it('excludes the other end of the pair and lists everything by default', () => {
  expect(rank(stations, '', 'Oslo S').map((s) => s.name)).not.toContain('Oslo S')
  expect(rank(stations, '', null)).toHaveLength(stations.length)
  expect(rank(stations, '', null, 3)).toHaveLength(3)
})
