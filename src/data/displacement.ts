import { scaleLinear } from 'd3-scale'

export const MIN_MINUTES = -1
export const AXIS_STEPS = [3, 5, 10, 15] as const
export type AxisMax = (typeof AXIS_STEPS)[number]

export function axisMax(delaysSeconds: number[]): AxisMax {
  const sorted = [...delaysSeconds].filter((d) => d > 0).sort((a, b) => b - a)
  let worst = sorted[0] ?? 0
  const second = sorted[1] ?? 0
  if (sorted.length > 1 && worst > 300 && worst > 2 * second) worst = second
  const minutes = worst / 60
  for (const step of AXIS_STEPS) if (minutes * 1.15 <= step) return step
  return 15
}

export function ticksFor(max: AxisMax): number[] {
  if (max === 3) return [0, 1, 2, 3]
  if (max === 5) return [0, 1, 2, 3, 4, 5]
  if (max === 10) return [0, 2, 4, 6, 8, 10]
  return [0, 1, 2, 5, 10, 15]
}

export function displacement(delaySeconds: number, halfWidth: number, max: AxisMax = 15): number {
  const unit = scaleLinear<number>().domain([MIN_MINUTES, 0, max]).range([-0.04, 0, 1]).clamp(true)
  return unit(delaySeconds / 60) * halfWidth
}

export function isPinned(delaySeconds: number, max: AxisMax = 15): boolean {
  return delaySeconds / 60 > max
}
