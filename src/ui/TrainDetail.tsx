import type { ArrivalWindow, CorridorTrain } from '../data/derive.ts'
import { delayAt, indexOf } from '../data/derive.ts'
import { fmtTime, signed } from '../format.ts'
import { Emblem } from './Emblem.tsx'

interface Props {
  ct: CorridorTrain
  to: string
  window: ArrivalWindow | null
}

export function TrainDetail({ ct, to, window }: Props) {
  const { train, state } = ct
  const toIndex = indexOf(train, to)
  const current = state.kind === 'measured' ? state.index : -1
  const delay = state.kind === 'measured' ? state.delay : null
  const firstShown = Math.max(0, current - 7)
  const passed = train.calls.slice(firstShown, current + 1)
  const remaining = train.calls.slice(current + 1, toIndex + 1)
  return (
    <div className="detail">
      {firstShown > 0 && <p className="detail-note">{firstShown} earlier stops not shown</p>}
      {passed.length > 0 && (
        <table className="detail-table">
          <tbody>
            {passed.map((c, i) => {
              const aimed = c.aimedDeparture ?? c.aimedArrival
              const actual = c.actualDeparture ?? c.actualArrival
              const d = delayAt(c)
              const isNow = i === passed.length - 1
              return (
                <tr key={c.position} className={isNow ? 'detail-now' : ''} aria-current={isNow ? 'step' : undefined}>
                  <td>{c.station}</td>
                  <td className="num text-ink-faint">{aimed !== null ? fmtTime(aimed) : ''}</td>
                  <td className="num">{actual !== null ? fmtTime(actual) : ''}</td>
                  <td className="num text-ink-muted">{d !== null ? signed(d) : ''}</td>
                  <td className="detail-mark">
                    {isNow && (
                      <span title={state.kind === 'measured' && state.standing ? 'Standing here' : 'Last recorded here'}>
                        <Emblem height={11} />
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {delay !== null && remaining.length > 0 && (
        <p className="detail-note">
          below carries <span className="num text-ink">{signed(delay)}</span> forward, if it does not catch up
        </p>
      )}
      {remaining.length > 0 && (
        <table className="detail-table detail-remaining">
          <tbody>
            {remaining.map((c) => {
              const aimed = c.aimedArrival ?? c.aimedDeparture
              return (
                <tr key={c.position} className={c.station === to ? 'detail-to' : ''}>
                  <td>{c.station}</td>
                  <td className="num text-ink-faint">{aimed !== null ? fmtTime(aimed) : ''}</td>
                  <td className="num">{aimed !== null && delay !== null ? fmtTime(aimed + delay * 1000) : ''}</td>
                  <td className="num text-ink-faint">{c.cancelled ? 'cancelled' : ''}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {state.kind !== 'measured' && <p className="detail-note">Nothing measured yet. Times above are the timetable only.</p>}
      {window && (
        <p className="detail-window">
          Arrives {to} <span className="num text-ink">{fmtTime(window.lower)}</span>
          {window.upper !== null ? (
            <>
              <span className="num text-ink">–{fmtTime(window.upper)}</span>, from what the last {window.sample} trains did on this stretch.
            </>
          ) : (
            <> if it does not catch up. Too few trains ahead to say more.</>
          )}
        </p>
      )}
    </div>
  )
}
