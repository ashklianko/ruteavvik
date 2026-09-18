import { readFileSync, writeFileSync } from 'node:fs'
import { gql } from '../src/data/entur.ts'
import type { CorridorSnapshot } from '../src/data/types.ts'

// Adds journeyPattern ids to snapshots recorded before the map needed them.
const files = process.argv.slice(2)
if (!files.length) {
  console.error('usage: node scripts/backfill-patterns.ts public/snapshots/<file>.json ...')
  process.exit(2)
}
const BATCH = 25
for (const file of files) {
  const snap = JSON.parse(readFileSync(file, 'utf8')) as CorridorSnapshot
  const missing = snap.journeys.filter((j) => !j.journeyPattern?.id)
  for (let i = 0; i < missing.length; i += BATCH) {
    const chunk = missing.slice(i, i + BATCH)
    const query = `{ ${chunk.map((j, k) => `j${k}: serviceJourney(id: ${JSON.stringify(j.id)}) { journeyPattern { id } }`).join(' ')} }`
    const data = await gql<Record<string, { journeyPattern: { id: string } | null } | null>>(query)
    chunk.forEach((j, k) => {
      const id = data[`j${k}`]?.journeyPattern?.id
      if (id) j.journeyPattern = { id }
    })
  }
  const done = snap.journeys.filter((j) => j.journeyPattern?.id).length
  writeFileSync(file, JSON.stringify(snap))
  console.log(`${file}: ${done}/${snap.journeys.length} journeys with a pattern`)
}
