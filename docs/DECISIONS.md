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

## 9 · Scope box `59.55–60.45 N, 10.30–11.60 E` — Oslo, Bærum, Akershus

The Oslo/Bærum box left Eidsvoll, Jessheim, Ski and the whole north and east of Akershus
outside. Re-measured live on 2026-09-16: the old box yields 48 rail stop places, the new one
100. The new box also catches a dozen stations just beyond the county line — Hadeland on
Gjøvikbanen, Indre Østfold on Østre linje.

**Kept, not pruned.** A county boundary would be a second data source and a maintenance
burden for no user benefit: a pair selector already handles a long list, and someone in
Akershus riding to Mysen is still the audience.

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
fifteen take the rest, beyond that the mark pins to the edge. Early trains mirror left,
clamped at two minutes. The horizon carries the minute scale so the axis is never implied.

**Vertical spine, flowing down.** Trains enter at the top and travel towards `to` at the
bottom. Above the horizon rows are *stops away*, because lines branch upstream and a
relative index lets every branch share one spine; below it rows are the concrete corridor.

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
