import { normaliseName } from './stations.ts'
import type { CorridorSnapshot, RawJourney, RawSituation, RawStopCall, RawText } from './types.ts'

export interface Call {
  station: string
  position: number
  aimedDeparture: number | null
  actualDeparture: number | null
  aimedArrival: number | null
  actualArrival: number | null
  cancelled: boolean
  lat: number | null
  lon: number | null
  platform: string | null
}

export type NoticeKind = 'cancelled' | 'incident' | 'short' | 'info'

export interface Notice {
  id: string
  kind: NoticeKind
  summary: string
  description: string
  advice: string
  stations: string[]
  until: number | null
}

export interface Train {
  id: string
  number: string
  line: string
  destination: string
  patternId: string | null
  notices: Notice[]
  calls: Call[]
}

const pick = (texts: RawText[] | undefined): string => {
  if (!texts?.length) return ''
  return (texts.find((t) => t.language === 'en') ?? texts.find((t) => t.language === 'no') ?? texts[0]).value.trim()
}

export function noticeKind(summary: string, description: string, reportType: string | null): NoticeKind {
  const head = summary.toLowerCase()
  const text = `${summary} ${description}`.toLowerCase()
  if (/line open|reopen|åpnet|normal traffic|running normally|normal speed|normal hastighet|går som normalt|resumed/.test(head)) return 'info'
  if (/cancel|innstilt/.test(head) || (/cancel|innstilt/.test(text) && !/no longer|not cancelled|ikke lenger/.test(text) && reportType === 'incident')) return 'cancelled'
  if (/fewer carriages|færre vogner|short train|carriages instead/.test(text)) return 'short'
  if (reportType === 'incident' || /delay|forsink|disrupt|buss|bus for train|replacement/.test(text)) return 'incident'
  return 'info'
}

export function toNotices(raws: RawSituation[] | undefined, now: number): Notice[] {
  const out = new Map<string, Notice>()
  for (const r of raws ?? []) {
    const until = r.validityPeriod?.endTime ? Date.parse(r.validityPeriod.endTime) : null
    if (until !== null && until < now - 5 * 60_000) continue
    const start = r.validityPeriod?.startTime ? Date.parse(r.validityPeriod.startTime) : null
    if (start !== null && start > now + 6 * 3_600_000) continue
    const summary = pick(r.summary)
    const description = pick(r.description)
    if (!summary && !description) continue
    out.set(r.id, {
      id: r.id,
      kind: noticeKind(summary, description, r.reportType),
      summary: summary || description.slice(0, 60),
      description,
      advice: pick(r.advice),
      stations: [...new Set(r.affects.flatMap((a) => (a.stopPlace ? [normaliseName(a.stopPlace.name)] : [])))],
      until,
    })
  }
  return [...out.values()]
}

const ms = (iso: string | null): number | null => (iso ? Date.parse(iso) : null)

export function toTrain(journey: RawJourney, destination: string, now = Date.now()): Train {
  const raws = [...(journey.situations ?? []), ...journey.estimatedCalls.flatMap((c) => c.situations ?? [])]
  return {
    id: journey.id,
    number: journey.privateCode ?? '',
    line: journey.line.publicCode ?? '',
    destination,
    patternId: journey.journeyPattern?.id ?? null,
    notices: toNotices(raws, now),
    calls: journey.estimatedCalls
      .filter((c) => c.quay?.stopPlace)
      .sort((a, b) => a.stopPositionInPattern - b.stopPositionInPattern)
      .map((c, i) => ({
        station: normaliseName(c.quay!.stopPlace.name),
        position: c.stopPositionInPattern,
        aimedDeparture: ms(c.aimedDepartureTime),
        actualDeparture: ms(c.actualDepartureTime),
        aimedArrival: ms(c.aimedArrivalTime),
        actualArrival: i === 0 ? null : ms(c.actualArrivalTime),
        cancelled: c.cancellation,
        lat: c.quay!.stopPlace.latitude ?? null,
        lon: c.quay!.stopPlace.longitude ?? null,
        platform: c.quay!.publicCode ?? null,
      })),
  }
}

export const EXCLUDED_LINES = /^F\d/i

export const FUTURE_SKEW_MS = 30_000

function dropFutureActuals(train: Train, recordedAt: number): Train {
  const limit = recordedAt + FUTURE_SKEW_MS
  return {
    ...train,
    calls: train.calls.map((c) => ({
      ...c,
      actualDeparture: c.actualDeparture !== null && c.actualDeparture > limit ? null : c.actualDeparture,
      actualArrival: c.actualArrival !== null && c.actualArrival > limit ? null : c.actualArrival,
    })),
  }
}

export function trainsFromSnapshot(snap: CorridorSnapshot): Train[] {
  const recordedAt = Date.parse(snap.recordedAt)
  const destinations = new Map<string, string>()
  for (const c of snap.stopCalls as RawStopCall[]) {
    const text = c.destinationDisplay?.frontText
    if (text && !destinations.has(c.serviceJourney.id)) destinations.set(c.serviceJourney.id, text)
  }
  return snap.journeys
    .filter((j) => !EXCLUDED_LINES.test(j.line.publicCode ?? ''))
    .map((j) => {
      const fallback = j.estimatedCalls.at(-1)?.quay?.stopPlace.name ?? ''
      return dropFutureActuals(toTrain(j, destinations.get(j.id) ?? normaliseName(fallback), recordedAt), recordedAt)
    })
}
