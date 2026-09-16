import {
  aggregateSegments,
  arrivalWindow,
  corridorStations,
  corridorTrains,
  headlineOf,
  officiallyLateCount,
  segmentObservations,
} from '../data/derive.ts'
import { trainsFromSnapshot } from '../data/model.ts'
import { snapshotParam, useCorridor, useNow, useStations } from '../data/useCorridor.ts'

const fmt = (ms: number | null | undefined) =>
  ms == null ? '—' : new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit', second: '2-digit' })
const signed = (s: number) => `${s < 0 ? '−' : '+'}${Math.floor(Math.abs(s) / 60)}:${String(Math.abs(s) % 60).padStart(2, '0')}`

export function Debug() {
  const params = new URLSearchParams(window.location.search)
  const fromName = params.get('from') ?? 'Sandvika'
  const toName = params.get('to') ?? 'Oslo S'
  const stations = useStations()
  const from = stations.data?.find((s) => s.name === fromName) ?? null
  const corridor = useCorridor(from, toName)
  const wallClock = useNow()
  const snap = corridor.data
  if (stations.isError) return <pre>stations: {String(stations.error)}</pre>
  if (corridor.isError) return <pre>corridor: {String(corridor.error)}</pre>
  if (!snap) return <pre>loading {snapshotParam() ?? `${fromName} → ${toName}`}…</pre>

  const now = snapshotParam() ? Date.parse(snap.recordedAt) : wallClock
  const trains = trainsFromSnapshot(snap)
  const list = corridorTrains(trains, snap.from, snap.to)
  const stats = aggregateSegments(segmentObservations(trains), now)
  const headline = headlineOf(list)
  const lines = [
    `${snap.from} → ${snap.to} · recorded ${fmt(Date.parse(snap.recordedAt))} · now ${fmt(now)} · ${snap.journeys.length} journeys`,
    `stations: ${corridorStations(list, snap.from, snap.to).join(' · ')}`,
    `headline: ${JSON.stringify({ ...headline, train: undefined })}`,
    `officially late somewhere in the last hour: ${officiallyLateCount(trains, now)}`,
    '',
    ...list.map((c) => {
      const s = c.state
      const w = arrivalWindow(c, snap.to, trains, now)
      const state =
        s.kind === 'measured'
          ? `${signed(s.delay)} ${s.verdict} at ${s.at} (${s.stopsAway} away) trail ${s.trail.map(signed).join(' ')}`
          : s.kind
      const win = w ? ` → ${fmt(w.lower)}${w.upper ? `–${fmt(w.upper)}` : ''} (n=${w.sample})` : ''
      return `${c.group.padEnd(11)} ${fmt(c.train.calls.find((x) => x.station === snap.from)?.aimedDeparture)} ${c.train.line.padEnd(5)} ${c.train.number.padEnd(5)} ${c.train.destination.padEnd(16)} ${c.cancelled ? 'CANCELLED ' : ''}${state}${win}`
    }),
    '',
    'segments (n ≥ 4 first):',
    ...[...stats.values()]
      .sort((a, b) => (b.band !== 'few' ? 1 : 0) - (a.band !== 'few' ? 1 : 0) || b.added - a.added)
      .map((s) => `  ${s.band.padEnd(12)} ${signed(s.added).padStart(6)} n=${String(s.n).padStart(2)}  ${s.a} → ${s.b}`),
  ]
  return <pre className="num overflow-x-auto p-4 text-xs leading-5 text-ink">{lines.join('\n')}</pre>
}
