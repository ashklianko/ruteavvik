const oslo = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Oslo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function osloParts(ms: number): number[] {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(oslo.format(ms))
  if (!m) throw new Error(`unexpected date format ${oslo.format(ms)}`)
  return m.slice(1).map(Number)
}

export function osloOffsetMs(ms: number): number {
  const [y, mo, d, h, mi, s] = osloParts(ms)
  return Date.UTC(y, mo - 1, d, h, mi, s) - Math.floor(ms / 1000) * 1000
}

export function atClock(recordedAt: string, hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim())
  if (!m) return null
  const base = Date.parse(recordedAt)
  if (Number.isNaN(base)) return null
  const [y, mo, d] = osloParts(base)
  return Date.UTC(y, mo - 1, d, Number(m[1]), Number(m[2]), 0) - osloOffsetMs(base)
}
