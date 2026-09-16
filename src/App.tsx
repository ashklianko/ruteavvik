import { useEffect, useMemo, useState } from 'react'
import { aggregateSegments, arrivalWindow, corridorStations, corridorTrains, headlineOf, officiallyLateCount, pickUpstreamRows, segmentObservations, servesCorridor, trainsAsOf, upstreamOrder, visibleTrains } from './data/derive.ts'
import type { CorridorTrain } from './data/derive.ts'
import { trainsFromSnapshot } from './data/model.ts'
import { snapshotParam, useCorridor, useNow, useStations } from './data/useCorridor.ts'
import { Debug } from './debug/Debug.tsx'
import { Marey } from './diagram/Marey.tsx'
import { Spine } from './diagram/Spine.tsx'
import { fmtClock, fmtTime, signed } from './format.ts'
import { usePair } from './state/pair.ts'
import { Headline } from './ui/Headline.tsx'
import { Selector } from './ui/Selector.tsx'
import { TrainList } from './ui/TrainList.tsx'

type View = 'now' | 'timeline' | 'debug'

function viewFromHash(): View {
  const h = window.location.hash
  return h === '#debug' ? 'debug' : h === '#timeline' ? 'timeline' : 'now'
}

function useView(): View {
  const [view, setView] = useState<View>(viewFromHash)
  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return view
}

export function App() {
  const view = useView()
  if (view === 'debug') return <Debug />
  return <Corridor view={view} />
}

function Corridor({ view }: { view: View }) {
  const [pair, setPair] = usePair()
  const stations = useStations()
  const snapshot = snapshotParam()
  const from = stations.data?.find((s) => s.name === pair.from) ?? null
  const corridor = useCorridor(from, pair.to)
  const wallClock = useNow()
  const [selected, setSelected] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const [scrub, setScrub] = useState<number | null>(null)
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem('ruteavvik.hinted')
    } catch {
      return true
    }
  })
  const dismissHint = () => {
    if (!hint) return
    setHint(false)
    try {
      localStorage.setItem('ruteavvik.hinted', '1')
    } catch {
      /* storage unavailable */
    }
  }

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
  const liveNow = snapshot && snap ? Date.parse(snap.recordedAt) : wallClock
  const now = scrub ?? liveNow

  const liveTrains = useMemo(() => (snap ? trainsFromSnapshot(snap) : []), [snap])
  const trains = useMemo(() => (scrub !== null ? trainsAsOf(liveTrains, scrub) : liveTrains), [liveTrains, scrub])
  const fullList = useMemo(() => (fromName && toName ? corridorTrains(trains, fromName, toName) : []), [trains, fromName, toName])
  const available = useMemo(() => [...new Set(fullList.map((c) => c.train.line))].sort(), [fullList])
  const filtered = useMemo(() => (pair.lines.length ? fullList.filter((c) => pair.lines.includes(c.train.line)) : fullList), [fullList, pair.lines])
  const visible = useMemo(() => visibleTrains(filtered, now), [filtered, now])
  const list = visible.shown
  const corridorRows = useMemo(() => (fromName && toName ? corridorStations(fullList, fromName, toName) : []), [fullList, fromName, toName])
  const relevant = useMemo(() => fullList.map((c) => c.train), [fullList])
  const servingAll = useMemo(() => (fromName && toName ? liveTrains.filter((t) => servesCorridor(t, fromName, toName)) : []), [liveTrains, fromName, toName])
  const upOrder = useMemo(() => (fromName ? upstreamOrder(relevant, fromName) : []), [relevant, fromName])
  const upRows = useMemo(() => (fromName ? pickUpstreamRows(upOrder, relevant, fromName) : []), [upOrder, relevant, fromName])
  const observations = useMemo(() => segmentObservations(trains), [trains])
  const segments = useMemo(() => aggregateSegments(observations, now), [observations, now])
  const mareyRows = useMemo(() => [...upRows].reverse().concat(corridorRows), [upRows, corridorRows])
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
          dismissHint()
          setPair(next)
        }}
      />

      <Headline h={headline} from={fromName} to={toName} />

      <nav className="mb-3 flex gap-4 text-sm" aria-label="View">
            <a href="#" className={`view ${view === 'now' ? 'view-current' : ''}`} aria-current={view === 'now' ? 'page' : undefined}>
              Now
            </a>
            <a href="#timeline" className={`view ${view === 'timeline' ? 'view-current' : ''}`} aria-current={view === 'timeline' ? 'page' : undefined}>
              Last hour
            </a>
          </nav>
      {view === 'timeline' ? (
        <>
          <div className="grid gap-8 min-[900px]:grid-cols-2">
            <div className="min-w-0">
              {view === 'timeline' && fromName && toName && (
                          <Marey
                            from={fromName}
                            to={toName}
                            rows={mareyRows}
                            trains={servingAll}
                            now={liveNow}
                            selected={selected}
                            hovered={hovered}
                            onSelect={setSelected}
                            onHover={setHovered}
                            scrub={scrub}
                            onScrub={setScrub}
                            ariaLabel={`Time chart from ${fromName} to ${toName}: ${servingAll.length} trains over the last hundred minutes, recorded times as solid lines, timetable dashed.`}
                          />
                        )}
              {view === 'timeline' && fromName && toName && (
                          <p className="mt-1 mb-3 text-sm text-ink-faint">
                            {scrub !== null ? (
                              <>
                                Below, the line as it was at <span className="num text-ink">{fmtTime(scrub)}</span>.
                              </>
                            ) : (
                              'Move along the time axis to see the line as it was at that moment.'
                            )}
                          </p>
                        )}
            </div>
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
                          onSelect={(id) => {
                            dismissHint()
                            setSelected(id)
                          }}
                          onHover={setHovered}
                          ariaLabel={ariaLabel}
                        />
            </div>
          </div>
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
                          Updated <span className="num">{fmtClock(snapshot ? liveNow : corridor.dataUpdatedAt)}</span>
                          {snapshot ? ' from a recorded snapshot' : ''}.{' '}
                          Solid lines are recorded times, dashed is the timetable, dotted carries the current delay forward. The gap between dashed and solid is the delay.
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
          <div className="max-w-2xl">
            <TrainList list={list} from={fromName} to={toName} later={visible} windowFor={windowFor} selected={selected} hovered={hovered} onSelect={setSelected} onHover={setHovered} />
          </div>
        </>
      ) : (
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
                        onSelect={(id) => {
                          dismissHint()
                          setSelected(id)
                        }}
                        onHover={setHovered}
                        ariaLabel={ariaLabel}
                      />
            {hint && fromName && toName && list.length > 0 && (
                        <p className="mt-1 text-sm text-ink-muted">On the line means on time. Drifting right means late, by the minutes on the scale. Tap a train to follow it.</p>
                      )}
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
                            Updated <span className="num">{fmtClock(snapshot ? liveNow : corridor.dataUpdatedAt)}</span>
                            {snapshot ? ' from a recorded snapshot' : ''}.{' '}
                            Segments coloured by the delay they add, measured over the last hour, grey below four trains.
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
      )}
    </main>
  )
}
