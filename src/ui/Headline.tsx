import type { CorridorTrain, Headline as H, StationMood } from '../data/derive.ts'
import { MoodChip } from './MoodChip.tsx'
import { CALM_S, indexOf } from '../data/derive.ts'
import { delayWords, fmtTime, stopsAway } from '../format.ts'

interface Props {
  h: H
  from: string | null
  to: string | null
  following: CorridorTrain[]
  mood: StationMood | null
  onHover: (id: string | null) => void
  onSelect: (id: string) => void
}

const N = ({ children }: { children: React.ReactNode }) => <span className="num text-ink">{children}</span>

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

function why(ct: CorridorTrain, from: string): React.ReactNode {
  const { train, state } = ct
  const platform = platformAt(ct, from)
  const who = `${train.line} to ${train.destination}`
  const tail = platform ? `, platform ${platform}` : ''
  if (state.kind === 'starts-here') return `${who}, starts here${tail}`
  if (state.kind === 'not-departed') return `${who}, timetable only${tail}`
  if (atPlatform(ct)) return `${who}, at your platform${tail}`
  if (Math.abs(state.delay) <= CALM_S) return `${who}, on time, ${stopsAway(state.stopsAway, state.standing)}${tail}`
  return (
    <>
      {who}, <N>{delayWords(state.delay)}</N> and {state.verdict} at {state.at}
      {tail}
    </>
  )
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

export function Headline({ h, from, to, following, mood, onHover, onSelect }: Props) {
  if (!from || !to) return <p className="headline">Pick where you are and where you are going.</p>
  if (h.kind === 'none') return <p className="headline">Nothing running from {from} to {to} right now.</p>

  const next = 'train' in h ? h.train : null
  if (!next) return <p className="headline">Nothing running from {from} to {to} right now.</p>
  const t = heroTime(next, from)

  return (
    <div className="hero">
      <div className="hero-line">
        {mood && <MoodChip mood={mood} station={from} />}
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
          <span className={`hero-time link-time ${atPlatform(next) ? '' : 'num'}`}>{atPlatform(next) ? 'Now' : t !== null ? fmtTime(t) : '—'}</span>
          <span className="hero-why" title={typeof why(next, from) === 'string' ? (why(next, from) as string) : undefined}>
            {why(next, from)}
            <span className="hero-chevron" aria-hidden="true">
              {' '}
              ›
            </span>
          </span>
        </button>
      </div>
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
