import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { fetchCorridor } from './fetch.ts'
import { fetchStations, type Station } from './stations.ts'
import type { CorridorSnapshot } from './types.ts'

export const POLL_MS = 20_000

export function useStations() {
  return useQuery({ queryKey: ['stations'], queryFn: fetchStations, staleTime: Infinity })
}

export function snapshotParam(): string | null {
  return new URLSearchParams(window.location.search).get('snapshot')
}

export function atParam(): string | null {
  return new URLSearchParams(window.location.search).get('at')
}

async function loadSnapshot(name: string): Promise<CorridorSnapshot> {
  const res = await fetch(`${import.meta.env.BASE_URL}snapshots/${name}.json`)
  if (!res.ok) throw new Error(`snapshot ${name} not found`)
  return (await res.json()) as CorridorSnapshot
}

export function useCorridor(from: Station | null, to: string | null) {
  const snapshot = snapshotParam()
  return useQuery({
    queryKey: ['corridor', snapshot ?? from?.id, snapshot ?? to],
    queryFn: () => (snapshot ? loadSnapshot(snapshot) : fetchCorridor(from!, to!)),
    enabled: Boolean(snapshot || (from && to)),
    refetchInterval: snapshot ? false : POLL_MS,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  })
}

export function useNow(tickMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs)
    return () => clearInterval(id)
  }, [tickMs])
  return now
}
