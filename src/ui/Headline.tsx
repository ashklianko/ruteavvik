import type { Headline as H } from '../data/derive.ts'
import { indexOf } from '../data/derive.ts'
import { fmtTime, signed, stopsAway } from '../format.ts'

const N = ({ children }: { children: React.ReactNode }) => <span className="num text-ink">{children}</span>

function departure(h: Extract<H, { train: unknown }>, from: string): string {
  const call = h.train.train.calls[indexOf(h.train.train, from)]
  return call?.aimedDeparture ? fmtTime(call.aimedDeparture) : ''
}

export function Headline({ h, from, to }: { h: H; from: string | null; to: string | null }) {
  if (!from || !to) return <p className="headline">Pick where you are and where you are going.</p>
  switch (h.kind) {
    case 'none':
      return <p className="headline">Nothing running from {from} to {to} right now.</p>
    case 'calm':
      return (
        <p className="headline">
          All <N>{h.count}</N> trains towards {to} are within a minute of time.
        </p>
      )
    case 'on-time':
      return (
        <p className="headline">
          Next to {to} at <N>{departure(h, from)}</N>, running to time, {stopsAway(h.stopsAway, h.train.state.kind === 'measured' && h.train.state.standing)}.
        </p>
      )
    case 'late':
      return (
        <p className="headline">
          Next to {to} at <N>{departure(h, from)}</N>, <N>{signed(h.delay)}</N> and {h.verdict}, at {h.at}.
        </p>
      )
    case 'starts-here':
      return (
        <p className="headline">
          Next to {to} at <N>{departure(h, from)}</N> starts here. Nothing to measure yet.
        </p>
      )
    case 'not-departed':
      return (
        <p className="headline">
          Next to {to} at <N>{departure(h, from)}</N>. It has not left its origin, so nothing is measured yet.
        </p>
      )
  }
}
