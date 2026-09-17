import type { CorridorTrain, Headline as H, StationMood } from '../data/derive.ts'
import { MoodChip } from './MoodChip.tsx'
import { relevantNotices } from '../data/notices.ts'
import { CALM_S, indexOf } from '../data/derive.ts'
import { delayWords, fmtTime, inWords, STATE_WORDS } from '../format.ts'

interface Props {
  h: H
  from: string | null
  to: string | null
  following: CorridorTrain[]
  mood: StationMood | null
  lines?: string[]
  now: number
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
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

function status(ct: CorridorTrain): string | null {
  const { state } = ct
  if (state.kind === 'starts-here') return STATE_WORDS.startsHere
  if (state.kind === 'not-departed') return STATE_WORDS.timetableOnly
  if (Math.abs(state.delay) <= CALM_S) return null
  return delayWords(state.delay)
}

function ThenItem({ ct, from, onHover, onSelect }: { ct: CorridorTrain; from: string; onHover: Props['onHover']; onSelect: Props['onSelect'] }) {
  const t = heroTime(ct, from)
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
    </button>
  )
}

export function Headline({ h, from, to, following, mood, lines = [], now, onHover, onSelect }: Props) {
  if (!from || !to) return <p className="headline">Pick where you are and where you are going.</p>
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
      {(() => {
        const n = relevantNotices(next.train.notices, from, to).find((x) => x.kind === 'cancelled' || x.kind === 'incident')
        return n ? (
          <p className="hero-notice" title={`${n.summary}. ${n.description} ${n.advice}`.trim()}>
            <strong>{n.summary}.</strong> {n.advice || n.description}
          </p>
        ) : null
      })()}
      {following.length > 0 && (
        <p className="hero-then">
          Then{' '}
          {following.map((ct, i) => (
            <span key={ct.train.id}>
              {i > 0 && ', '}
              <ThenItem ct={ct} from={from} onHover={onHover} onSelect={onSelect} />
            </span>
          ))}
        </p>
      )}
    </div>
  )
}
