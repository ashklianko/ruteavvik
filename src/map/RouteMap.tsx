import { AttributionControl, GeoJSONSource, type LngLatBoundsLike, Map as MlMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import 'maplibre-gl/dist/maplibre-gl.css'

setWorkerUrl(workerUrl)
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArrivalWindow, CorridorTrain, SegmentStat } from '../data/derive.ts'
import { segmentKey } from '../data/derive.ts'
import { positionAlong, stopIndex, subPath, type LonLat, type Pattern } from '../data/geometry.ts'
import { BAND_LABEL, delayColour } from '../diagram/palette.ts'
import { delayWords, fmtTime, signed } from '../format.ts'
import { TrainDetail } from '../ui/TrainDetail.tsx'

interface Props {
  from: string
  to: string
  list: CorridorTrain[]
  patterns: Map<string, Pattern>
  segments: Map<string, SegmentStat>
  corridor: string[]
  upstreamRows: string[]
  now: number
  selected: string | null
  hovered: string | null
  onSelect: (id: string | null) => void
  onHover: (id: string | null) => void
  windowFor: (ct: CorridorTrain) => ArrivalWindow | null
}

const STYLE = `https://tiles.openfreemap.org/styles/${new URLSearchParams(window.location.search).get('style') ?? 'dark'}`

const BAND_HEX: Record<string, string> = {
  few: '#3a4a4f',
  steady: '#3e5660',
  'catching-up': '#5fb7c9',
  plus0: '#c9cf7a',
  plus1: '#d9a441',
  plus2: '#e07b39',
  worse: '#d84a3b',
}

interface Placed {
  ct: CorridorTrain
  lonLat: LonLat
  moving: boolean
  due: boolean
}

function place(ct: CorridorTrain, p: Pattern, now: number): Placed | null {
  const { train, state } = ct
  if (state.kind !== 'measured') return null
  const here = train.calls[state.index]
  const i = stopIndex(p, here.station, state.index)
  if (i < 0) return null
  const at = p.stops[i].lonLat ?? p.coords[p.stops[i].vertex]
  if (!at) return null
  const next = train.calls[state.index + 1]
  if (!next || state.standing || here.actualDeparture === null || here.aimedDeparture === null) return { ct, lonLat: at, moving: false, due: false }
  const nextAimed = next.aimedArrival ?? next.aimedDeparture
  if (nextAimed === null) return { ct, lonLat: at, moving: false, due: false }
  const run = nextAimed - here.aimedDeparture
  const progress = run > 0 ? Math.min(1, Math.max(0, (now - here.actualDeparture) / run)) : 0
  if (progress < 0.03) return { ct, lonLat: at, moving: false, due: false }
  const j = stopIndex(p, next.station, i + 1)
  if (j < 0) return { ct, lonLat: at, moving: false, due: false }
  const pos = positionAlong(p, i, j, progress)
  return pos ? { ct, lonLat: pos, moving: progress < 1, due: progress >= 1 } : null
}

export default function RouteMap({ from, to, list, patterns, segments, corridor, upstreamRows, now, selected, hovered, onSelect, onHover, windowFor }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MlMap | null>(null)
  const markers = useRef(new Map<string, Marker>())
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const fittedFor = useRef<string | null>(null)
  const focusId = hovered ?? selected

  useEffect(() => {
    if (!container.current || mapRef.current) return
    let map: MlMap
    try {
      map = new MlMap({ container: container.current, style: STYLE, center: [10.6, 59.9], zoom: 9, attributionControl: false })
    } catch (e) {
      const message = (e as Error).message
      queueMicrotask(() => setFailed(message))
      return
    }
    map.addControl(new AttributionControl({ compact: true }))
    map.addControl(new NavigationControl({ showCompass: false }), 'top-left')
    map.on('error', (e) => console.error('map error', e.error?.message ?? e))
    if (import.meta.env.DEV) (window as unknown as { __rmap?: MlMap }).__rmap = map
    map.once('style.load', () => {
      if (container.current) container.current.dataset.ready = '1'
      map.addSource('track', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource('segments', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addSource('stations', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      map.addLayer({ id: 'track', type: 'line', source: 'track', paint: { 'line-color': '#3e5660', 'line-width': 2, 'line-opacity': 0.7 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
      map.addLayer({ id: 'segments-glow', type: 'line', source: 'segments', filter: ['get', 'hot'], paint: { 'line-color': ['get', 'colour'], 'line-width': 14, 'line-opacity': 0.35, 'line-blur': 8 }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
      map.addLayer({ id: 'segments', type: 'line', source: 'segments', paint: { 'line-color': ['get', 'colour'], 'line-width': ['case', ['get', 'hot'], 5, 3.5], 'line-dasharray': ['case', ['==', ['get', 'band'], 'few'], ['literal', [1, 2]], ['literal', [1, 0]]] }, layout: { 'line-cap': 'round', 'line-join': 'round' } })
      map.addLayer({ id: 'stations', type: 'circle', source: 'stations', paint: { 'circle-radius': ['case', ['get', 'major'], 4, 2.5], 'circle-color': '#0b1417', 'circle-stroke-color': ['case', ['get', 'here'], '#e6edea', '#8fa3a3'], 'circle-stroke-width': ['case', ['get', 'here'], 2, 1.2] } })
      map.addLayer({
        id: 'station-labels',
        type: 'symbol',
        source: 'stations',
        filter: ['get', 'major'],
        layout: { 'text-field': ['get', 'name'], 'text-size': ['case', ['get', 'here'], 13, 11], 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-font': ['Noto Sans Regular'], 'text-allow-overlap': false },
        paint: { 'text-color': ['case', ['get', 'here'], '#e6edea', '#a9baba'], 'text-halo-color': '#0b1417', 'text-halo-width': 1.4 },
      })
      map.on('mousemove', 'segments', (e) => {
        const f = e.features?.[0]
        const text = f?.properties?.text as string | undefined
        if (text) setTip({ x: e.point.x, y: e.point.y, text })
        map.getCanvas().style.cursor = 'default'
      })
      map.on('mouseleave', 'segments', () => {
        setTip(null)
        map.getCanvas().style.cursor = ''
      })
      setReady(true)
    })
    mapRef.current = map
    const live = markers.current
    return () => {
      map.remove()
      mapRef.current = null
      live.clear()
    }
  }, [])

  const usedPatterns = useMemo(() => {
    const out: Pattern[] = []
    const seen = new Set<string>()
    for (const c of list) {
      const p = c.train.patternId ? patterns.get(c.train.patternId) : undefined
      if (p && !seen.has(p.id)) {
        seen.add(p.id)
        out.push(p)
      }
    }
    return out
  }, [list, patterns])

  const segmentFeatures = useMemo(() => {
    const features: GeoJSON.Feature[] = []
    for (let k = 1; k < corridor.length; k++) {
      const a = corridor[k - 1]
      const b = corridor[k]
      const p = usedPatterns.find((pt) => stopIndex(pt, a) >= 0 && stopIndex(pt, b) >= 0)
      if (!p) continue
      const path = subPath(p, stopIndex(p, a), stopIndex(p, b))
      if (path.length < 2) continue
      const stat = segments.get(segmentKey(a, b))
      const band = stat?.band ?? 'few'
      const text = stat && stat.n >= 4 ? `${a} to ${b}: ${BAND_LABEL[band]}, ${signed(stat.added)} over ${stat.n} trains` : `${a} to ${b}: too few trains to say (${stat?.n ?? 0} measured)`
      features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: path }, properties: { colour: BAND_HEX[band], band, hot: band === 'plus1' || band === 'plus2' || band === 'worse', text } })
    }
    return features
  }, [corridor, usedPatterns, segments])

  const stationFeatures = useMemo(() => {
    const names = [...upstreamRows, ...corridor]
    const features: GeoJSON.Feature[] = []
    for (const name of names) {
      let lonLat: LonLat | null = null
      for (const p of usedPatterns) {
        const i = stopIndex(p, name)
        if (i >= 0) {
          lonLat = p.stops[i].lonLat ?? p.coords[p.stops[i].vertex] ?? null
          if (lonLat) break
        }
      }
      if (!lonLat) continue
      const major = name === from || name === to || corridor.includes(name) || upstreamRows.indexOf(name) < 4
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: lonLat }, properties: { name, major, here: name === from } })
    }
    return features
  }, [usedPatterns, upstreamRows, corridor, from, to])

  const placed = useMemo(() => {
    const out: Placed[] = []
    for (const c of list) {
      const p = c.train.patternId ? patterns.get(c.train.patternId) : undefined
      if (!p) continue
      const pl = place(c, p, now)
      if (pl) out.push(pl)
    }
    return out
  }, [list, patterns, now])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    ;(map.getSource('track') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: usedPatterns.filter((p) => p.coords.length > 1).map((p) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: p.coords }, properties: {} })),
    })
    ;(map.getSource('segments') as GeoJSONSource).setData({ type: 'FeatureCollection', features: segmentFeatures })
    ;(map.getSource('stations') as GeoJSONSource).setData({ type: 'FeatureCollection', features: stationFeatures })
  }, [ready, usedPatterns, segmentFeatures, stationFeatures])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const key = `${from}→${to}`
    if (fittedFor.current === key || stationFeatures.length === 0) return
    const coords: LonLat[] = []
    for (const f of stationFeatures) coords.push((f.geometry as GeoJSON.Point).coordinates as LonLat)
    for (const f of segmentFeatures) for (const c of (f.geometry as GeoJSON.LineString).coordinates) coords.push(c as LonLat)
    if (coords.length < 2) return
    const lons = coords.map((c) => c[0])
    const lats = coords.map((c) => c[1])
    const bounds: LngLatBoundsLike = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ]
    map.fitBounds(bounds, { padding: { top: 60, bottom: 40, left: 60, right: 60 }, duration: 600, maxZoom: 13 })
    fittedFor.current = key
  }, [ready, from, to, stationFeatures, segmentFeatures])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return
    const alive = new Set<string>()
    const seenAt = new Map<string, number>()
    for (const pl of placed) {
      const id = pl.ct.train.id
      alive.add(id)
      const posKey = `${pl.lonLat[0].toFixed(4)},${pl.lonLat[1].toFixed(4)}`
      const stack = seenAt.get(posKey) ?? 0
      seenAt.set(posKey, stack + 1)
      let marker = markers.current.get(id)
      if (!marker) {
        const el = document.createElement('button')
        el.type = 'button'
        el.className = 'tm'
        el.innerHTML = '<span class="tm-dot"></span><span class="tm-label"></span>'
        el.addEventListener('mouseenter', () => onHover(id))
        el.addEventListener('mouseleave', () => onHover(null))
        el.addEventListener('click', (e) => {
          e.stopPropagation()
          onSelect(selected === id ? null : id)
        })
        marker = new Marker({ element: el, anchor: 'center' }).setLngLat(pl.lonLat).addTo(map)
        markers.current.set(id, marker)
      } else {
        marker.setLngLat(pl.lonLat)
      }
      const el = marker.getElement()
      const s = pl.ct.state
      const delay = s.kind === 'measured' ? s.delay : null
      el.style.setProperty('--c', delayColour(delay))
      el.style.setProperty('--stack', String(stack))
      el.classList.toggle('tm-ring', pl.moving || pl.due)
      el.classList.toggle('tm-due', pl.due)
      const lit = focusId === id
      el.classList.toggle('tm-lit', lit)
      el.classList.toggle('tm-dim', focusId !== null && !lit)
      el.classList.toggle('tm-sel', selected === id)
      el.style.zIndex = lit ? '3' : '1'
      const label = el.querySelector('.tm-label') as HTMLSpanElement
      label.textContent =
        lit && s.kind === 'measured'
          ? `${pl.ct.train.line} to ${pl.ct.train.destination}, ${delayWords(s.delay)}${s.standing ? `, standing at ${s.at}` : pl.moving ? `, left ${s.at}` : `, at ${s.at}`}`
          : pl.ct.train.line
      el.title = `${pl.ct.train.line} ${pl.ct.train.number} to ${pl.ct.train.destination}`
    }
    for (const [id, marker] of markers.current) {
      if (!alive.has(id)) {
        marker.remove()
        markers.current.delete(id)
      }
    }
  }, [ready, placed, focusId, selected, onHover, onSelect])

  const chosen = selected ? list.find((c) => c.train.id === selected) : undefined
  const notDeparted = list.filter((c) => c.state.kind === 'not-departed').length
  const unplaced = list.filter((c) => c.state.kind === 'measured').length - placed.length

  if (failed) {
    return (
      <div className="route-map">
        <div className="route-map-canvas flex items-center justify-center p-6 text-center text-sm text-ink-muted">This browser cannot draw the map: WebGL is unavailable. The Now and Last hour views work without it.</div>
      </div>
    )
  }

  return (
    <div className="route-map">
      <div ref={container} className="route-map-canvas" onClick={() => onSelect(null)} />
      {tip && (
        <div className="map-tip" style={{ left: tip.x, top: tip.y }} role="tooltip">
          {tip.text}
        </div>
      )}
      <p className="route-map-note">
        Solid marks are recorded at a station, rings are carried along the track by the timetable since the last recorded stop. Track coloured by the delay it adds.
        {notDeparted > 0 && ` ${notDeparted} ${notDeparted === 1 ? 'train has' : 'trains have'} not departed yet.`}
        {unplaced > 0 && ` ${unplaced} without track geometry yet.`}
      </p>
      {chosen && (
        <aside className="map-panel" aria-label="Selected train">
          <button type="button" className="map-panel-close" onClick={() => onSelect(null)} aria-label="Close">
            ×
          </button>
          <p className="map-panel-title">
            <span className="line">{chosen.train.line}</span> <span className="num text-ink-muted">{chosen.train.number}</span> {chosen.train.calls[0]?.station} – {chosen.train.destination}
          </p>
          <p className="map-panel-sub">
            {chosen.state.kind === 'measured'
              ? `${delayWords(chosen.state.delay)}, ${chosen.state.verdict}, ${chosen.state.standing ? 'standing at' : 'last recorded at'} ${chosen.state.at}`
              : chosen.state.kind === 'starts-here'
                ? 'starts here, nothing measured yet'
                : 'not departed yet, timetable only'}
            {(() => {
              const call = chosen.train.calls.find((c) => c.station === from)
              return call?.aimedDeparture ? `. Timetable ${fmtTime(call.aimedDeparture)} from ${from}${call.platform ? `, platform ${call.platform}` : ''}.` : ''
            })()}
          </p>
          <TrainDetail ct={chosen} to={to} window={windowFor(chosen)} />
        </aside>
      )}
    </div>
  )
}
