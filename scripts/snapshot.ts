import { mkdir, writeFile } from 'node:fs/promises'
import { fetchCorridor } from '../src/data/fetch.ts'
import { fetchStations } from '../src/data/stations.ts'

const [fromArg, toArg] = process.argv.slice(2)
if (!fromArg || !toArg) {
  console.error('usage: node scripts/snapshot.ts "<from>" "<to>"')
  process.exit(2)
}

const stations = await fetchStations()
const from = stations.find((s) => s.name.toLowerCase() === fromArg.toLowerCase())
const to = stations.find((s) => s.name.toLowerCase() === toArg.toLowerCase())
if (!from || !to) {
  console.error(`unknown station; known: ${stations.map((s) => s.name).join(', ')}`)
  process.exit(2)
}

const snap = await fetchCorridor(from, to.name)
const slug = (s: string) =>
  s.toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-')
const stamp = snap.recordedAt.slice(0, 16).replace(/[:T]/g, '-')
const file = `public/snapshots/${slug(from.name)}-${slug(to.name)}-${stamp}.json`
await mkdir('public/snapshots', { recursive: true })
await writeFile(file, JSON.stringify(snap))
const actuals = snap.journeys.reduce(
  (n, j) => n + j.estimatedCalls.filter((c) => c.actualDepartureTime).length,
  0,
)
console.log(`${file}: ${snap.stopCalls.length} calls, ${snap.journeys.length} journeys, ${actuals} measured stops`)
