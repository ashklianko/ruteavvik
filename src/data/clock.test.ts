import { describe, expect, it } from 'vitest'
import { atClock, osloOffsetMs } from './clock.ts'

describe('atClock', () => {
  it('places HH:MM on the recording date in Oslo time', () => {
    expect(atClock('2026-09-17T06:07:17.207Z', '07:45')).toBe(Date.parse('2026-09-17T05:45:00Z'))
    expect(atClock('2026-09-17T06:07:17.207Z', '9:31')).toBe(Date.parse('2026-09-17T07:31:00Z'))
  })
  it('uses the winter offset in January', () => {
    expect(atClock('2026-01-12T07:00:00Z', '08:00')).toBe(Date.parse('2026-01-12T07:00:00Z'))
    expect(osloOffsetMs(Date.parse('2026-01-12T07:00:00Z'))).toBe(3_600_000)
  })
  it('rejects malformed input', () => {
    expect(atClock('2026-09-17T06:07:17Z', '0745')).toBeNull()
    expect(atClock('nonsense', '07:45')).toBeNull()
  })
})
