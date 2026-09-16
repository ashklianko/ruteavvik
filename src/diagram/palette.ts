import type { Band } from '../data/derive.ts'

const LINE_COLOURS: Record<string, string> = {
  L1: '#82b4d8',
  L2: '#7ed3b2',
  L12: '#b7a6e8',
  L13: '#e3a6c9',
  L14: '#c9d36f',
  L21: '#f0b27a',
  L22: '#f0b27a',
  R10: '#f2c14e',
  RE10: '#f2c14e',
  R11: '#e8956b',
  RE11: '#e8956b',
  R12: '#d97d8c',
  R13: '#8fd0de',
  R14: '#a9d18e',
  R20: '#d9b9a3',
  R30: '#d9b9a3',
  FLY1: '#f5a623',
}

export function lineColour(code: string): string {
  return LINE_COLOURS[code] ?? 'var(--color-ink-muted)'
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
