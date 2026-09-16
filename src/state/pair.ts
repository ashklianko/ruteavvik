import { useEffect, useState } from 'react'

export interface Pair {
  from: string | null
  to: string | null
  lines: string[]
}

const KEY = 'ruteavvik.pair'
const EMPTY: Pair = { from: null, to: null, lines: [] }

function load(): Pair {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const p = JSON.parse(raw) as Partial<Pair>
    return { from: p.from ?? null, to: p.to ?? null, lines: Array.isArray(p.lines) ? p.lines : [] }
  } catch {
    return EMPTY
  }
}

export function usePair(): [Pair, (next: Partial<Pair>) => void] {
  const [pair, setPair] = useState<Pair>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(pair))
    } catch {
      /* storage unavailable */
    }
  }, [pair])
  return [pair, (next) => setPair((p) => ({ ...p, ...next }))]
}
