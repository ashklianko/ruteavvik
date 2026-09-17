import type { Band } from '../data/derive.ts'

const FAMILY_COLOURS = {
  local: '#82b4d8',
  regional: '#7ed3b2',
  airport: '#e3a6c9',
}

export type Family = keyof typeof FAMILY_COLOURS

export function familyOf(code: string): Family | null {
  if (/^FLY/i.test(code)) return 'airport'
  if (/^L\d/i.test(code)) return 'local'
  if (/^RE?\d/i.test(code)) return 'regional'
  return null
}

export function lineColour(code: string): string {
  const f = familyOf(code)
  return f ? FAMILY_COLOURS[f] : 'var(--color-ink-muted)'
}

export const BAND_COLOUR: Record<Band, string> = {
  few: 'var(--color-unknown)',
  'catching-up': 'var(--color-early)',
  steady: 'var(--color-spine)',
  plus0: 'var(--color-late-0)',
  plus1: 'var(--color-late-1)',
  plus2: 'var(--color-late-2)',
  worse: 'var(--color-late-3)',
}

export const BAND_LABEL: Record<Band, string> = {
  few: 'too few trains to say',
  'catching-up': 'catching up',
  steady: 'steady',
  plus0: 'adding a minute or so',
  plus1: 'adding two to three minutes',
  plus2: 'adding three to five minutes',
  worse: 'adding more than five minutes',
}

export function delayColour(seconds: number | null): string {
  if (seconds === null) return 'var(--color-ink-faint)'
  if (seconds < -60) return 'var(--color-early)'
  if (seconds <= 60) return 'var(--color-ontime)'
  if (seconds <= 120) return 'var(--color-late-0)'
  if (seconds <= 300) return 'var(--color-late-1)'
  if (seconds <= 600) return 'var(--color-late-2)'
  return 'var(--color-late-3)'
}
