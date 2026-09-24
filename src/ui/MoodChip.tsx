import { MOOD_LABEL, type StationMood } from '../data/derive.ts'
import { delayColour } from '../diagram/palette.ts'
import { signed } from '../format.ts'

export function MoodChip({ mood, station, lines = [] }: { mood: StationMood; station: string; lines?: string[] }) {
  const who = lines.length ? `${lines.join(', ')} trains` : 'trains'
  const colour = mood.mood === 'unknown' ? 'var(--color-ink-faint)' : mood.mood === 'disrupted' ? 'var(--color-late-3)' : delayColour(mood.median)
  const departed =
    mood.sample.length === 0
      ? `No ${lines.length ? lines.join(', ') + ' ' : ''}train has left ${station} in the last hour.`
      : `Last ${mood.sample.length} ${who} left ${station} ${mood.sample.map(signed).join(', ')}${mood.median !== null ? `, median ${signed(mood.median)}` : ''}.`
  const flags = [
    mood.cancelled ? `${mood.cancelled} cancelled` : '',
    mood.notices ? `${mood.notices} coming ${mood.notices === 1 ? 'train has an operator notice' : 'trains have operator notices'} for this stretch` : '',
  ].filter(Boolean)
  const detail = flags.length ? `${departed} ${flags.join('; ')}.` : departed
  const flag = [mood.cancelled ? `${mood.cancelled} cancelled` : '', mood.notices ? `${mood.notices} ${mood.notices === 1 ? 'notice' : 'notices'}` : ''].filter(Boolean).join(', ')
  return (
    <span className="mood" role="note" tabIndex={0} aria-label={`${station} now: ${MOOD_LABEL[mood.mood]}. ${detail}`}>
      <span className="mood-dot" style={{ background: colour }} />
      <span className="mood-word">{MOOD_LABEL[mood.mood]}</span>
      {flag && <span className="mood-flag">· {flag}</span>}
      <span className="mood-card" role="tooltip">
        <strong>{station} now{lines.length ? `, ${lines.join(', ')}` : ''}</strong>
        <br />
        {detail}
      </span>
    </span>
  )
}
