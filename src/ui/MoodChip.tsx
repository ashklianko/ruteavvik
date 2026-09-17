import { MOOD_LABEL, type StationMood } from '../data/derive.ts'
import { delayColour } from '../diagram/palette.ts'
import { signed } from '../format.ts'

export function MoodChip({ mood, station }: { mood: StationMood; station: string }) {
  const colour = mood.mood === 'unknown' ? 'var(--color-ink-faint)' : mood.mood === 'disrupted' ? 'var(--color-late-3)' : delayColour(mood.median)
  const detail =
    mood.sample.length === 0
      ? `No train has left ${station} in the last hour.`
      : `Last ${mood.sample.length} trains left ${station} ${mood.sample.map(signed).join(', ')}${mood.median !== null ? `, median ${signed(mood.median)}` : ''}${mood.cancelled ? `. ${mood.cancelled} cancelled` : ''}.`
  return (
    <span className="mood" tabIndex={0} aria-label={`${station} now: ${MOOD_LABEL[mood.mood]}. ${detail}`}>
      <span className="mood-dot" style={{ background: colour }} />
      <span className="mood-word">{MOOD_LABEL[mood.mood]}</span>
      <span className="mood-card" role="tooltip">
        <strong>{station} now</strong>
        <br />
        {detail}
      </span>
    </span>
  )
}
