import type { ArrivalWindow } from '../data/derive.ts'
import { MIN_PASSES, OFFICIAL_LATE_S } from '../data/derive.ts'
import { fmtTime } from '../format.ts'

interface Props {
  to: string | null
  window: ArrivalWindow | null
  lateCount: number
  legend: 'segments' | 'timeline'
  loaded: boolean
  fetching: boolean
  stationsFailed: boolean
}

const LEGEND = {
  segments: `Segments coloured by the delay they add, measured over the last hour, grey below ${MIN_PASSES} trains.`,
  timeline: 'Solid lines are recorded times, dashed is the timetable, dotted carries the current delay forward. The gap between dashed and solid is the delay.',
}

export function Caption({ to, window, lateCount, legend, loaded, fetching, stationsFailed }: Props) {
  if (!loaded) return <p className="mt-2 text-sm text-ink-faint">{fetching ? 'Asking Entur.' : stationsFailed ? 'Could not load the station list. Reload to try again.' : null}</p>
  return (
    <p className="mt-2 text-sm text-ink-faint">
      {window && to && (
        <>
          Next arrives {to} <span className="num text-ink-muted">{fmtTime(window.lower)}</span>
          {window.upper !== null ? (
            <>
              <span className="num text-ink-muted">–{fmtTime(window.upper)}</span>, from the last {window.sample} trains.{' '}
            </>
          ) : (
            <> if it does not catch up. </>
          )}
        </>
      )}
      {LEGEND[legend]}
      {lateCount > 0 && (
        <>
          {' '}
          In the last hour <span className="num">{lateCount}</span> {lateCount === 1 ? 'train was' : 'trains were'} more than {OFFICIAL_LATE_S / 60} minutes late at some stop; none of that counts if they recover by the end.
        </>
      )}
    </p>
  )
}
