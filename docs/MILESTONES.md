# Milestones

**Status:** plan · **Window:** Wed 2026-09-16 → Thu 2026-09-17 · one developer.

The diagram is the product; it gets the largest block. If anything slips, the network map is
cut first, then the Marey view, then the arrival window, never the spine. Live measurements exist only in the last
two to three hours, so anything visual is checked against the **07:00–09:00 peak on Thursday**;
outside that window, checks run on recorded snapshots.

## M0 · Ground — Wed morning

- Docs closed: PRD draft 3, SPEC draft 2, decisions 9–14, this plan. ✔ in progress
- Scaffold: Vite + React 19 + TypeScript + Tailwind v4 + Vitest + TanStack Query, `pnpm`.
  D3 modules and `@mapbox/polyline`. Tokens from the visual direction in `@theme`; IBM Plex
  Sans and Mono bundled locally.
- `README.md` updated for the new run instructions.

**Done when** `pnpm dev` serves an empty spine with the horizon, palette and type in place.

## M1 · Data layer — Wed midday

Pure TypeScript, no UI, every function unit-tested against **snapshots**: raw JSON responses
recorded from the live API and saved to disk unchanged. Nothing is invented; the point is that
measurements vanish from the API in two to three hours, and the UI has to be built at hours
when the morning peak no longer exists.

- Entur client: `gql()` with `ET-Client-Name`, batching helper, typed responses.
- Stations: bbox → rail → deduplicated by name; name normalisation.
- Journeys: fetch calls at `from`, select journeys that reach `to`, fetch them in batches.
- Derivations: measured delay, trail, verdict, current position and stops away, corridor
  rows, segment observations, added-delay aggregation with window and threshold, arrival
  window, headline state, the argument line.
- `scripts/snapshot.ts` that saves the live responses for a pair to `snapshots/`, so the UI
  can be built at any hour. A dev-only `?snapshot=<name>` switch feeds one into the page.

**Done when** `pnpm test` is green and a debug route prints the corridor for
`Sandvika → Oslo S` from live data and from a snapshot, identically.

## M2 · The spine — Wed afternoon → Thu morning peak

- Selector with persistence and swap; line chips.
- Diagram: rows, horizon with minute scale, displacement, marks in three states, trails,
  selection highlight, transitions on position.
- List with the same facts, same order, selection linked to the diagram.
- Headline in all six states. Polling with visibility pause and stale marker.
- Wide and narrow layouts.

**Done when** the page is opened at 07:30 Thursday on a phone against real traffic and the
picture reads without explanation. This is the gate for everything after it.

## M3 · Meaning — Thu

- Segment colouring below the horizon, with hover text. ✔
- Segment ↔ train link: hovering or focusing a segment highlights the trains that passed it
  and shows each one's added delay there; focusing a train dims the rest and draws its
  arrival window as a bracket on the `to` row.
- Glow under hot segments; trails as smoothed curves fading with age.
- Ghost position: a hollow mark slides from the last measured stop towards the next one by
  timetable run time and the carried delay, second by second; the measured mark stays put.
- Train detail with passed / remaining stops and the carried-forward label.
- Arrival window in the detail and the caption.
- The argument line under the diagram. ✔
- Green state reviewed on a calm sample; empty and error states reviewed.
- Accessibility pass: keyboard order, focus ring, `aria-expanded`, `role="img"` label.
- Production build deployed to a static host; the URL works on a phone.

**Done when** every sentence in SPEC has a screen it is true on, and the deployed URL is the
thing the owner opens on Friday morning.

## M4 · The Marey view — Thu, if M3 lands before evening

A second view: time across, corridor stations down, every train a line drawn only through
its measured times, the timetable as a faint ghost beside it. The gap between ghost and line
is the delay; where every line bends the same way is the segment adding it. Built from the
same journeys the corridor already fetches, so no new data.

- Layout and scales, 60–150 minutes of history from the current response.
- Measured polylines, timetable ghosts, current time as a vertical rule.
- Hover a train to read it; hover a segment to see who lost time there.

**Done when** the Oslo tunnel shows as a bend shared by every line on a weekday afternoon.

## M5 · Network map — only if everything above is done

- `pointsOnLink` fetch and decode, `d3-geo` projection, fit to viewport.
- Static coastline and Oslofjord GeoJSON clipped to the scope box, one file under `public/`.
- Segment colouring with halo, caption, hover.
- Batched fetch of all in-scope stations; measure the request size and time.

## Not in this window

- `collect.py` and any history. Its bbox is the old Oslo/Bærum one; leave it.
- CI, tests in the browser, PWA manifest. A manifest is a ten-minute follow-up once the page
  is worth pinning.
- Any commit or push: each needs explicit instruction.
