import { fmtClock } from '../format.ts'
import { useOnline } from './useOnline.ts'

interface Props {
  updatedAt: number | undefined
  fetching: boolean
  error: boolean
  snapshot: boolean
  synthetic?: string | null
  pollMs: number
  now: number
  onRefresh: () => void
}

export function Status({ updatedAt, fetching, error, snapshot, synthetic = null, pollMs, now, onRefresh }: Props) {
  const online = useOnline()
  const age = updatedAt ? now - updatedAt : Infinity
  const state: 'snapshot' | 'offline' | 'stale' | 'live' | 'waiting' = snapshot ? 'snapshot' : !online ? 'offline' : !updatedAt && !error ? 'waiting' : error || age > pollMs * 2.5 ? 'stale' : 'live'
  const nextIn = updatedAt ? Math.max(0, Math.round((updatedAt + pollMs - now) / 1000)) : null
  const text =
    state === 'snapshot'
      ? synthetic
        ? `Synthetic data, not a recording. ${synthetic}`
        : `Recorded snapshot, not live${updatedAt ? `, as of ${fmtClock(updatedAt)}` : ''}.`
      : state === 'offline'
        ? `Offline${updatedAt ? `, showing data from ${fmtClock(updatedAt)}` : ''}.`
        : state === 'stale'
          ? `Entur is not answering${updatedAt ? `, showing data from ${fmtClock(updatedAt)}` : ''}. Retrying.`
          : state === 'live'
            ? `Updated ${fmtClock(updatedAt!)}${fetching ? ', refreshing' : nextIn !== null ? `, next in ${nextIn} s` : ''}.`
            : 'Asking Entur.'
  return (
    <button type="button" className={`status status-${state}`} onClick={onRefresh} aria-label={text} title="Refresh now">
      <span className="status-dot" />
      {state === 'stale' || state === 'offline' ? <span className="status-inline num">{updatedAt ? fmtClock(updatedAt) : ''}</span> : null}
      <span className="status-card" role="tooltip">
        {text}
        {state !== 'snapshot' && <span className="status-hint">Click to refresh</span>}
      </span>
    </button>
  )
}
