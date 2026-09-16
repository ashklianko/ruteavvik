import { scaleLinear } from 'd3-scale'

export const MAX_MINUTES = 15
export const MIN_MINUTES = -2

const unit = scaleLinear<number>().domain([MIN_MINUTES, 0, 5, MAX_MINUTES]).range([-0.24, 0, 0.6, 1]).clamp(true)

export function displacement(delaySeconds: number, halfWidth: number): number {
  return unit(delaySeconds / 60) * halfWidth
}

export function isPinned(delaySeconds: number): boolean {
  return delaySeconds / 60 > MAX_MINUTES
}
