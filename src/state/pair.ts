import { useEffect, useState } from 'react'

export interface Pair {
  from: string | null
  to: string | null
  lines: string[]
}

const KEY = 'ruteavvik.pair'

function fromUrl(): Partial<Pair> | null {
  const q = new URLSearchParams(window.location.search)
  const from = q.get('from')
  const to = q.get('to')
  if (!from || !to) return null
  const lines = q.get('lines')
  return { from, to, lines: lines ? lines.split(',').filter(Boolean) : [] }
}

function load(): Pair {
  const url = fromUrl()
  let stored: Partial<Pair> = {}
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) stored = JSON.parse(raw) as Partial<Pair>
  } catch {
    stored = {}
  }
  const p = url ?? stored
  return { from: p.from ?? null, to: p.to ?? null, lines: Array.isArray(p.lines) ? p.lines : [] }
}

function writeUrl(pair: Pair) {
  const q = new URLSearchParams(window.location.search)
  if (pair.from && pair.to) {
    q.set('from', pair.from)
    q.set('to', pair.to)
    if (pair.lines.length) q.set('lines', pair.lines.join(','))
    else q.delete('lines')
  } else {
    q.delete('from')
    q.delete('to')
    q.delete('lines')
  }
  const search = q.toString()
  const next = `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash}`
  if (next !== `${window.location.pathname}${window.location.search}${window.location.hash}`) history.replaceState(null, '', next)
}

export function usePair(): [Pair, (next: Partial<Pair>) => void] {
  const [pair, setPair] = useState<Pair>(load)
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(pair))
    } catch {
      /* storage unavailable */
    }
    writeUrl(pair)
  }, [pair])
  return [pair, (next) => setPair((p) => ({ ...p, ...next }))]
}
