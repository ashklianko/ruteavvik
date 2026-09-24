import type { Notice, Train } from './model.ts'

export function relevantNotices(train: Train, from: string | null, to: string | null): Notice[] {
  const a = train.calls.findIndex((c) => c.station === from)
  const b = train.calls.findIndex((c) => c.station === to)
  const stretch = new Set(a >= 0 && b > a ? train.calls.slice(a, b + 1).map((c) => c.station) : [from, to].filter((x): x is string => Boolean(x)))
  return train.notices.filter((n) => n.stations.length === 0 || n.stations.some((s) => stretch.has(s)))
}

export const isDisruptive = (n: Notice): boolean => n.kind === 'cancelled' || n.kind === 'incident'
