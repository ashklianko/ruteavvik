import { mkdir, writeFile } from 'node:fs/promises'
import { fetchCorridor } from '../src/data/fetch.ts'
import { fetchStations, type Station } from '../src/data/stations.ts'

const args = process.argv.slice(2)
let out = 'public/snapshots'
let every = 0
const names: string[] = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') out = args[++i]
  else if (args[i] === '--every') every = Number(args[++i])
  else names.push(args[i])
}
if (names.length < 2 || names.length % 2 !== 0) {
  console.error('usage: node scripts/snapshot.ts [--out dir] [--every seconds] "<from>" "<to>" ["<from>" "<to>" ...]')
  process.exit(2)
}

const stations = await fetchStations()
const find = (name: string): Station => {
  const s = stations.find((x) => x.name.toLowerCase() === name.toLowerCase())
  if (!s) {
    console.error(`unknown station "${name}"; known: ${stations.map((x) => x.name).join(', ')}`)
    process.exit(2)
  }
  return s
}
const pairs: Array<[Station, Station]> = []
for (let i = 0; i < names.length; i += 2) pairs.push([find(names[i]), find(names[i + 1])])

const slug = (s: string) =>
  s.toLowerCase().replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a').replace(/[^a-z0-9]+/g, '-')

async function record(from: Station, to: Station) {
  const snap = await fetchCorridor(from, to.name)
  const stamp = snap.recordedAt.slice(0, 16).replace(/[:T]/g, '-')
  const file = `${out}/${slug(from.name)}-${slug(to.name)}-${stamp}.json`
  await mkdir(out, { recursive: true })
  await writeFile(file, JSON.stringify(snap))
  const actuals = snap.journeys.reduce((n, j) => n + j.estimatedCalls.filter((c) => c.actualDepartureTime).length, 0)
  console.log(`${new Date().toISOString()} ${file}: ${snap.stopCalls.length} calls, ${snap.journeys.length} journeys, ${actuals} measured stops`)
}

do {
  for (const [from, to] of pairs) {
    try {
      await record(from, to)
    } catch (e) {
      console.error(`${new Date().toISOString()} ${from.name} → ${to.name}: ${(e as Error).message}`)
    }
  }
  if (every > 0) await new Promise((r) => setTimeout(r, every * 1000))
} while (every > 0)
