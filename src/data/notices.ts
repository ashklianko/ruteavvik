import type { Notice } from './model.ts'

export function relevantNotices(notices: Notice[], from: string | null, to: string | null): Notice[] {
  const pair = [from, to].filter((x): x is string => Boolean(x))
  return notices.filter((n) => n.stations.length === 0 || n.stations.some((s) => pair.includes(s)) || n.kind === 'cancelled')
}
