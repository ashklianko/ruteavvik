# Decisions

**Status:** draft · Newest last. Each entry records what was decided, why, and what it costs.

---

## 1 · Display only measured values, never the operator's forecast

The forecast assumes recovery that the measurements contradict — delay grew across six
consecutive stops while the prediction for every remaining stop stayed at `+0`. A product
whose premise is that the official number misleads cannot then repeat that number.

**Cost.** The displayed departure time is also a forecast, so it goes too. Trains that have
not left their origin have nothing to show; they say so. At stations near line origins this
is a large share — four of seven at Asker — which makes the empty state a designed thing
rather than an edge case.

**Consequence.** Forward projection carries the current measured delay unchanged and is
labelled *if it does not catch up*. That is arithmetic, and it is the honest lower bound.

---

## 2 · Select a station pair, not a station and a direction

Direction as its own control is ambiguous here: from Sandvika "toward Oslo" covers five
terminals — Lillestrøm, Eidsvoll, Dal, Kongsvinger, Oslo lufthavn. A dropdown either lists
all of them or lies by collapsing them.

`from` → `to` fixes direction implicitly and, more importantly, gives *stops away* and
*track ahead* something to be measured against.

**Cost.** Departs from the original request, which was station plus direction. Line becomes
a filter on top rather than a primary axis.

---

## 3 · Colour segments by delay **added**, not delay carried

The first sketch coloured track by how late the trains on it were. That is a symptom: those
trains were already late somewhere else and are merely transporting the number.

Colouring by `delay(B) − delay(A)` across recent passages shows where the network is
generating delay right now. It is also the only version of the map no one else can build
from a single train's data — it requires comparing trains against each other.

**Cost.** A derivative is harder to read than a level, so the map must state its metric in
words or it will be misread as "how late is it here".

---

## 4 · Window 60 minutes · n ≥ 4 · rail only

Sixty minutes because the morning peak does not need more and the API's measurement horizon
is only two to three hours anyway. Four passes because a single sick train otherwise paints
an entire segment red. Rail only because the punctuality definition under challenge is
rail's, and because unfiltered bbox results drag bus stops into the statistics.

---

## 5 · No backend

Entur permits cross-origin requests and requires no key, so the page calls the API directly.
Nothing to deploy, nothing to secure, no key to leak, and the whole product is one static
file.

**Cost.** Anything requiring persistence — recorded history, alerts, accounts — needs this
revisited. `collect.py` already sits outside the page for that reason.

---

## 6 · Name: Ruteavvik

*Rute* is the timetable path; *avvik* is deviation, and it is the operator's own word,
printed on every disruption notice a Norwegian commuter has ever read. **"I rute" means
"on time"** — the phrase used to declare a train punctual. `Ruteavvik` negates it directly,
in the operator's vocabulary.

Rejected: *Faktisk* (faktisk.no is an established Norwegian fact-checking organisation),
*Ground Truth* and *Measured* (accurate but generic), *Sporfeber* (memorable, too playful
for an accountability claim), *Trafikkavvik* and *Kollektivavvik* (dilute rail specificity).

---

## 7 · English interface, desktop first, map as a tab

English because the audience is mixed, while station names, line codes and train numbers
stay Norwegian regardless. Desktop first because that is where it gets built and shown,
phone-usable because that is where it gets used. Map as a tab because the corridor view is
the working tool and the map is context — two panes would make each fight the other.

---

## 8 · A trend needs three readings

Two measurements produced verdicts like `+5:16 holding`, which is noise wearing a
confident label. Below three readings the product says *one reading* and claims nothing.

---

## 9 · Scope box `59.55–60.45 N, 10.15–11.60 E` — Oslo, Bærum, Akershus, Drammen

The Oslo/Bærum box left Eidsvoll, Jessheim, Ski and the whole north and east of Akershus
outside. Re-measured live on 2026-09-16: the old box yields 48 rail stop places, the new one
100. The new box also catches a dozen stations just beyond the county line — Hadeland on
Gjøvikbanen, Indre Østfold on Østre linje.

**Kept, not pruned.** A county boundary would be a second data source and a maintenance
burden for no user benefit: a pair selector already handles a long list, and someone in
Akershus riding to Mysen is still the audience.

**Extended west on 2026-09-16** to 10.15 E so Drammen, Brakerøya, Lier and Gulskogen can be
chosen as an end of a pair: every regional train through Sandvika comes from there, and the
owner asked for it. Hønefoss and Sande ride along; 106 stop places.

**Cost.** The network map has to fetch about a hundred stations per poll. The corridor view
does not care: it fetches one station and the journeys through it.

---

## 10 · Stack: React 19 + TypeScript + Vite, D3 as maths only, TanStack Query

Two days, static hosting, and the code is written by an agent, so the stack is chosen for
the writer's reliability, not the owner's habits. React is where the writer makes the fewest
quiet mistakes and where every visualisation library is aimed first. SVG comes out of JSX
directly; React owns the DOM.

D3 is imported as modules for arithmetic, never as a renderer: `d3-scale` for the piecewise
displacement (`scaleLinear().domain([-2, 0, 5, 15]).clamp(true)`), `d3-shape` for trails,
`d3-array` for segment aggregation, `d3-geo` for the map projection and fit.
`@mapbox/polyline` decodes `pointsOnLink`. TanStack Query runs the polling — interval,
pause when hidden, refetch on return, stale data kept on error — which is exactly what SPEC
asks for and is tedious to hand-roll. Tailwind v4 holds the palette and type as `@theme`
tokens and lays out the chrome; the SVG is styled in plain CSS on those tokens. Vitest covers
the data layer, where every claim on screen is computed. Plain `fetch` against GraphQL with
hand-written types; no client library, no codegen, no router — the network view is a hash.
Drift animation is a CSS transition on `transform`; `motion` is the upgrade if spring physics
is wanted.

**Rejected.** Preact: the first pick, on the ground that it is the owner's daily stack;
withdrawn once it was clear the owner is not writing the code. Svelte 5: a better fit for a
fine-grained diagram on paper, but runes are new enough to cost mistakes. Vanilla + D3
selections: perfect for the marks, painful for the selector, list and detail.

**Cost.** Larger bundle than Preact by about 30 KB gzipped. Irrelevant for a page opened once
a morning.

---

## 11 · SVG, not canvas; map without a tile basemap, with a static coastline

A morning shows at most a few dozen trains, a hundred trail points and forty segments. SVG
gives hit-testing, `<title>` tooltips, focusable marks and CSS transitions on transform for
free, which is exactly the drift animation the diagram needs. Canvas would rebuild all of
that by hand to solve a performance problem that does not exist at this size.

The network map is SVG too, projected with `d3-geo`, so the two views share one visual
system. A single static GeoJSON of the coastline and the Oslofjord gives geographic
anchoring for the cost of one file. A tile basemap (MapLibre with OpenFreeMap was the
candidate) adds a quarter-megabyte of WebGL and a second styling system to draw streets that
say nothing about where the network loses minutes.

**Escape hatch.** The lines are about twenty thousand polyline points. If they stutter on a
phone they are simplified first (`topojson-simplify` or a Douglas–Peucker pass), and only if
that fails does the map alone move to canvas; the diagram does not.

---

## 12 · The three visual questions, closed

**Displacement encodes delay.** Piecewise linear: five minutes take 60 % of the half-width,
fifteen take the rest, beyond that the mark pins to the edge. Early trains were first
mirrored left and clamped at two minutes; on 2026-09-16 the early side was cut to a 6 % nudge
at one minute, because trains are rarely early and the late side needed the room. The horizon carries the minute scale so the axis is never implied.

**Vertical spine, flowing down.** Trains enter at the top and travel towards `to` at the
bottom. Above the horizon rows were first *stops away*, because lines branch upstream and a
relative index lets every branch share one spine; below it rows are the concrete corridor.
Superseded above the horizon by 15.

**The list is always visible.** It is the accessible twin of the diagram and the place where
numbers live; the diagram is for shape. Detail opens on selection inside the list. Hiding the
list behind a selection would make the picture the only source of truth, which it must not be.

---

## 13 · Arrival window replaces connection odds

The connection question needed a third input and served only those who transfer. The arrival
window — scheduled arrival plus current delay as the floor, plus the worst added delay
measured on the segments ahead among the last five trains as the ceiling — answers *when do I
actually get there* for everyone, and anyone with a connection can subtract.

**Cost.** Less dramatic than "two of five would have missed it". Honest, and checkable by hand.

---

## 14 · Whether Vy or Ruter warn about connections — closed as moot

With 13, the product makes no claim about connections, so what the operators do about them
no longer affects scope.

---

## 15 · Station names above the horizon, not stops away

*Stops away* depends on the train: an express at Drammen is two stops from Sandvika, a local
at Drammen is nine. The same station landing on different rows made the picture lie about
geography, and the owner found the relative labels unreadable. Rows above the horizon are
now stations.

Branching was first handled by merging running orders by stop index, which put the tail of a
branch with many small stops "further out" than Drammen. Stop index is not distance. Scheduled
running time was tried next and failed the same way in reverse: Asker sorted before Hvalstad
because expresses reach Sandvika in five minutes, and Eidsvoll sorted before Jessheim because
Gardermobanen is fast. Time depends on the train; distance does not. Rows are ordered by
straight-line distance from the station to `from`, from coordinates carried in the journey
response, with running time as the fallback for recordings made before coordinates were
fetched. The eight stations passed by the most trains are shown. A train at
an unshown station sits between its neighbours and names the station in its label; beyond the
last row it sits in the *further out* gutter.

**Cost.** Two branches read as one column with a seam at the junction. The label on the mark
carries the truth when the row does not.

---

## 16 · The route map draws on a tile basemap, MapLibre with OpenFreeMap

Decision 11 kept the network map off a basemap. The route map that replaced it shows one
pair's trains where they physically are, and a train on a bare polyline over nothing is not
a map. MapLibre GL renders the free OpenFreeMap `dark` vector style, keyless, with
attribution kept. It loads lazily so the first screen stays at 108 KB gzipped; the map chunk
is 281 KB more, paid only when the tab is opened.

Geometry comes from `serviceJourney.journeyPattern.pointsOnLink`, fetched once per distinct
journey pattern the pair's trains use and cached in `localStorage`; the API has no root
`journeyPattern(id)` query, so a representative journey id is used. Stops are snapped to the
nearest polyline vertex in running order, a train's position is interpolated along the cut
between its last recorded stop and the next by timetable run time, and drawn as a ring when
interpolated and a solid mark when recorded at a station, in the manner of togkartet.no's
GPS-versus-calculated distinction.

**Cost.** WebGL is required; browsers without it get a sentence and the other two views. A
third rendering technology beside SVG and HTML. MapLibre 6 ships its worker as a separate
module that a bundler will not find on its own; it is imported through Vite's worker
pipeline and handed to `setWorkerUrl`, otherwise tiles and GeoJSON never parse and the map
stays a black rectangle with markers on it, which is exactly how the first build looked.

---

## 17 · Colour by delay, words instead of codes

The first build coloured marks by line family. A person who had never seen the diagram read
green as "good" while the train was four minutes late. Colour now encodes delay on every view
with one scale, soft green through straw, amber and orange to red, and the line lives in the
label and the chips. `+4:29` read as a clock time; delays are written *4 min late* wherever a
person reads them, and seconds stay in the trail and the expanded detail. At rest a mark
carries only its line code: position and colour already say how late.

**Cost.** Two lines of the same family look alike on the diagram. The list and the chips carry
the line, and hover names it.

---

## 18 · Wide orientation by default on wide screens

Stations across and delay upwards read without explanation: direction of travel is left to
right, higher is worse. The tall orientation wins on a phone, where stations scroll naturally
and a horizontal axis would compress sixteen stations into 400 px. So the orientation follows
the width, 900 px as the line, with a toggle that is remembered and wins over the default.
Both are one layout turned a quarter turn: the tall layout's row coordinates are mapped onto
the wide axis, so rows, gutters, minor stations and stretching are shared code.

**Cost.** Station names on the wide axis are set at 45° and get tight on corridors with many
minor stops.

---

## 19 · Adaptive delay axis, balanced station axis

A fixed 0–15 minute axis squeezed a normal morning, where everything lives within two
minutes, into a sliver by the track line. The axis now picks the smallest of 3, 5, 10 or 15
minutes that holds the worst train on screen with headroom. On the station axis, the approach
gets twice as many rows as the corridor has segments, bounded to four and eight, and a short
corridor stretches its spacing so the user's station stays near the middle. Trains beyond the
last row spread through a wider gutter by distance instead of piling on one point, and their
footprints stop at the first stop without a row.

**Cost.** The axis changes between polls when the worst train crosses a step. Marks move with
a transition, and the steps are far apart, so it happens rarely.

---

## 20 · Softer thresholds throughout

Thirty seconds is not a delay to a commuter. Marks are green within a minute and straw to
two; a segment is in the track colour up to a minute added and straw to two; the station
state calls a median under a minute *running well*. The official punctuality threshold is
four minutes at the final station, so a scale that shouts at thirty seconds would undermine
the product's own argument.
