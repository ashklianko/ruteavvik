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
  plus1: 'var(--color-late-1)',
  plus2: 'var(--color-late-2)',
  worse: 'var(--color-late-3)',
}

export const BAND_LABEL: Record<Band, string> = {
  few: 'too few trains to say',
  'catching-up': 'catching up',
  steady: 'steady',
  plus1: 'adding about a minute',
  plus2: 'adding about two minutes',
  worse: 'adding more than two and a half minutes',
}
