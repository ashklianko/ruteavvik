import type { ArrivalWindow, CorridorTrain, Headline as H, StationMood } from '../data/derive.ts'
import { MoodChip } from './MoodChip.tsx'
import { isDisruptive, relevantNotices } from '../data/notices.ts'
import { CALM_S, indexOf } from '../data/derive.ts'
import { delayWords, fmtTime, inWords, STATE_WORDS, windowWords } from '../format.ts'

interface Props {
  h: H
  from: string | null
  to: string | null
  following: CorridorTrain[]
  skipped?: CorridorTrain[]
  mood: StationMood | null
  lines?: string[]
  now: number
  selected?: CorridorTrain | null
  window?: ArrivalWindow | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
  onClear?: () => void
}

function scheduledAt(ct: CorridorTrain, from: string): number | null {
  const call = ct.train.calls[indexOf(ct.train, from)]
  return call?.aimedDeparture ?? null
}

function heroTime(ct: CorridorTrain, from: string): number | null {
  const sched = scheduledAt(ct, from)
  if (sched === null) return null
  return ct.state.kind === 'measured' ? sched + ct.state.delay * 1000 : sched
}

const atPlatform = (ct: CorridorTrain) => ct.state.kind === 'measured' && ct.state.standing && ct.state.stopsAway <= 0

function platformAt(ct: CorridorTrain, from: string): string | null {
  return ct.train.calls[indexOf(ct.train, from)]?.platform ?? null
}

function route(ct: CorridorTrain, from: string): string {
  const platform = platformAt(ct, from)
  return `${ct.train.line} to ${ct.train.destination}${platform ? `, pl. ${platform}` : ''}`
}

function arrivalAt(ct: CorridorTrain, to: string, window: ArrivalWindow | null): number | null {
  if (window) return window.lower
  const call = ct.train.calls[indexOf(ct.train, to)]
  return call?.aimedArrival ?? call?.aimedDeparture ?? null
}

function status(ct: CorridorTrain): string | null {
  const { state } = ct
  if (state.kind === 'starts-here') return STATE_WORDS.startsHere
  if (state.kind === 'not-departed') return STATE_WORDS.timetableOnly
  if (Math.abs(state.delay) <= CALM_S) return null
  return delayWords(state.delay)
}

function disruption(ct: CorridorTrain, from: string, to: string) {
  return relevantNotices(ct.train, from, to).find(isDisruptive) ?? null
}

function HeroNotice({ ct, from, to }: { ct: CorridorTrain; from: string; to: string }) {
  const n = disruption(ct, from, to)
  if (!n) return null
  return (
    <p className="hero-notice" title={`${n.summary}. ${n.description} ${n.advice}`.trim()}>
      <strong>{n.summary}.</strong> {n.advice || n.description}
    </p>
  )
}

function Skipped({ trains, from }: { trains: CorridorTrain[]; from: string }) {
  if (trains.length === 0) return null
  return (
    <p className="hero-notice">
      <strong>Cancelled:</strong>
      <span>
        {trains.map((ct) => {
          const t = scheduledAt(ct, from)
          return `${t !== null ? fmtTime(t) : '—'} ${ct.train.line}`
        }).join(', ')}
      </span>
    </p>
  )
}

function ThenItem({ ct, from, to, onHover, onSelect }: { ct: CorridorTrain; from: string; to: string; onHover: Props['onHover']; onSelect: Props['onSelect'] }) {
  const t = heroTime(ct, from)
  const n = disruption(ct, from, to)
  const s = ct.state
  const late = s.kind === 'measured' && Math.abs(s.delay) > CALM_S
  return (
    <button
      type="button"
      className="then-item"
      onMouseEnter={() => onHover(ct.train.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(ct.train.id)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(ct.train.id)}
      aria-label={`Show train ${ct.train.number} in the list`}
    >
      <span className="num link-time">{t !== null ? fmtTime(t) : '—'}</span>
      {late && (
        <span>
          {' '}({delayWords(s.delay)})
        </span>
      )}
      {s.kind !== 'measured' && <span> timetable</span>}
      {n && (
        <span className={`notice-${n.kind}`} title={n.summary}>
          {' '}
          <span className="notice-icon" aria-label={n.summary}>
            {n.kind === 'cancelled' ? '✕' : '!'}
          </span>
        </span>
      )}
    </button>
  )
}

function SelectedHero({ ct, from, to, window, mood, lines, now, onHover, onSelect, onClear }: { ct: CorridorTrain; from: string; to: string; window: ArrivalWindow | null } & Pick<Props, 'mood' | 'lines' | 'now' | 'onHover' | 'onSelect' | 'onClear'>) {
  const t = heroTime(ct, from)
  const standing = atPlatform(ct)
  const gone = ct.group === 'gone'
  const arrival = arrivalAt(ct, to, window)
  const late = ct.cancelled ? 'cancelled' : status(ct)
  const measured = ct.state.kind === 'measured'
  const shifted = ct.state.kind === 'measured' && Math.abs(ct.state.delay) > 60
  const sched = scheduledAt(ct, from)
  const schedArrival = arrivalAt(ct, to, null)
  return (
    <div className="hero">
      <div className="hero-line">
        {mood && <MoodChip mood={mood} station={from} lines={lines ?? []} />}
        <button
          type="button"
          className="hero-button"
          onMouseEnter={() => onHover(ct.train.id)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(ct.train.id)}
          onBlur={() => onHover(null)}
          onClick={() => (onClear ? onClear() : onSelect(ct.train.id))}
          aria-label={`Back to the next departure`}
          title="Back to next"
        >
          <span className="hero-next">{gone ? 'Left' : 'Leaves'}</span>
          <span className="hero-stack">
            <span className={`hero-time link-time ${standing ? '' : 'num'}`}>{standing ? 'Now' : t !== null ? fmtTime(t) : '—'}</span>
            {shifted && !standing && sched !== null && <s className="hero-sched num">{fmtTime(sched)}</s>}
          </span>
          {!standing && !gone && t !== null && <span className="hero-in">({inWords(t, now)})</span>}
          <span className="hero-next">arrives</span>
          <span className="hero-stack">
            <span className="hero-time num">{arrival !== null ? fmtTime(arrival) : '—'}</span>
            {shifted && schedArrival !== null && arrival !== null && schedArrival !== arrival && <s className="hero-sched num">{fmtTime(schedArrival)}</s>}
          </span>
          <span className="hero-chevron hero-close" aria-hidden="true">×</span>
        </button>
      </div>
      <p className="hero-then hero-selected" title={window ? windowWords(window.lower, window.upper, window.sample, to) : undefined}>
        <span className="hero-selected-text">
          <span className="text-ink-muted">{route(ct, from)}</span>
          {late && <span className="hero-late"> · {late}</span>}
          {window?.upper !== null && window?.upper !== undefined && (
            <span>
              {' · '}
              <span className="num">{fmtTime(window.lower)}–{fmtTime(window.upper)}</span> from the last {window.sample} trains
            </span>
          )}
          {!measured && <span> · timetable</span>}
        </span>
        {onClear && (
          <button type="button" className="then-item" onClick={onClear}>
            <span className="link-time">Back to next</span>
          </button>
        )}
      </p>
      <HeroNotice ct={ct} from={from} to={to} />
    </div>
  )
}

export function Headline({ h, from, to, following, skipped = [], mood, lines = [], now, selected = null, window = null, onHover, onSelect, onClear }: Props) {
  if (!from || !to) return <p className="headline">Pick where you are and where you are going.</p>
  if (selected) return <SelectedHero ct={selected} from={from} to={to} window={window} mood={mood} lines={lines} now={now} onHover={onHover} onSelect={onSelect} onClear={onClear} />
  if (h.kind === 'none') return <p className="headline">Nothing running from {from} to {to} right now.</p>

  const next = 'train' in h ? h.train : null
  if (!next) return <p className="headline">Nothing running from {from} to {to} right now.</p>
  const t = heroTime(next, from)
  const standing = atPlatform(next)
  const late = status(next)

  return (
    <div className="hero">
      <div className="hero-line">
        {mood && <MoodChip mood={mood} station={from} lines={lines} />}
        <button
          type="button"
          className="hero-button"
          onMouseEnter={() => onHover(next.train.id)}
          onMouseLeave={() => onHover(null)}
          onFocus={() => onHover(next.train.id)}
          onBlur={() => onHover(null)}
          onClick={() => onSelect(next.train.id)}
          aria-label={`Show train ${next.train.number} in the list`}
        >
          <span className="hero-next">Next</span>
          <span className={`hero-time link-time ${standing ? '' : 'num'}`}>{standing ? 'Now' : t !== null ? fmtTime(t) : '—'}</span>
          {!standing && t !== null && <span className="hero-in">({inWords(t, now)})</span>}
          <span className="hero-why" title={`${route(next, from)}${late ? `, ${late}` : ''}`}>
            {route(next, from)}
            {late && <span className="hero-late"> · {late}</span>}
            <span className="hero-chevron" aria-hidden="true">
              {' '}
              ›
            </span>
          </span>
        </button>
      </div>
      <Skipped trains={skipped} from={from} />
      <HeroNotice ct={next} from={from} to={to} />
      {following.length > 0 && (
        <p className="hero-then">
          Then{' '}
          {following.map((ct, i) => (
            <span key={ct.train.id}>
              {i > 0 && ', '}
              <ThenItem ct={ct} from={from} to={to} onHover={onHover} onSelect={onSelect} />
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
