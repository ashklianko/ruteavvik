import type { Station } from '../data/stations.ts'

export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ø/g, 'o')
    .replace(/æ/g, 'ae')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function rank(stations: Station[], query: string, exclude: string | null, limit = Infinity): Station[] {
  const q = fold(query.trim())
  const pool = stations.filter((s) => s.name !== exclude)
  if (!q) return pool.slice(0, limit)
  const score = (name: string): number => {
    const f = fold(name)
    if (f.startsWith(q)) return 0
    if (f.split(/\s+/).some((w) => w.startsWith(q))) return 1
    if (f.includes(q)) return 2
    return 3
  }
  return pool
    .map((s) => ({ s, r: score(s.name) }))
    .filter((x) => x.r < 3)
    .sort((a, b) => a.r - b.r || a.s.name.localeCompare(b.s.name, 'nb'))
    .slice(0, limit)
    .map((x) => x.s)
}
