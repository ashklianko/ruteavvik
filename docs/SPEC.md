# Behaviour specification

**Status:** draft 3 · **Updated:** 2026-09-17 · Rationale lives in [DECISIONS.md](DECISIONS.md),
API reality in [DATA.md](DATA.md), scope in [PRD.md](PRD.md), plan in
[MILESTONES.md](MILESTONES.md). This file says only what the thing does. Supersedes draft 2,
written before the wide orientation, the map, the station state chip and the plain-words
labels existed.

## Vocabulary

| term | meaning |
|---|---|
| **measured delay** | `actualDepartureTime − aimedDepartureTime` at a stop the train has passed, in seconds; at a stop with only an arrival recorded, the arrival delay |
| **standing** | a train whose latest recorded event is an arrival: it is at that platform |
| **trail** | the last four measured delays of one train, oldest first |
| **verdict** | growing · holding · shrinking, derived from the trail |
| **added delay** | `delay(B) − delay(A)` across one segment, averaged over recent passes |
| **corridor** | the ordered stops from `from` to `to`, inclusive |
| **approach** | the stations trains come from before `from` |
| **track line** | the line of the diagram on which an on-time train sits; the spine in the tall orientation, the baseline in the wide one |
| **horizon** | the line across the diagram at `from`, dividing approaching from already-past |
| **displacement** | offset of a train mark from the track line, a function of measured delay |
| **arrival window** | earliest and latest measured arrival at `to` for a train, see below |
| **station state** | one word for the movement at `from`, from the last five departures |

No value derived from `expectedDepartureTime` is ever displayed. Every number on screen is
either recorded by the operator or arithmetic on such a record and the timetable, and the
projection is always labelled *if it does not catch up*.

## Global

One page. Top row: the pair selector with line chips on the left, the next-departure block
on the right, both holding a fixed height so the diagram never jumps when their text changes.
Below: the view links `Now`, `Last hour`, `Map`, an orientation toggle on the `Now` view, then
the chosen view, then the train list. In the bottom right corner sits the connection dot.

Views are hashes: none or `#`, `#timeline`, `#map`; `#debug` prints the derived corridor as
text. Selection of a train, hover and the line filter are shared by every view.

The pair (`from`, `to`, lines) persists in `localStorage` under `ruteavvik.pair` and mirrors
into the URL as `?from=&to=&lines=`, so a link opens the same pair; the URL wins on load. With
no pair the selector is open, the diagram shows an empty track line and the headline asks to
*pick where you are and where you are going*.

Polling every 20 s while the page is visible; paused when hidden, refetched at once on
return. A failed poll leaves the previous state on screen; the connection dot says what is
happening. Time on screen is Europe/Oslo. A `?snapshot=<name>` query loads a recorded response
from `public/snapshots/` instead of polling and freezes *now* at its recording time.

## Data

Stations for the selector come from `stopPlacesByBbox` over `59.55–60.45 N, 10.15–11.60 E`,
filtered to rail, deduplicated by name with a trailing ` stasjon` stripped. Stations
everywhere else come from the journeys themselves and are matched **by name**, never by id;
the bounding box returns multimodal parents, journeys reference rail children.

Per poll:

1. `estimatedCalls` at `from`, rail only, `startTime = now − 60 min`, `timeRange = 150 min`,
   with each call's service `date`.
2. For every distinct journey and date, the journey's full `estimatedCalls(date:)` with each
   stop's name, coordinates and platform, batched 25 per request. The date matters: after
   midnight an undated query returns tomorrow's empty run.
3. Trains whose calls do not include `to` after `from` are dropped from the list but still
   feed segment statistics. `F`-coded long-distance trains are dropped entirely; Flytoget
   (`FLY1`) stays.
4. From every fetched journey, every consecutive pair of stops that both carry a recorded
   departure becomes one segment observation `delay(B) − delay(A)`, timestamped with the
   recording at `B`.

Traps handled in the model: a recorded arrival at a train's origin is the empty stock arriving
and is ignored; a departure more than ten minutes early is garbage and is ignored. Cancelled
calls are excluded from statistics and shown in the list as *cancelled*. An unmeasured train
whose timetable departure from `from` is more than five minutes past is dropped.

## Selector

`from` and `to` are searchable inputs: typing filters the station list without regard to
case or Norwegian letters (`skoyen` finds Skøyen, `as` finds Ås and Asker), arrows and Enter
choose, Escape closes, a click chooses; leaving the field without choosing restores the old
value. A swap button between them reverses the pair. Changing either station clears the line
filter and the selection.

Line chips show the lines serving the pair. None selected means all. A selected chip has a
brighter border and bold text, the others dim; an *all lines* chip clears the filter. When
only one line serves the pair it is shown as a passive chip with the words *only line on this
pair*. The filter applies to every view and to the rows of the diagram: with only regional
lines selected, local-only stations disappear. Segment statistics always use every train.

## Next departure

The block on the right answers *when do I leave* in two lines, kept to fixed height on wide
screens with the tail of a long sentence cut by an ellipsis.

**Line one.** A station-state chip, then the time, then one sentence.

- The **chip** is a coloured dot and one word for the movement at `from`, from the median
  delay of the last five trains that actually left the station in the past hour: within a
  minute *running well*, to three *small delays*, to eight *delays*, beyond that or with a
  cancellation *disrupted*, fewer than three departures *too few trains to say*. Hover or
  focus shows the five departures and the median.
- The **time** is when the next train will actually leave `from`: timetable plus its current
  measured delay, or the timetable alone for an unmeasured train. A train standing at the
  platform shows **Now** instead. It is set in the display size and dotted-underlined: it is a
  button.
- The **sentence**: `R13 to Dal, 7 min late and holding at Lier, platform 4`. The platform is
  last so it is what the ellipsis eats. Variants: *on time, 2 stops away*; *at your platform*;
  *starts here*; *timetable only*.

**Line two.** *Then* and the next two trains as clickable times with their delay in words in
brackets when over a minute, *timetable* when unmeasured.

Hovering any of these times highlights that train in the diagram and the list; clicking
selects it, expands its row and scrolls the list to it. The next train is the one with the
earliest measured arrival at `from`, not the earliest timetable slot.

## Diagram

An SVG redrawn on every poll with transitions on position only, in one of two orientations
that carry the same rows, marks and colours:

- **Wide**, the default from 900 px: stations left to right, `from` a vertical rule labelled
  *you are here*, delay upwards from the line of track. The diagram spans the page, the list
  sits beneath.
- **Tall**, the default below 900 px: stations top to bottom, `from` a horizontal horizon,
  delay to the right. Diagram and list side by side when there is room.

The toggle beside the view links switches between them; the choice is remembered in
`localStorage` under `ruteavvik.orientation` and wins over the width default. The rest of
this section reads in the tall orientation; the wide one is the same picture turned a quarter
turn, with station names set at 45° under the track.

Permanent orientation labels: *trains coming towards you* on the approach side, *already
left, on the way to {to}* on the corridor side, *minutes late* with an arrow on the scale.

### Rows

Rows are stations. Trains enter from the far end and travel towards `to`.

- **The approach** holds the stations trains come from, nearest to `from` closest to the
  horizon, ordered by straight-line distance from `from` using coordinates carried in the
  journey response, so branches and parallel lines interleave by geography rather than by
  stop count or running time. Of that order, the stations passed by the most trains become
  rows: twice as many as the corridor has segments, never fewer than four nor more than
  eight. A train at a station without a row sits between its neighbours' rows; its label stays
  the line code, the position says where it is, and hover names the station. Trains beyond the last row sit in a gutter at the far end, *further
  out*, which grows to three rows' worth of space and spreads them by distance so several far
  trains do not pile on one spot; their trails stop at the first stop without a row.
- **The horizon** is `from`, with the station name in bold.
- **The corridor** holds the stations from `from` to `to` in running order, taken from the
  most complete journey pattern among the trains shown. When the approach is still the wider
  side, corridor row spacing stretches up to twice so `from` lands near the middle of the
  axis and a two-stop corridor is not dwarfed.
- Two further gutters appear only when needed: *not departed yet* for trains still to leave
  their origin, and the *further out* gutter above.

### Two tiers of station

A station where no regional or airport train serving the pair stops is *minor*: its row is
24 units instead of 44, its label smaller and fainter, its tick shorter. `from` and `to` are
always major. When only local trains serve the pair nothing is minor.

### Displacement

`x(delay)` is linear from zero to the axis maximum, which adapts to what is on screen: the
smallest of 3, 5, 10 or 15 minutes that holds the worst measured delay with 15 % headroom.
On a calm morning the axis is three minutes wide and a one-minute train sits a third of the
way out; on a bad day it is fifteen. Beyond the maximum the mark pins to the edge with a `»`
and the label stays exact. Early trains get a small nudge the other way, 4 % of the axis at
−1 min, clamped there. Ticks follow the maximum. The track line stands just past the longest
station name so the late side gets the width; the early side is a short stub.

Displacement never encodes anything but delay; the station axis never encodes anything but
station order.

### Marks

Each measured train is a filled circle coloured by its delay, not by its line: soft green
within a minute, yellow-green to two, amber to five, orange to ten, red beyond, cool blue
when early. At rest the label is the line code only, *R14*; colour and position already say
how late. Hovering expands it to line, destination, delay in words and current station.
Behind the mark its **trail**: hollow dots at the previous measured stops joined by a faint
dotted straight line, nearer dots brighter, so a mark reads as a train with footprints, not a
shape with a tail. A growing delay is a trail leaning away from the track line on the way in.

Trains stacked on one station within 20 seconds of each other collapse into one mark with a
count, *3 trains*, that opens on hover into its members.

Three states, never blended:

- **measured** — filled mark at its current row and displacement, trail. When only the
  arrival is recorded the train is *standing*, and label, list and headline say so.
- **starts here** — one hollow mark on the horizon at zero; several such trains share it,
  labelled with their count and the next departure.
- **not departed yet** — one hollow mark in its gutter labelled with the count and the first
  timetable time, *3 not departed, first 09:32*; the list names each.

A train that already passed `from` and is between `from` and `to` is drawn on the corridor
side with the same rules; these are *trains ahead of you*. Trains that already reached `to`
leave the diagram but still feed segment statistics.

### Ghost position

A measured train's mark stays at its last measured stop until the next poll. For the hovered
or selected train only, a smaller hollow mark slides from that stop towards the next one, its
progress being the time since the recorded departure divided by the timetable run time of the
segment. It waits at the next row when the train is due but not yet recorded. Arithmetic on a
measured departure and the timetable, drawn hollow so it is never mistaken for a measurement.
No ghost while only an arrival is measured.

### Focus

Hovering or focusing a train, in the diagram, the list or the next-departure block, dims
every other train and draws its arrival window on the `to` row as a bracket from the
displacement of its carried delay to that of the worst recent added delay, labelled with the
two clock times. Clicking a mark selects the train, expands its row and scrolls the list to
it; clicking the background or pressing Escape clears the selection. Selection survives polls.

### Segments

Each corridor segment between consecutive rows is coloured by the delay it adds over the last
60 minutes, rail only, n ≥ 4:

| adds | colour |
|---|---|
| catching up, below −30 s | cool blue |
| −30 s to +60 s | track colour: half a minute lost on a stretch is not a delay |
| a minute or so, 60–120 s | straw |
| two to three minutes, 120–180 s | amber, with a soft glow |
| three to five minutes, 180–300 s | orange, glow |
| more than five minutes | red, glow |
| fewer than 4 passes | dashed grey, *too few trains to say* |

Hovering or focusing a segment shows `{A} to {B}, adding two to three minutes, +2:34 over 6
trains` as a tooltip, highlights the trains that passed it inside the window and replaces
each one's label with the seconds it lost or gained there, *L1 +0:41 here*. The approach side
of the track line is plain: its rows come from merged patterns, so a gap between two rows is
not necessarily one piece of track.

### First opening

Until the user has changed the pair or selected a train once, one sentence under the diagram
says what the picture means: *On the line means on time. Drifting right means late, by the
minutes on the scale. Tap a train to follow it.* Remembered in `localStorage`.

### Green state

Every train on the track line, soft green, no labels but line codes, segments in track
colour, the chip *running well*. This must look finished, not empty.

## List

Beside or beneath the diagram. One row per train, ordered by measured arrival at `from`,
unmeasured ones by timetable. Unmeasured trains are shown only when due within 30 minutes;
the rest are summed up in one line, *8 more trains by timetable until 15:01, not running yet*.

Each row: timetable departure · line · train number · `origin – destination` · departure
platform at `from` as a small tag; below, the state in words: *4 min late, growing, at Lier,
2 stops away* with the four trail readings in mono, *on time, standing, at your platform*,
*originates here*, *not departed*, *cancelled* struck through. Unmeasured rows are quieter.
Trains ahead of you sit under a divider *already past {from}*.

Verdict thresholds: last minus first of the trail, ±45 s. Fewer than three readings yields
*one reading* / *two readings* and no direction word.

Selecting a row or a mark highlights both, dims the rest and expands the row in place.

## Train detail

Expands under the selected row; does not navigate. Passed stops, at most the last eight, with
timetable time, recorded time and measured delay; the current stop in bold with a small train
glyph beside it. Then *below carries +M:SS forward, if it does not catch up* and the remaining
stops to `to` with timetable time and that time shifted by the carried delay. At the end the
arrival window sentence. For an unmeasured train only the timetable, and a note saying so.

## Arrival window

For one train `T` with current measured delay `d`, its current stop `S`, and scheduled
arrival `a` at `to`:

- **lower bound** = `a + d`, labelled *if it does not catch up*.
- **sample** = other trains that passed both `S` and `to` with recordings in the last 60
  minutes, the most recent five, minimum three; for each, `added = delay(to) − delay(S)`.
- **upper bound** = `a + d + max(added)`, floored at the lower bound.

Shown as *Arrives {to} HH:MM–HH:MM, from what the last {k} trains did on this stretch*, or
with fewer than three trains *Arrives {to} HH:MM if it does not catch up. Too few trains ahead
to say more*. The next train's window also appears in the caption under the diagram.

## Last hour

Second view. Time runs across, from 100 minutes ago to 30 minutes ahead, a rule at the
current time. Stations run down: the same rows as the diagram. Every train serving the pair,
including those already past `to`, is one line coloured by its last measured delay: solid
through recorded times, a faint dashed twin through the timetable, a dotted continuation
carrying the current delay forward. The horizontal gap between dashed and solid is the delay.

Hovering or selecting a train, here or in the list, dims the rest and labels it at its last
recorded stop. **Scrubbing:** moving the pointer along the time axis rewinds the whole page to
that moment, every recording after it forgotten; the diagram beside the chart, the headline
and the list show the line as it was then, with the moment named. Leaving the chart returns
to now. Mouse only.

## Map

Third view. A dark vector basemap (OpenFreeMap, MapLibre) with the chosen pair's trains where
they are along the real track, and nothing else.

- **Track.** Every journey pattern the pair's trains use, drawn faint. The corridor is cut
  station to station and coloured by added delay with the diagram's scale and glow, dashed
  below four passes. Hovering a stretch shows `{A} to {B}: steady, +0:34 over 4 trains`.
- **Stations.** Dots at the corridor and approach rows, `from` ringed and named brighter;
  names for the major ones.
- **Trains.** A mark per measured train at its position: solid when recorded at a station or
  standing, a ring when carried along the track by timetable run time since the last recorded
  departure, dashed ring when due at the next station but not yet recorded. Colour by delay,
  label the line code. Trains not departed are counted in the note under the map, not drawn.
- **Hover** expands the label to line, destination, delay in words and where it was last
  recorded. **Click** opens a panel over the map with line, number, `origin – destination`,
  state, timetable departure and platform at `from`, and the same detail as the list; close
  with the cross or a click on the map.
- The camera fits the corridor and approach once per pair; polls move marks, not the camera.
- Without WebGL the view says so and points at the other two.

## Connection

A fixed dot in the bottom right corner: green when the last poll succeeded within two and a
half poll intervals, pulsing grey while the first answer is awaited, amber with the time of
the last good answer beside it when Entur stops answering, grey when the browser is offline
or a snapshot is shown. Hover or focus explains it, *Updated 07:41:12, next in 12 s* or
*Offline, showing data from 07:38*; a click polls at once.

## Accessibility

Everything interactive is a real control, reachable by keyboard in document order: inputs,
buttons, anchors for marks with a `<title>` naming train, delay and station, focusable
segments with an `aria-label`. Rows carry `aria-expanded`. Focus is never moved on poll.
Visible focus ring on every control. Both diagrams carry `role="img"` with a summary
`aria-label`; everything they convey is also in the list. Colour is never the only carrier:
delay is written in words, verdicts are words, the chip has a word. A full keyboard pass is
deferred, see MILESTONES.

## Open

- `predictionInaccurate` and `situations` are fetched but unused; a *Færre vogner* notice may
  deserve a glyph in the list.
- Gutter rows collapse when empty; whether that jumps too much across polls is still to be
  judged on a real peak.
- The wide orientation lacks the tall one's mark clusters and arrival bracket.
- Station names at 45° in the wide orientation get tight when a corridor has many minor
  stops; a hide-when-crowded rule may be needed.
