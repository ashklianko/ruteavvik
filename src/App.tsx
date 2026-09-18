import { lazy, Suspense, useEffect, useState } from 'react'
import { atParam, POLL_MS, snapshotParam, useCorridor, useNow, useStations } from './data/useCorridor.ts'
import { atClock } from './data/clock.ts'
import { Scenes } from './ui/Scenes.tsx'
import { Debug } from './debug/Debug.tsx'
import { Marey } from './diagram/Marey.tsx'
import { Spine } from './diagram/Spine.tsx'
import { SpineH } from './diagram/SpineH.tsx'
import { usePatterns } from './data/usePatterns.ts'
import { useCorridorModel } from './app/useCorridorModel.ts'

const RouteMap = lazy(() => import('./map/RouteMap.tsx'))
import { fmtTime } from './format.ts'
import { usePair } from './state/pair.ts'
import { Emblem } from './ui/Emblem.tsx'
import { Headline } from './ui/Headline.tsx'
import { Caption } from './ui/Caption.tsx'
import { Selector } from './ui/Selector.tsx'
import { DiagramSkeleton, HeadlineSkeleton, ListSkeleton, MapSkeleton } from './ui/Skeleton.tsx'
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
  const atStr = atParam()
  const at = snapshot !== null && snap && atStr ? atClock(snap.recordedAt, atStr) : null
  const m = useCorridorModel({ snap, snapshot: snapshot !== null, pairFrom: pair.from, pairTo: pair.to, lines: pair.lines, wallClock, scrub, at })
  const { fromName, toName, liveNow, now, ghostNow, list, visible, available, corridorRows, relevant, servingAll, upOrder, upRows, observations, segments, mareyRows, minorStations, headline, axisMax, mood, following, windowFor, headlineWindow, lateCount, ariaLabel } = m
  const patterns = usePatterns(view === 'map' ? relevant : [])

  const diagramProps = {
    from: fromName,
    to: toName,
    corridor: corridorRows,
    upstreamOrder: upOrder,
    upstreamRows: upRows,
    list,
    segments,
    observations,
    minor: minorStations,
    axisMax,
    now,
    ghostNow,
    selected,
    hovered,
    onSelect: selectAndReveal,
    onHover: setHovered,
    ariaLabel,
  }
  const selectedTrain = selected ? (list.find((c) => c.train.id === selected) ?? null) : null
  const listProps = { list, from: fromName, to: toName, later: visible, windowFor, selected, hovered, onSelect: setSelected, onHover: setHovered }
  const captionProps = { to: toName, window: headlineWindow, lateCount, loaded: Boolean(corridor.dataUpdatedAt), fetching: corridor.isFetching, stationsFailed: stations.isError }
  const loading = Boolean(fromName && toName) && !snap && !corridor.isError
  const hintText = orientation === 'wide' ? 'On the line means on time. Higher means later, by the minutes on the scale. Tap a train to follow it.' : 'On the line means on time. Drifting right means late, by the minutes on the scale. Tap a train to follow it.'
  const showHint = hint && fromName && toName && list.length > 0

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1600px] flex-col gap-5 px-4 pt-6 pb-14 sm:px-8">
      <header className="flex justify-center">
        <a href={window.location.search} className="brand" aria-label="Ruteavvik, home">
          <Emblem />
          <span className="wordmark">Ruteavvik</span>
        </a>
      </header>

      <div className="grid items-start gap-x-8 gap-y-4 min-[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Selector
          stations={stations.data ?? []}
          from={snapshot ? fromName : pair.from}
          to={snapshot ? toName : pair.to}
          lines={pair.lines}
          available={available}
          onChange={(next) => {
            setSelected(null)
            dismissHint()
            setPair('from' in next || 'to' in next ? { ...next, lines: [] } : next)
          }}
        />
        {loading ? (
          <HeadlineSkeleton />
        ) : snapshot !== null && corridor.isError ? (
          <p className="headline">
            No recording named <span className="num">{snapshot}</span> on this server. Recordings live in <span className="num">public/snapshots/</span>.
          </p>
        ) : (
        <Headline
          h={headline}
          from={fromName}
          to={toName}
          following={following}
          mood={mood}
          lines={pair.lines}
          now={snapshot ? liveNow : wallClock}
          selected={selectedTrain}
          window={selectedTrain ? windowFor(selectedTrain) : null}
          onHover={setHovered}
          onSelect={selectAndReveal}
          onClear={() => setSelected(null)}
        />
        )}
      </div>

      <nav className="mb-3 flex gap-4 text-sm" aria-label="View">
        <a href="#now" className={`view ${view === 'now' ? 'view-current' : ''}`} aria-current={view === 'now' ? 'page' : undefined}>
        Now
        </a>        <a href="#map" className={`view ${view === 'map' ? 'view-current' : ''}`} aria-current={view === 'map' ? 'page' : undefined}>
        Map
        </a>

        <a href="#timeline" className={`view ${view === 'timeline' ? 'view-current' : ''}`} aria-current={view === 'timeline' ? 'page' : undefined}>
        Last hour
        </a>
        {view === 'now' && (
        <button type="button" className="view view-toggle" onClick={toggleOrientation} title={orientation === 'wide' ? 'Switch to the vertical layout' : 'Switch to the horizontal layout'}>
        {orientation === 'wide' ? '⇅ vertical' : '⇆ horizontal'}
        </button>
        )}
      </nav>
      {view === 'map' ? (
        fromName && toName ? (
          loading ? (
            <MapSkeleton />
          ) : (
          <Suspense fallback={<MapSkeleton />}>
            <RouteMap
              from={fromName}
              to={toName}
              list={list}
              patterns={patterns.data ?? new Map()}
              segments={segments}
              corridor={corridorRows}
              upstreamRows={upRows}
              minor={minorStations}
              now={now}
              ghostNow={ghostNow}
              selected={selected}
              hovered={hovered}
              onSelect={setSelected}
              onHover={setHovered}
              windowFor={windowFor}
            />
          </Suspense>
          )
        ) : (
          <p className="text-sm text-ink-faint">Pick a pair to see the map.</p>
        )
      ) : view === 'now' && orientation === 'wide' ? (
        <div className="grid flex-1 gap-8 min-[1100px]:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)]">
          <div className="min-w-0">
            {loading ? <DiagramSkeleton wide /> : <SpineH {...diagramProps} narrow={sideBySide} />}
            {showHint && <p className="mt-1 text-sm text-ink-muted">{hintText}</p>}
            <Caption {...captionProps} legend="segments" />
          </div>
          {loading ? <ListSkeleton /> : <TrainList {...listProps} />}
        </div>
      ) : view === 'timeline' ? (
        <>
          <div className="grid gap-8 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0">
              {fromName && toName && (
                <>
                  <Marey
                    from={fromName}
                    to={toName}
                    rows={mareyRows}
                    trains={servingAll}
                    now={liveNow}
                    selected={selected}
                    hovered={hovered}
                    onSelect={selectAndReveal}
                    onHover={setHovered}
                    scrub={scrub}
                    onScrub={setScrub}
                    compact={compact}
                    ariaLabel={`Time chart from ${fromName} to ${toName}: ${servingAll.length} trains over the last hundred minutes, recorded times as solid lines, timetable dashed.`}
                  />
                  <p className="mt-1 mb-3 text-sm text-ink-faint">
                    {scrub !== null ? (
                      <>
                        Beside, the line as it was at <span className="num text-ink">{fmtTime(scrub)}</span>.
                      </>
                    ) : (
                      'Move along the time axis to see the line as it was at that moment.'
                    )}
                  </p>
                </>
              )}
            </div>
            {!compact && (
              <div className="min-w-0">
                <Spine {...diagramProps} />
              </div>
            )}
          </div>
          <Caption {...captionProps} legend="timeline" />
          <div className="max-w-2xl">{loading ? <ListSkeleton /> : <TrainList {...listProps} />}</div>
        </>
      ) : (
        <div className="grid flex-1 gap-8 min-[900px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="min-w-0">
            {loading ? <DiagramSkeleton wide={false} /> : <Spine {...diagramProps} compact={compact} />}
            {showHint && <p className="mt-1 text-sm text-ink-muted">{hintText}</p>}
            <Caption {...captionProps} legend="segments" />
          </div>
          {loading ? <ListSkeleton /> : <TrainList {...listProps} />}
        </div>
      )}
      <Status
        updatedAt={snapshot ? liveNow : corridor.dataUpdatedAt || undefined}
        fetching={corridor.isFetching}
        error={corridor.isError}
        snapshot={snapshot !== null}
        synthetic={snap?.synthetic ?? null}
        pollMs={POLL_MS}
        now={wallClock}
        onRefresh={() => void corridor.refetch()}
      />
      <Scenes snapshot={snapshot} />
    </main>
  )
}
