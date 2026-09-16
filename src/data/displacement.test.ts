import { expect, it } from 'vitest'
import { displacement, isPinned } from './displacement.ts'

it('sits on the spine at zero and takes 60 % of the half-width by five minutes', () => {
  expect(displacement(0, 100)).toBe(0)
  expect(displacement(300, 100)).toBeCloseTo(60)
  expect(displacement(150, 100)).toBeCloseTo(30)
})

it('compresses five to fifteen minutes into the remaining 40 % and pins beyond', () => {
  expect(displacement(600, 100)).toBeCloseTo(80)
  expect(displacement(900, 100)).toBeCloseTo(100)
  expect(displacement(3000, 100)).toBeCloseTo(100)
  expect(isPinned(3000)).toBe(true)
  expect(isPinned(900)).toBe(false)
})

it('mirrors early trains leftwards and clamps at two minutes', () => {
  expect(displacement(-60, 100)).toBeCloseTo(-12)
  expect(displacement(-600, 100)).toBeCloseTo(-24)
})
