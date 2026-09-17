import { expect, it } from 'vitest'
import { axisMax, displacement, isPinned, ticksFor } from './displacement.ts'

it('sits on the spine at zero and reaches the edge at the axis maximum', () => {
  expect(displacement(0, 100, 15)).toBe(0)
  expect(displacement(15 * 60, 100, 15)).toBeCloseTo(100)
  expect(displacement(90, 100, 3)).toBeCloseTo(50)
  expect(displacement(3000, 100, 3)).toBeCloseTo(100)
  expect(isPinned(3000, 3)).toBe(true)
  expect(isPinned(150, 3)).toBe(false)
})

it('gives early trains a small leftward nudge and clamps at one minute', () => {
  expect(displacement(-30, 100, 15)).toBeCloseTo(-2)
  expect(displacement(-600, 100, 15)).toBeCloseTo(-4)
})

it('picks the smallest axis that holds the worst delay with headroom', () => {
  expect(axisMax([])).toBe(3)
  expect(axisMax([60, 140])).toBe(3)
  expect(axisMax([170])).toBe(5)
  expect(axisMax([400])).toBe(10)
  expect(axisMax([900])).toBe(15)
  expect(axisMax([9000])).toBe(15)
  expect(ticksFor(5)).toEqual([0, 1, 2, 3, 4, 5])
})
