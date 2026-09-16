import { expect, it } from 'vitest'
import { normaliseName, toStations } from './stations.ts'

it('strips the stasjon suffix only', () => {
  expect(normaliseName('Sandvika stasjon')).toBe('Sandvika')
  expect(normaliseName('Oslo S')).toBe('Oslo S')
  expect(normaliseName('Nationaltheatret stasjon ')).toBe('Nationaltheatret')
})

it('keeps rail stops, deduplicates by name and sorts', () => {
  const list = toStations([
    { id: '1', name: 'Ås stasjon', latitude: 0, longitude: 0, transportMode: ['rail'] },
    { id: '2', name: 'Oslo S', latitude: 0, longitude: 0, transportMode: ['rail', 'bus'] },
    { id: '3', name: 'Oslo S', latitude: 0, longitude: 0, transportMode: ['rail'] },
    { id: '4', name: 'Bussterminalen', latitude: 0, longitude: 0, transportMode: ['bus'] },
    { id: '5', name: 'Asker stasjon', latitude: 0, longitude: 0, transportMode: null },
  ])
  expect(list.map((s) => s.name)).toEqual(['Oslo S', 'Ås'])
  expect(list[0].id).toBe('2')
})
