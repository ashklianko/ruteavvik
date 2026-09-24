import type { ArrivalWindow, CorridorTrain, Visible } from '../data/derive.ts'
import { indexOf } from '../data/derive.ts'
import { relevantNotices } from '../data/notices.ts'
import { NoticeTags } from './Notices.tsx'
import { TrainDetail } from './TrainDetail.tsx'
import { lineColour } from '../diagram/palette.ts'
import { delayWords, fmtTime, signed, STATE_WORDS, stopsAway } from '../format.ts'

interface Props {
  list: CorridorTrain[]
  from: string | null
  to: string | null
  later: Visible
  windowFor: (ct: CorridorTrain) => ArrivalWindow | null
  selected: string | null
  hovered: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
}

function stateText(ct: CorridorTrain): React.ReactNode {
  const s = ct.state
  if (ct.cancelled) return <span className="text-late-3">cancelled</span>
  if (s.kind === 'starts-here') return STATE_WORDS.startsHere
  if (s.kind === 'not-departed') return STATE_WORDS.notDeparted
  const where = ct.group === 'ahead' ? `past ${s.at}` : s.stopsAway <= 0 ? stopsAway(0, s.standing) : `at ${s.at}, ${stopsAway(s.stopsAway, s.standing)}`
  return (
    <>
      <span className="text-ink">{delayWords(s.delay)}</span>, {s.verdict}, {where}
      {s.trail.length > 1 && <span className="num ml-2 text-ink-muted opacity-80">{s.trail.map(signed).join('  ')}</span>}
    </>
  )
}

function Row({ ct, from, to, windowFor, selected, hovered, onSelect, onHover }: { ct: CorridorTrain } & Omit<Props, 'list' | 'later'>) {
  const id = ct.train.id
  const isSel = selected === id
  const isHover = hovered === id
  const call = from ? ct.train.calls[indexOf(ct.train, from)] : undefined
  const quiet = ct.state.kind !== 'measured' && !ct.cancelled
  return (
    <li id={`train-${encodeURIComponent(id)}`}>
      <button
        type="button"
        className={`row ${isSel ? 'row-selected' : ''} ${isHover ? 'row-hover' : ''} ${quiet ? 'row-quiet' : ''}`}
        aria-expanded={isSel}
        onClick={() => onSelect(isSel ? null : id)}
        onMouseEnter={() => onHover(id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(id)}
        onBlur={() => onHover(null)}
      >
        <span className="num text-ink-muted">
          {call?.aimedDeparture ? (
            <>
              {fmtTime(ct.state.kind === 'measured' ? call.aimedDeparture + ct.state.delay * 1000 : call.aimedDeparture)}
              {ct.state.kind === 'measured' && Math.abs(ct.state.delay) > 60 && <span className="row-timetable">{fmtTime(call.aimedDeparture)}</span>}
            </>
          ) : (
            '—'
          )}
        </span>
        <span className="line" style={{ color: lineColour(ct.train.line) }}>
          {ct.train.line}
        </span>
        <span className="num">{ct.train.number}</span>
        <span className={`truncate ${ct.cancelled ? 'line-through text-ink-faint' : ''}`}>
          <span className="text-ink-muted">{ct.train.calls[0]?.station}</span> – {ct.train.destination}
          {call?.platform && (
            <span className="detail-platform" title={`Platform ${call.platform} at ${from}`}>
              pl. {call.platform}
            </span>
          )}
        </span>
        <span className="state">
          {stateText(ct)}
          <NoticeTags notices={relevantNotices(ct.train, from, to)} />
        </span>
      </button>
      {isSel && to && <TrainDetail ct={ct} from={from ?? undefined} to={to} window={windowFor(ct)} />}
    </li>
  )
}

export function TrainList({ list, from, to, later, windowFor, selected, hovered, onSelect, onHover }: Props) {
  const approaching = list.filter((c) => c.group === 'approaching')
  const ahead = list.filter((c) => c.group === 'ahead')
  if (list.length === 0 && later.laterCount === 0) return null
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ol className="list" aria-label="Approaching trains">
        {approaching.map((ct) => (
          <Row key={ct.train.id} ct={ct} from={from} to={to} windowFor={windowFor} selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover} />
        ))}
      </ol>
      {later.laterCount > 0 && later.laterUntil !== null && (
        <p className="text-sm text-ink-faint">
          {later.laterCount === 1 ? 'One more train' : `${later.laterCount} more trains`} by timetable until{' '}
          <span className="num">{fmtTime(later.laterUntil)}</span>, not running yet. They appear here once measured.
        </p>
      )}
      {ahead.length > 0 && (
        <>
          <p className="text-sm text-ink-faint">Already past {from}</p>
          <ol className="list" aria-label="Trains ahead of you">
            {ahead.map((ct) => (
              <Row key={ct.train.id} ct={ct} from={from} to={to} windowFor={windowFor} selected={selected} hovered={hovered} onSelect={onSelect} onHover={onHover} />
            ))}
          </ol>
        </>
      )}
    </div>
  )
}
