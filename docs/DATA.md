# Data — what Entur actually gives, verified

**Status:** draft · **Last verified:** 2026-09-15, Oslo/Bærum, weekday afternoon; bbox re-measured 2026-09-16

Everything below was probed live, not read from documentation. Figures are real
measurements from that session.

## Access

| | |
|---|---|
| JourneyPlanner v3 | `https://api.entur.io/journey-planner/v3/graphql` |
| Vehicle positions | `https://api.entur.io/realtime/v2/vehicles/graphql` |
| Auth | none — header `ET-Client-Name: <org>-<app>` only |
| CORS | `access-control-allow-origin: *`, `ET-Client-Name` in allowed headers |

CORS being open is load-bearing: the page talks to Entur directly, so there is no backend,
no key to leak and no deployment beyond static hosting.

## What each call yields

**`stopPlace.estimatedCalls`** — departures at a stop. Per call: `aimedDepartureTime`,
`expectedDepartureTime`, `actualDepartureTime`, the arrival equivalents, `realtime`,
`cancellation`, `predictionInaccurate`, `quay` (platform), `destinationDisplay`, `line`,
`serviceJourney`.
Measured: Sandvika returns **450 departures per 24 h**. Thirty-nine stations queried as one
aliased request over a 90-minute window returned **1378 rows in 0.6 s**.

**`serviceJourney.estimatedCalls`** — one train, every stop. Stops already passed carry
`actualDepartureTime`, a recorded time rather than an estimate. This single call is what
makes the product possible.

**Batching** — 20 journeys as aliases in one request: **0.20 s, 93 KB**. No practical limit
encountered at 25 per batch.

**`serviceJourney.privateCode`** — the Norwegian train number as printed on platform
displays: 1640, 2241, 521, 1023. `publicCode` is null; do not use it.

**`line.journeyPatterns.pointsOnLink`** — real track geometry as an encoded polyline, plus
quays in running order. Eleven Oslo lines resolve: RE10 30 812 characters, R12 13 207,
L1 8 094; 134 003 characters total.

**`realtime/v2/vehicles`** — **5894 vehicles live, 113 of them RAIL**, with coordinates,
`delay` in seconds, `bearing`, `mode`, `line`.

**`situations`** — deviation notices attached to departures, with severity, report type and
validity. Sparse: 5 of 40 departures at Oslo S carried one, text `Færre vogner`.

## The measurement horizon

The single most important constraint, and it is tighter than "today".

Probed at 15:37 against Sandvika, varying `startTime`:

```
05:00  →  3 departures returned,  0 with actualDepartureTime
07:00  → 13 departures returned,  0 with actualDepartureTime
08:00  → 12 departures returned,  0 with actualDepartureTime
10:00  → 12 departures returned,  0 with actualDepartureTime
13:00  → 13 departures returned,  3 with actualDepartureTime  (earliest 12:54)
```

Probed against one service journey, varying `date`:

```
today      18 stops, 13 with actuals, realtime on all 18
yesterday  18 stops,  0 with actuals, realtime on none
−2 days    empty
−7, −30    empty
```

**Observed times survive roughly two to three hours, then only the timetable remains.**
Yesterday's journeys still resolve but carry no measurements. There is no archive anywhere
at per-departure granularity: Bane NOR publishes monthly and yearly punctuality as PDF
reports; its API portal is behind registration; the `Trafikkdata fra Bane NOR` entry on
data.norge.no was last touched 30 January 2018 and registers no API. Capturing history
means recording the stream continuously — which is what `collect.py` exists for.

## Traps

**Stations have two different ids.** `stopPlacesByBbox` returns Oslo S as
`NSR:StopPlace:59872`; the same station inside `serviceJourney.estimatedCalls` is
`NSR:StopPlace:337`. Lysaker is `58856` against `157`. Sandvika happens to match at `610`,
which makes the bug look like it works. **Match stations by name, never by id.** Strip the
trailing ` stasjon`.

**The bbox is not rail-only.** `stopPlacesByBbox` returns 1429 stops in the original
Oslo/Bærum box, of which 39 are rail. Without filtering by `transportMode`, bus stops enter
the segment statistics and produce nonsense pairs with n = 2.

## Scope box

Measured 2026-09-16 morning, rail stop places after `transportMode` filter and name
deduplication:

```
59.78–60.08 N, 10.30–11.10 E   (handoff box)   1780 stops,  48 rail
59.55–60.45 N, 10.30–11.60 E   (Akershus box)  4522 stops, 100 rail
```

The Akershus box is the product's scope. It includes Eidsvoll, Eidsvoll verk, Jessheim,
Kløfta, Oslo lufthavn, Dal, Årnes, Sørumsand, Fetsund, Ski, Ås, Vestby, Langhus, Spikkestad
and Røyken, and also a dozen stations past the county line: Roa, Lunner, Gran, Jaren,
Jevnaker, Harestua, Grua, Stryken on Gjøvikbanen; Askim, Mysen, Spydeberg, Slitu, Knapstad,
Tomter on Østre linje. `collect.py` still uses the older, narrower box.

Not yet measured: one aliased `estimatedCalls` request over all 100 stations. Thirty-nine
took 0.6 s and 1378 rows; expect roughly two to three times that, and split into two
requests if it exceeds a second.

**Optional vehicle fields are empty in practice.** `speed`, `destinationName` and
`progressBetweenStops` came back null across the sample. Do not build on them.

**`expectedDepartureTime` is a forecast even for the near future.** Only
`actualDepartureTime` is a measurement. The two agree for passed stops and diverge for
everything else; the product uses the latter exclusively.

## Derived metric: delay added per segment

For every journey, take consecutive stops where both carry an actual time, and record
`delay(B) − delay(A)`. Average per ordered pair over the last 60 minutes, rail only,
suppressed below four observed passes.

This measures where delay is *created*, as opposed to where delayed trains happen to be.
Carried delay is a symptom and tells you nothing actionable; added delay is the cause.

Two independent samples, twenty minutes apart:

```
Oslo S → Nationaltheatret   +109 s   n = 12
Oslo S → Nationaltheatret   +107 s   n = 11
```

Eleven to twelve consecutive trains each losing about one minute fifty on one short hop —
the Oslo tunnel. The figure is stable across samples, which suggests the method is sound
rather than noisy.

A run over 170 journeys produced 225 segments, of which 24 cleared the n ≥ 4 threshold.
