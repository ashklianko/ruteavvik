import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { fetchPatterns } from './geometry.ts'
import type { Train } from './model.ts'

export function usePatterns(trains: Train[]) {
  const wanted = useMemo(() => {
    const seen = new Set<string>()
    const out: Array<{ patternId: string; journeyId: string }> = []
    for (const t of trains) {
      if (!t.patternId || seen.has(t.patternId)) continue
      seen.add(t.patternId)
      out.push({ patternId: t.patternId, journeyId: t.id })
    }
    return out.sort((a, b) => a.patternId.localeCompare(b.patternId))
  }, [trains])
  const key = wanted.map((w) => w.patternId).join(',')
  return useQuery({
    queryKey: ['patterns', key],
    queryFn: () => fetchPatterns(wanted),
    enabled: wanted.length > 0,
    staleTime: Infinity,
    placeholderData: (prev) => prev,
  })
}
