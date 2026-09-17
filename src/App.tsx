import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { aggregateSegments, arrivalWindow, corridorStations, corridorTrains, headlineOf, officiallyLateCount, pickUpstreamRows, segmentObservations, servesCorridor, stationMood, trainsAsOf, upstreamOrder, upstreamRowCount, visibleTrains } from './data/derive.ts'
import type { CorridorTrain } from './data/derive.ts'
import { trainsFromSnapshot } from './data/model.ts'
import { POLL_MS, snapshotParam, useCorridor, useNow, useStations } from './data/useCorridor.ts'
import { Debug } from './debug/Debug.tsx'
import { axisMax as pickAxisMax } from './data/displacement.ts'
import { Marey } from './diagram/Marey.tsx'
import { familyOf } from './diagram/palette.ts'
import { Spine } from './diagram/Spine.tsx'
import { SpineH } from './diagram/SpineH.tsx'
import { usePatterns } from './data/usePatterns.ts'

const RouteMap = lazy(() => import('./map/RouteMap.tsx'))
import { fmtTime } from './format.ts'
import { usePair } from './state/pair.ts'
import { Emblem } from './ui/Emblem.tsx'
import { Headline } from './ui/Headline.tsx'
import { Caption } from './ui/Caption.tsx'
import { Selector } from './ui/Selector.tsx'
import { Status } from './ui/Status.tsx'
import { TrainList } from './ui/TrainList.tsx'

type View = 'now' | 'timeline' | 'map' | 'debug'
type Orientation = 'wide' | 'tall'

function viewFromHash(): View {
  const h = window.location.hash
  return h === '#debug' ? 'debug' : h === '#timeline' ? 'timeline' : h === '#map' ? 'map' : 'now'
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

const WIDE_MIN = 900

type OrientationChoice = { orientation: Orientation; wideScreen: boolean }

function useOrientation(): [Orientation, () => void] {
  const [chosen, setChosen] = useState<OrientationChoice | null>(() => {
    try {
      const raw = localStorage.getItem('ruteavvik.orientation')
      if (!raw) return null
      const v = JSON.parse(raw) as Partial<OrientationChoice>
      return (v.orientation === 'wide' || v.orientation === 'tall') && typeof v.wideScreen === 'boolean' ? { orientation: v.orientation, wideScreen: v.wideScreen } : null
    } catch {
      return null
    }
  })
  const [wideScreen, setWideScreen] = useState(() => window.innerWidth >= WIDE_MIN)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${WIDE_MIN}px)`)
    const onChange = () => setWideScreen(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  const orientation: Orientation = chosen !== null && chosen.wideScreen === wideScreen ? chosen.orientation : wideScreen ? 'wide' : 'tall'
  const toggle = () => {
    const next: OrientationChoice = { orientation: orientation === 'wide' ? 'tall' : 'wide', wideScreen }
    setChosen(next)
    try {
      localStorage.setItem('ruteavvik.orientation', JSON.stringify(next))
    } catch {
      /* storage unavailable */
    }
  }
  return [orientation, toggle]
}

function useMinWidth(px: number): boolean {
  const [ok, setOk] = useState(() => window.innerWidth >= px)
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`)
    const onChange = () => setOk(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [px])
  return ok
}


export function App() {
  const view = useView()
  if (view === 'debug') return <Debug />
  return <Corridor view={view} />
}

function Corridor({ view }: { view: View }) {
  const [orientation, toggleOrientation] = useOrientation()
  const compact = !useMinWidth(WIDE_MIN)
  const sideBySide = useMinWidth(1100)
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
  const reveal = (id: string) =>
    requestAnimationFrame(() => document.getElementById(`train-${encodeURIComponent(id)}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  const selectAndReveal = (id: string | null) => {
    dismissHint()
    setSelected(id)
    if (id) reveal(id)
  }
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
  const fromName = snapshot ? (snap?.from ?? pair.from) : pair.from
  const toName = snapshot ? (snap?.to ?? pair.to) : pair.to
  const coarseClock = Math.floor(wallClock / 10_000) * 10_000
  const liveNow = snapshot && snap ? Date.parse(snap.recordedAt) : coarseClock
  const now = scrub ?? liveNow
  const ghostNow = snapshot && snap ? liveNow : scrub ?? wallClock

  const liveTrains = useMemo(() => (snap ? trainsFromSnapshot(snap) : []), [snap])
  const trains = useMemo(() => (scrub !== null ? trainsAsOf(liveTrains, scrub) : liveTrains), [liveTrains, scrub])
  const fullList = useMemo(() => (fromName && toName ? corridorTrains(trains, fromName, toName) : []), [trains, fromName, toName])
  const available = useMemo(() => [...new Set(fullList.map((c) => c.train.line))].sort(), [fullList])
  const filtered = useMemo(() => (pair.lines.length ? fullList.filter((c) => pair.lines.includes(c.train.line)) : fullList), [fullList, pair.lines])
  const visible = useMemo(() => visibleTrains(filtered, now), [filtered, now])
  const list = visible.shown
  const corridorRows = useMemo(() => (fromName && toName ? corridorStations(filtered, fromName, toName) : []), [filtered, fromName, toName])
  const relevant = useMemo(() => filtered.map((c) => c.train), [filtered])
  const servingAll = useMemo(
    () => (fromName && toName ? liveTrains.filter((t) => servesCorridor(t, fromName, toName) && (pair.lines.length === 0 || pair.lines.includes(t.line))) : []),
    [liveTrains, fromName, toName, pair.lines],
  )
  const upOrder = useMemo(() => (fromName ? upstreamOrder(relevant, fromName) : []), [relevant, fromName])
  const upRows = useMemo(
    () => (fromName ? pickUpstreamRows(upOrder, relevant, fromName, upstreamRowCount(Math.max(1, corridorRows.length - 1))) : []),
    [upOrder, relevant, fromName, corridorRows],
  )
  const observations = useMemo(() => segmentObservations(trains), [trains])
  const segments = useMemo(() => aggregateSegments(observations, now), [observations, now])
  const mareyRows = useMemo(() => [...upRows].reverse().concat(corridorRows), [upRows, corridorRows])
  const patterns = usePatterns(view === 'map' ? relevant : [])
  const minorStations = useMemo(() => {
    const regional = relevant.filter((t) => familyOf(t.line) === 'regional' || familyOf(t.line) === 'airport')
    if (regional.length === 0) return new Set<string>()
    const served = new Set<string>()
    for (const t of regional) for (const call of t.calls) served.add(call.station)
    const out = new Set<string>()
    for (const station of [...upRows, ...corridorRows]) {
      if (station === fromName || station === toName) continue
      if (!served.has(station)) out.add(station)
    }
    return out
  }, [relevant, upRows, corridorRows, fromName, toName])
  const headline = useMemo(() => headlineOf(list), [list])
  const axisMax = useMemo(() => pickAxisMax(list.flatMap((c) => (c.state.kind === 'measured' ? [c.state.delay] : []))), [list])
  const mood = useMemo(() => (fromName && snap ? stationMood(trains, fromName, now) : null), [trains, fromName, now, snap])
  const following = useMemo(() => {
    const approaching = list.filter((c) => c.group === 'approaching' && !c.cancelled)
    const next = 'train' in headline ? headline.train : approaching[0]
    return approaching.filter((c) => c !== next).slice(0, 2)
  }, [list, headline])
  const windowFor = (ct: CorridorTrain) => (toName ? arrivalWindow(ct, toName, trains, now) : null)
  const headlineWindow = 'train' in headline ? windowFor(headline.train) : null
  const lateCount = useMemo(() => officiallyLateCount(trains, now), [trains, now])

  const ariaLabel = (() => {
    if (!fromName || !toName) return 'Empty line diagram. Pick a station pair to see trains.'
    const measured = list.filter((c) => c.state.kind === 'measured')
    return `Line diagram from ${fromName} to ${toName}: ${list.length} trains, ${measured.length} measured.`
  })()

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-5 px-4 py-6 sm:px-8">
      <header className="flex justify-center">
        <a href={window.location.search} className="brand" aria-label="Ruteavvik, home">
          <Emblem />
          <span className="wordmark">Ruteavvik</span>
        </a>
      </header>

      <div className="grid items-start gap-x-8 gap-y-4 min-[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Selector
          stations={stations.data ?? []}
          from={pair.from}
          to={pair.to}
          lines={pair.lines}
          available={available}
          onChange={(next) => {
            setSelected(null)
            dismissHint()
            setPair('from' in next || 'to' in next ? { ...next, lines: [] } : next)
          }}
        />
        <Headline
          h={headline}
          from={fromName}
          to={toName}
          following={following}
          mood={mood}
          onHover={setHovered}
          onSelect={selectAndReveal}
        />
      </div>

      <nav className="mb-3 flex gap-4 text-sm" aria-label="View">
            <a href="#now" className={`view ${view === 'now' ? 'view-current' : ''}`} aria-current={view === 'now' ? 'page' : undefined}>
              Now
            </a>
            <a href="#timeline" className={`view ${view === 'timeline' ? 'view-current' : ''}`} aria-current={view === 'timeline' ? 'page' : undefined}>
              Last hour
            </a>
            <a href="#map" className={`view ${view === 'map' ? 'view-current' : ''}`} aria-current={view === 'map' ? 'page' : undefined}>
              Map
            </a>
            {view === 'now' && (
              <button type="button" className="view view-toggle" onClick={toggleOrientation} title={orientation === 'wide' ? 'Switch to the vertical layout' : 'Switch to the horizontal layout'}>
                {orientation === 'wide' ? '⇅ vertical' : '⇆ horizontal'}
              </button>
            )}
          </nav>
      {view === 'map' ? (
        fromName && toName ? (
          <Suspense fallback={<p className="text-sm text-ink-faint">Loading the map.</p>}>
            <RouteMap
              from={fromName}
              to={toName}
              list={list}
              patterns={patterns.data ?? new Map()}
              segments={segments}
              corridor={corridorRows}
              upstreamRows={upRows}
              now={now}
              ghostNow={ghostNow}
              selected={selected}
              hovered={hovered}
              onSelect={setSelected}
              onHover={setHovered}
              windowFor={windowFor}
            />
          </Suspense>
        ) : (
          <p className="text-sm text-ink-faint">Pick a pair to see the map.</p>
        )
      ) : view === 'now' && orientation === 'wide' ? (
        <div className="grid flex-1 gap-8 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
          <div className="min-w-0">
          <SpineH
            from={fromName}
            to={toName}
            corridor={corridorRows}
            upstreamOrder={upOrder}
            upstreamRows={upRows}
            list={list}
            segments={segments}
            observations={observations}
            now={now}
            minor={minorStations}
            axisMax={axisMax}
            narrow={sideBySide}
            ariaLabel={ariaLabel}
            selected={selected}
            hovered={hovered}
            onSelect={selectAndReveal}
            onHover={setHovered}
          />
          {hint && fromName && toName && list.length > 0 && (
            <p className="mt-1 text-sm text-ink-muted">On the line means on time. Higher means later, by the minutes on the scale. Tap a train to follow it.</p>
          )}
          <Caption to={toName} window={headlineWindow} lateCount={lateCount} legend="segments" loaded={Boolean(corridor.dataUpdatedAt)} fetching={corridor.isFetching} stationsFailed={stations.isError} />
          </div>
          <TrainList list={list} from={fromName} to={toName} later={visible} windowFor={windowFor} selected={selected} hovered={hovered} onSelect={setSelected} onHover={setHovered} />
        </div>
      ) : view === 'timeline' ? (
        <>
          <div className="grid gap-8 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
            {!compact && (
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
                          minor={minorStations}
                          axisMax={axisMax}
                          compact={compact}
                          now={now}
                          ghostNow={ghostNow}
                          selected={selected}
                          hovered={hovered}
                          onSelect={selectAndReveal}
                          onHover={setHovered}
                          ariaLabel={ariaLabel}
                        />
            </div>
            )}
          </div>
          <Caption to={toName} window={headlineWindow} lateCount={lateCount} legend="timeline" loaded={Boolean(corridor.dataUpdatedAt)} fetching={corridor.isFetching} stationsFailed={stations.isError} />
          <div className="max-w-2xl">
            <TrainList list={list} from={fromName} to={toName} later={visible} windowFor={windowFor} selected={selected} hovered={hovered} onSelect={setSelected} onHover={setHovered} />
          </div>
        </>
      ) : (
        <div className="grid flex-1 gap-8 min-[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
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
                        minor={minorStations}
                        axisMax={axisMax}
                        compact={compact}
                        now={now}
                        ghostNow={ghostNow}
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
            <Caption to={toName} window={headlineWindow} lateCount={lateCount} legend="segments" loaded={Boolean(corridor.dataUpdatedAt)} fetching={corridor.isFetching} stationsFailed={stations.isError} />
          </div>
          <TrainList list={list} from={fromName} to={toName} later={visible} windowFor={windowFor} selected={selected} hovered={hovered} onSelect={setSelected} onHover={setHovered} />
        </div>
      )}
      <Status
        updatedAt={snapshot ? liveNow : corridor.dataUpdatedAt || undefined}
        fetching={corridor.isFetching}
        error={corridor.isError}
        snapshot={snapshot !== null}
        pollMs={POLL_MS}
        now={wallClock}
        onRefresh={() => void corridor.refetch()}
      />
    </main>
  )
}
