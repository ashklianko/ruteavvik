import { readFileSync, writeFileSync } from 'node:fs'
import type { CorridorSnapshot, RawJourney, RawJourneyCall, RawSituation } from '../src/data/types.ts'

// Builds two synthetic corridor snapshots from the recorded Sandvika morning: the timetable,
// stations and trains are real, every recorded time is replaced by an invented delay profile.

const SOURCE = 'public/snapshots/sandvika-morning.json'
const RECORDED_AT = '2026-09-17T07:50:00+02:00'
const rec = Date.parse(RECORDED_AT)

const base = JSON.parse(readFileSync(SOURCE, 'utf8')) as CorridorSnapshot

const iso = (ms: number) => {
  const d = new Date(ms + 2 * 3_600_000)
  return d.toISOString().replace(/\.\d{3}Z$/, '+02:00')
}
const norm = (name: string) => name.replace(/ stasjon$/, '')
const pos = (j: RawJourney, station: string) => j.estimatedCalls.findIndex((c) => norm(c.quay?.stopPlace.name ?? '') === station)
const towardsOslo = (j: RawJourney) => {
  const a = pos(j, 'Sandvika')
  const b = pos(j, 'Oslo S')
  return a >= 0 && b > a
}
const aimedDep = (c: RawJourneyCall) => Date.parse(c.aimedDepartureTime ?? c.aimedArrivalTime ?? '')
const aimedArr = (c: RawJourneyCall) => Date.parse(c.aimedArrivalTime ?? c.aimedDepartureTime ?? '')

function hash(s: string): number {
  let h = 2166136261
  for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return (h >>> 0) / 4294967296
}

type Profile = (j: RawJourney, i: number, c: RawJourneyCall) => number | 'cancel'

function apply(snap: CorridorSnapshot, profile: Profile, situationsFor: (j: RawJourney) => RawSituation[] = () => []): CorridorSnapshot {
  const out: CorridorSnapshot = structuredClone(snap)
  out.recordedAt = RECORDED_AT
  const delayAt = new Map<string, number>()
  const cancelled = new Set<string>()
  for (const j of out.journeys) {
    const sits = situationsFor(j)
    if (sits.length) j.situations = sits
    j.estimatedCalls.forEach((c, i) => {
      const d = profile(j, i, c)
      if (d === 'cancel') {
        cancelled.add(j.id)
        c.cancellation = true
        c.actualArrivalTime = null
        c.actualDepartureTime = null
        return
      }
      c.cancellation = false
      c.realtime = true
      const arr = aimedArr(c) + d * 1000
      const dep = aimedDep(c) + d * 1000
      c.actualArrivalTime = i > 0 && arr <= rec ? iso(arr) : null
      c.actualDepartureTime = dep <= rec && i < j.estimatedCalls.length - 1 ? iso(dep) : null
      delayAt.set(`${j.id}:${c.stopPositionInPattern}`, d)
    })
  }
  for (const s of out.stopCalls) {
    if (cancelled.has(s.serviceJourney.id)) {
      s.cancellation = true
      s.actualArrivalTime = null
      s.actualDepartureTime = null
      continue
    }
    s.cancellation = false
    const d = delayAt.get(`${s.serviceJourney.id}:${s.stopPositionInPattern}`) ?? 0
    const arr = Date.parse(s.aimedArrivalTime ?? s.aimedDepartureTime ?? '') + d * 1000
    const dep = Date.parse(s.aimedDepartureTime ?? s.aimedArrivalTime ?? '') + d * 1000
    s.actualArrivalTime = arr <= rec ? iso(arr) : null
    s.actualDepartureTime = dep <= rec ? iso(dep) : null
  }
  return out
}

const calmNoise = (j: RawJourney, i: number) => {
  const bias = hash(j.id) * 30
  const wobble = hash(`${j.id}:${i}`) * 25
  const fly = j.line.publicCode?.startsWith('FLY')
  return Math.round(fly ? wobble * 0.6 : bias + wobble)
}

// ---------- calm: an ordinary good morning ----------
const calm = apply(base, (j, i) => calmNoise(j, i))
;(calm as CorridorSnapshot & { synthetic: string }).synthetic = 'A calm morning: every time invented, timetable real.'

// ---------- rough: signal failure at Lysaker ----------
const oslobound = base.journeys.filter(towardsOslo)
const byDepAtSandvika = (j: RawJourney) => aimedDep(j.estimatedCalls[pos(j, 'Sandvika')])
const upcoming = oslobound.filter((j) => byDepAtSandvika(j) > rec).sort((a, b) => byDepAtSandvika(a) - byDepAtSandvika(b))
const within = (j: RawJourney, fromMin: number, toMin: number) => {
  const t = byDepAtSandvika(j) - rec
  return t >= fromMin * 60_000 && t <= toMin * 60_000
}
const pick = (code: string, fromMin: number, toMin: number, not: Array<RawJourney | undefined> = []) =>
  upcoming.find((j) => j.line.publicCode === code && within(j, fromMin, toMin) && !not.includes(j))
const growing = pick('R12', 3, 14) ?? pick('R13', 3, 14) ?? pick('RE10', 3, 14)
const catchingUp = pick('L1', 4, 16)
const cancelledTrain = pick('R13', 8, 28, [growing]) ?? pick('R14', 8, 28, [growing]) ?? pick('RE11', 8, 30, [growing])
const shortTrain = pick('L1', 16, 40, [catchingUp])
const FAILURE_START = Date.parse('2026-09-17T07:20:00+02:00')

const incident: RawSituation = {
  id: 'DEMO:Situation:lysaker',
  severity: 'normal',
  reportType: 'incident',
  summary: [{ value: 'Signal failure at Lysaker', language: 'en' }],
  description: [{ value: 'Trains between Sandvika and Oslo S are delayed by up to 8 minutes while the fault is repaired.', language: 'en' }],
  advice: [{ value: 'Allow extra time.', language: 'en' }],
  validityPeriod: { startTime: '2026-09-17T07:20:00+02:00', endTime: '2026-09-17T09:00:00+02:00' },
  affects: [],
}
const cancellation: RawSituation = {
  id: 'DEMO:Situation:cancelled',
  severity: 'normal',
  reportType: 'incident',
  summary: [{ value: 'Train cancelled', language: 'en' }],
  description: [{ value: `The ${cancelledTrain?.line.publicCode} departure is cancelled because of the signal failure at Lysaker.`, language: 'en' }],
  advice: [{ value: 'Take the next train; your ticket is valid.', language: 'en' }],
  validityPeriod: { startTime: '2026-09-17T07:30:00+02:00', endTime: '2026-09-17T09:00:00+02:00' },
  affects: [],
}
const fewer: RawSituation = {
  id: 'DEMO:Situation:short',
  severity: 'normal',
  reportType: 'general',
  summary: [{ value: 'Fewer carriages', language: 'en' }],
  description: [{ value: 'This departure runs with 3 carriages instead of 6. Expect it to be crowded.', language: 'en' }],
  advice: [],
  validityPeriod: { startTime: '2026-09-17T06:00:00+02:00', endTime: '2026-09-17T10:00:00+02:00' },
  affects: [],
}

const rough = apply(
  base,
  (j, i, c) => {
    if (j.id === cancelledTrain?.id) return 'cancel'
    let d = calmNoise(j, i)
    if (j.id === growing?.id) {
      const asker = pos(j, 'Asker')
      const steps = Math.max(0, i - (asker - 4))
      d = 40 + Math.min(steps, 5) * 75
    }
    if (j.id === catchingUp?.id) {
      const sandvika = pos(j, 'Sandvika')
      d = Math.max(20, 260 - Math.max(0, i - (sandvika - 8)) * 30)
    }
    if (towardsOslo(j) && aimedArr(c) >= FAILURE_START) {
      if (j.id !== growing?.id && j.id !== catchingUp?.id && !j.line.publicCode?.startsWith('FLY')) d += 50 + hash(`rush:${j.id}`) * 100
      const lysaker = pos(j, 'Lysaker')
      const skoyen = pos(j, 'Skøyen')
      const nat = pos(j, 'Nationaltheatret')
      if (skoyen >= 0 && i >= skoyen) d += 150
      if (nat >= 0 && i >= nat) d += 40
      if (lysaker >= 0 && i === lysaker) d += 20
    }
    return Math.round(d)
  },
  (j) => {
    const sits: RawSituation[] = []
    if (j.id === cancelledTrain?.id) sits.push(cancellation)
    if (j.id === shortTrain?.id) sits.push(fewer)
    if (towardsOslo(j) && byDepAtSandvika(j) > rec - 20 * 60_000 && byDepAtSandvika(j) < rec + 25 * 60_000 && j.id !== cancelledTrain?.id) sits.push(incident)
    return sits
  },
)
;(rough as CorridorSnapshot & { synthetic: string }).synthetic = 'Signal failure at Lysaker: every time invented, timetable real.'

writeFileSync('public/snapshots/demo-calm.json', JSON.stringify(calm))
writeFileSync('public/snapshots/demo-rough.json', JSON.stringify(rough))
console.log('growing', growing?.line.publicCode, growing?.privateCode, 'catching up', catchingUp?.privateCode, 'cancelled', cancelledTrain?.line.publicCode, cancelledTrain?.privateCode, 'short', shortTrain?.privateCode)
