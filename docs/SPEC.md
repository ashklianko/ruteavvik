# Behaviour specification

**Status:** draft 2 · Rationale lives in [DECISIONS.md](DECISIONS.md), API reality in
[DATA.md](DATA.md), scope in [PRD.md](PRD.md), plan in [MILESTONES.md](MILESTONES.md). This
file says only what the thing does. Supersedes draft 1, which described a text-list screen.

## Vocabulary

| term | meaning |
|---|---|
| **measured delay** | `actualDepartureTime − aimedDepartureTime` at a stop the train has passed, in seconds |
| **trail** | the last four measured delays of one train, oldest first |
| **verdict** | growing · holding · shrinking, derived from the trail |
| **added delay** | `delay(B) − delay(A)` across one segment, averaged over recent passes |
| **corridor** | the ordered stops from `from` to `to`, inclusive |
| **spine** | the vertical line of the diagram; a train exactly on it is exactly on time |
| **horizon** | the full-width horizontal line at `from`, dividing approaching from already-past |
| **displacement** | horizontal offset of a train mark from the spine, a function of measured delay |
| **arrival window** | earliest and latest measured arrival at `to` for a train, see below |

No value derived from `expectedDepartureTime` is ever displayed.

## Global

One screen: selector on top, the **diagram** and the **list** side by side on wide screens
and stacked (diagram first) below 900 px. The **network map** is a second view reached by a
`Network` link and the `#network` hash; it is not a tab inside the main screen.

Selection of `from`, `to` and line filter persists in `localStorage` under `ruteavvik.pair`.
With no stored pair the selector is open and the diagram shows an empty spine with the
prompt *pick where you are and where you are going*.

Polling every 20 s while the page is visible; paused when hidden, refetched immediately on
return. A failed poll leaves the previous state on screen, marks the caption with *last
updated HH:MM:SS*, and never blanks the page. Time on screen is Europe/Oslo.

## Data

Stations for the selector come from `stopPlacesByBbox` over `59.55–60.45 N, 10.30–11.60 E`,
filtered to `transportMode` containing rail, deduplicated by name with a trailing ` stasjon`
stripped, sorted alphabetically. Stations everywhere else — corridor rows, trails, detail —
come from the journeys themselves and are matched **by name**, never by id.

Per poll:

1. `estimatedCalls` at `from`, rail only, `startTime = now − 60 min`, `timeRange = 150 min`.
   This yields both trains still to depart and trains that already left.
2. For every distinct `serviceJourney` whose remaining calls include `to` after `from`, its
   full `estimatedCalls`, batched 25 per request. Trains going the other way or never
   reaching `to` are dropped.
3. From every fetched journey, every consecutive pair of stops that both carry an
   `actualDepartureTime` becomes one segment observation `delay(B) − delay(A)`, timestamped
   with `actualDepartureTime(B)`.

Cancelled calls are excluded from every statistic and shown in the list as *cancelled*.

## Selector

`from` and `to` are two `select`s with a swap button between them. Choosing the same station
for both is rejected in place. Line chips filter the list and the diagram; none selected means
all; the chips show only the lines present in the current data. Changing `from` triggers a
full refetch; changing `to` or a chip re-filters without a network call.

## Headline

One sentence above the diagram, no statistics, always present.

| state | text |
|---|---|
| running to time | Next to {to} at **HH:MM**, running to time, {N} stops away. |
| late | Next to {to} at **HH:MM**, **+M:SS** and *growing* / *holding* / *shrinking*, at {station}. |
| starts here | Next to {to} at **HH:MM** starts here. Nothing to measure yet. |
| nothing measured | Next to {to} at **HH:MM**. It has not left its origin — nothing measured yet. |
| all calm | All {N} trains on this line are within a minute of time. |
| nothing at all | Nothing running on this pair right now. |

`HH:MM` is the scheduled departure from `from`; the delay stands beside it. "Next" is the
train with the earliest measured arrival at `from` — scheduled plus current delay — not the
earliest timetable slot.

## Diagram

An SVG filling its column, redrawn on every poll with transitions on position only.

### Rows

Rows are stations, equally spaced, flowing **downwards**: trains enter at the top and travel
towards `to` at the bottom.

- **Above the horizon** rows are relative: *1 stop away*, *2 stops away* … up to six. Lines
  branch upstream, so rows here are indexed by distance and each train mark carries its own
  current station name. A train more than six stops away sits in a gutter row at the very
  top, *further out*, with its station named.
- **The horizon** is `from`, drawn full width and labelled with the station name and a minute
  scale: ticks at 0, +1, +2, +5, +10 reading rightwards, −1 leftwards.
- **Below the horizon** rows are the concrete corridor stations in running order, taken from
  the most complete journey pattern among the fetched trains; a train that skips a station
  passes through that row without a mark.

### Displacement

`x(delay)` is piecewise linear in minutes, symmetrical for early trains, clamped:

| delay | position |
|---|---|
| 0 | on the spine |
| 0 → +5 min | 0 → 60 % of the half-width, linear |
| +5 → +15 min | 60 → 100 %, linear |
| beyond +15 | pinned at 100 % with a `»` mark; the number is still exact in the label |
| early | the same function mirrored left, clamped at −2 min |

Displacement never encodes anything but delay. Vertical position never encodes anything but
station order.

### Marks

Each train is a filled circle, line-coloured, with its train number and signed delay in mono
beside it. Behind it, its **trail**: a polyline through its last four measured positions —
each at the row of that stop and the displacement of the delay measured there — fading with
age. A growing delay is a trail leaning right on the way down; a shrinking one leans back
towards the spine.

Three states, never blended:

- **measured** — filled mark at its current row and displacement, trail, signed delay.
- **starts here** — hollow mark on the horizon at zero displacement, label *starts here*.
- **not departed yet** — hollow mark in the gutter row, label *not departed*, scheduled time
  only. Nothing numeric beyond the timetable is shown.

A train that already passed `from` and is between `from` and `to` is drawn below the horizon
with the same rules; these are *trains ahead of you*. Trains that already reached `to` are
dropped from the diagram but still feed segment statistics.

### Segments

Below the horizon, each segment of the spine between consecutive corridor rows is coloured by
added delay over the last 60 minutes, rail only, n ≥ 4:

| | |
|---|---|
| catching up | below −20 s |
| steady | −20 s to +30 s — spine colour |
| +1 min | 30–90 s |
| +2 min | 90–150 s |
| worse | above 150 s |
| too few trains | fewer than 4 passes — dashed grey |

Above the horizon the spine is plain: rows are relative, so no segment there is one piece of
track.

Hovering or focusing a coloured segment shows `{A} → {B} · +M:SS added · n trains`.

### Green state

Every train on the spine, trails vertical, segments in spine colour, headline *all calm*. This
must look finished, not empty. Nothing is hidden because it is zero.

## List

Always visible beside or below the diagram. One row per train, same order as the headline:
measured arrival at `from`, then timetable for unmeasured ones.

Each row: scheduled departure · line · destination · train number · state.

- **measured** — signed delay, verdict, `at {station}, N stops away`, trail as four small
  numbers.
- **starts here** — *originates here*.
- **not departed yet** — *not departed*.
- **ahead of you** — same as measured, grouped under a divider *already past {from}*.
- **cancelled** — struck through, *cancelled*.

Verdict thresholds: last minus first of the trail, ±45 s. Fewer than three readings yields
*one reading* / *two readings* and no direction word.

Selecting a row or a mark highlights both; the trail of the selected train is drawn at full
opacity, the rest dim. One selection at a time; `Escape` clears it. Selection survives polls.

## Train detail

Expands in place under the selected row; does not navigate.

Passed stops: scheduled time, recorded time, measured delay. A divider marks the current
position. Remaining stops: scheduled time and that time shifted by the current delay, under
the label *below carries +M:SS forward, if it does not catch up*.

At `to`, the arrival window.

## Arrival window

For one train `T` with current measured delay `d` at its current stop, corridor segments
ahead `S₁…Sₙ` up to `to`, and scheduled arrival `a` at `to`:

- **lower bound** = `a + d`. Always shown, labelled *if it does not catch up*.
- **sample** = trains that passed every segment `S₁…Sₙ` with actuals in the last 60 minutes,
  most recent five, minimum three. For each, `added = delay(to) − delay(at T's current stop)`.
- **upper bound** = `a + d + max(added)`, floored at the lower bound.

Shown as *Arrives {to} HH:MM–HH:MM · from the last {k} trains* when the sample is ≥ 3, else
*Arrives {to} HH:MM if it does not catch up · too few trains ahead to say more*. The headline
train's window also appears in the caption under the diagram.

## Network map

Second view. Real track polylines from `line.journeyPatterns.pointsOnLink` for every line
with a stop in scope, drawn in SVG over a static coastline of the Oslofjord and no other
basemap, projected with Mercator and fitted to the viewport. Stations as dots; labels for
`from`, `to`, and stations with three or more lines.

Segments between consecutive stops are coloured by added delay with the same scale as the
diagram. Segments at or above one minute get a wider dimmed halo. The caption states how many
segments were measured and how many are adding a minute or more; when nothing qualifies it
says so, because grey must not be mistaken for healthy. Hover or focus on a segment shows the
pair, the added delay and n.

The map polls on the same schedule while visible; it fetches all in-scope stations, batched.

## Accessibility

Everything interactive is a real control — `select`, `button` — reachable by keyboard in
document order. Rows in the list are buttons carrying `aria-expanded`. Marks in the diagram
are `<a>` elements pointing at their row's id, with a `<title>` naming train, delay and
station. Focus is never moved on poll. Visible focus ring on every control, surviving inside
scrolling containers. The diagram carries `role="img"` with an `aria-label` summarising the
headline; everything it conveys is also present in the list and the caption. Colour is never
the only carrier: delay is also written, verdicts are words.

## Open

- `predictionInaccurate` and `situations` are fetched but unused; a `Færre vogner` notice may
  deserve a glyph in the list.
- Whether the gutter rows (*further out*, *not departed*) should collapse when empty or hold
  their height to keep the diagram stable across polls.
