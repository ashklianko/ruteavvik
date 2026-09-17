const oslo = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Oslo', hour12: false, ...opts })

const hm = oslo({ hour: '2-digit', minute: '2-digit' })
const hms = oslo({ hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const fmtTime = (ms: number): string => hm.format(ms)
export const fmtClock = (ms: number): string => hms.format(ms)

export function signed(seconds: number): string {
  const sign = seconds < 0 ? '−' : '+'
  const abs = Math.abs(seconds)
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`
}


export function stopsAway(n: number, standing = false): string {
  if (n <= 0) return standing ? 'at your platform' : 'at your station'
  const away = n === 1 ? '1 stop away' : `${n} stops away`
  return standing ? `standing, ${away}` : away
}

export function delayWords(seconds: number): string {
  if (Math.abs(seconds) <= 60) return 'on time'
  const m = Math.max(1, Math.round(Math.abs(seconds) / 60))
  return seconds > 0 ? `${m} min late` : `${m} min early`
}

export const STATE_WORDS = {
  notDeparted: 'not departed yet',
  startsHere: 'starts here',
  timetableOnly: 'timetable only',
} as const

export function windowWords(lower: number, upper: number | null, sample: number, to?: string): string {
  const head = to ? `Arrives ${to} ` : 'arrives '
  if (upper === null) return `${head}${fmtTime(lower)} if it does not catch up`
  return `${head}${fmtTime(lower)}–${fmtTime(upper)}, from the last ${sample} trains`
}
