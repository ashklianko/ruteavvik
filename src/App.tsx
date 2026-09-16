import { useEffect, useMemo, useState } from 'react'
import { aggregateSegments, arrivalWindow, corridorStations, corridorTrains, headlineOf, officiallyLateCount, pickUpstreamRows, segmentObservations, upstreamOrder, visibleTrains } from './data/derive.ts'
import type { CorridorTrain } from './data/derive.ts'
import { trainsFromSnapshot } from './data/model.ts'
import { snapshotParam, useCorridor, useNow, useStations } from './data/useCorridor.ts'
import { Debug } from './debug/Debug.tsx'
import { Spine } from './diagram/Spine.tsx'
import { fmtClock, fmtTime, signed } from './format.ts'
import { usePair } from './state/pair.ts'
import { Headline } from './ui/Headline.tsx'
import { Selector } from './ui/Selector.tsx'
import { TrainList } from './ui/TrainList.tsx'

export function App() {
  if (window.location.hash === '#debug') return <Debug />
  return <Corridor />
}

function Corridor() {
  const [pair, setPair] = usePair()
  const stations = useStations()
  const snapshot = snapshotParam()
  const from = stations.data?.find((s) => s.name === pair.from) ?? null
  const corridor = useCorridor(from, pair.to)
  const wallClock = useNow()
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const snap = corridor.data
  useEffect(() => {
    if (snapshot && snap && (pair.from !== snap.from || pair.to !== snap.to)) setPair({ from: snap.from, to: snap.to })
  }, [snapshot, snap, pair.from, pair.to, setPair])
  const fromName = snap?.from ?? pair.from
  const toName = snap?.to ?? pair.to
  const now = snapshot && snap ? Date.parse(snap.recordedAt) : wallClock

  const trains = useMemo(() => (snap ? trainsFromSnapshot(snap) : []), [snap])
  const fullList = useMemo(() => (fromName && toName ? corridorTrains(trains, fromName, toName) : []), [trains, fromName, toName])
  const available = useMemo(() => [...new Set(fullList.map((c) => c.train.line))].sort(), [fullList])
  const filtered = useMemo(() => (pair.lines.length ? fullList.filter((c) => pair.lines.includes(c.train.line)) : fullList), [fullList, pair.lines])
  const visible = useMemo(() => visibleTrains(filtered, now), [filtered, now])
  const list = visible.shown
  const corridorRows = useMemo(() => (fromName && toName ? corridorStations(fullList, fromName, toName) : []), [fullList, fromName, toName])
  const relevant = useMemo(() => fullList.map((c) => c.train), [fullList])
  const upOrder = useMemo(() => (fromName ? upstreamOrder(relevant, fromName) : []), [relevant, fromName])
  const upRows = useMemo(() => (fromName ? pickUpstreamRows(upOrder, relevant, fromName) : []), [upOrder, relevant, fromName])
  const observations = useMemo(() => segmentObservations(trains), [trains])
  const segments = useMemo(() => aggregateSegments(observations, now), [observations, now])
  const headline = useMemo(() => headlineOf(list), [list])
  const windowFor = (ct: CorridorTrain) => (toName ? arrivalWindow(ct, toName, trains, now) : null)
  const headlineWindow = 'train' in headline ? windowFor(headline.train) : null
  const lateCount = useMemo(() => officiallyLateCount(trains, now), [trains, now])

  const ariaLabel = (() => {
    if (!fromName || !toName) return 'Empty line diagram. Pick a station pair to see trains.'
    const measured = list.filter((c) => c.state.kind === 'measured')
    return `Line diagram from ${fromName} to ${toName}: ${list.length} trains, ${measured.length} measured.`
  })()

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 px-4 py-6 sm:px-8">
      <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h1 className="text-lg font-medium tracking-tight">Ruteavvik</h1>
        <p className="text-sm text-ink-muted">measured, never forecast</p>
      </header>

      <Selector
        stations={stations.data ?? []}
        from={pair.from}
        to={pair.to}
        lines={pair.lines}
        available={available}
        onChange={(next) => {
          setSelected(null)
          setPair(next)
        }}
      />

      <Headline h={headline} from={fromName} to={toName} />

      <div className="grid flex-1 gap-8 min-[900px]:grid-cols-[3fr_2fr]">
        <div className="min-w-0">
          <Spine
            from={fromName}
            to={toName}
            corridor={corridorRows}
            upstreamOrder={upOrder}
            upstreamRows={upRows}
            list={list}
            trains={trains}
            segments={segments}
            observations={observations}
            now={now}
            selected={selected}
            hovered={hovered}
            onSelect={setSelected}
            onHover={setHovered}
            ariaLabel={ariaLabel}
          />
          <p className="mt-2 text-sm text-ink-faint">
            {corridor.isError && corridor.dataUpdatedAt ? (
              <>Last update <span className="num">{fmtClock(corridor.dataUpdatedAt)}</span>. Retrying.</>
            ) : corridor.isError ? (
              'Entur did not answer. Retrying.'
            ) : corridor.dataUpdatedAt ? (
              <>
                {headlineWindow && (
                  <>
                    Next arrives {toName} <span className="num text-ink-muted">{fmtTime(headlineWindow.lower)}</span>
                    {headlineWindow.upper !== null ? (
                      <>
                        <span className="num text-ink-muted">–{fmtTime(headlineWindow.upper)}</span>, from the last {headlineWindow.sample} trains.{' '}
                      </>
                    ) : (
                      <> if it does not catch up. </>
                    )}
                  </>
                )}
                Updated <span className="num">{fmtClock(snapshot ? now : corridor.dataUpdatedAt)}</span>
                {snapshot ? ' from a recorded snapshot' : ''}. Segments coloured by the delay they add, measured over the last hour, grey below four trains.
                {lateCount > 0 && (
                  <>
                    {' '}
                    In the last hour <span className="num">{lateCount}</span> {lateCount === 1 ? 'train was' : 'trains were'} more than <span className="num">{signed(240)}</span> late at some stop; none of that counts if they recover by the end.
                  </>
                )}
              </>
            ) : corridor.isFetching ? (
              'Asking Entur.'
            ) : stations.isError ? (
              'Could not load the station list. Reload to try again.'
            ) : null}
          </p>
        </div>
        <TrainList list={list} from={fromName} to={toName} later={visible} windowFor={windowFor} selected={selected} hovered={hovered} onSelect={setSelected} onHover={setHovered} />
      </div>
    </main>
  )
}
