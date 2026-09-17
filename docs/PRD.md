# Ruteavvik — product requirements

**Status:** draft 4 · **Owner:** ashklianko · **Updated:** 2026-09-17
Supersedes draft 3 after the first day of building and a morning peak: describes the two
orientations, the station state, the connection dot and the map as built, and scope with
Drammen.

## The moment

07:38, Bærum, February, dark. A person has a coat on and a decision to make: leave now, or
wait four minutes. They open one thing and want it answered before the kettle boils.

The same person, on the platform, wants to know when they will actually arrive — not when
the board says they will.

## Who it is for

People who live in Oslo, Bærum and Akershus and take the train to work. They know their
station and their destination. They open the page for eight seconds on a phone, and for a
minute when the line is bad and they want to know why.

Not a target: dispatchers, operators, researchers. The tool takes the passenger's side.

## Three questions, in order

The product exists to answer exactly these, and it answers them from measured data only.

**1 · What is actually happening?**
Not "is my train late" — every app answers that. *Where are the trains on my line right now,
how late is each one, and is that getting better or worse.*

**2 · Where is it breaking?**
Which stretch of track is losing time at this moment, measured across the trains that went
through it in the last hour. Delay carried is a symptom; delay added is the cause, and only
the cause tells you whether it will still be there when your train arrives.

**3 · When will I actually arrive?**
An arrival window at `to`, derived from what the last trains over the same stretch actually
did — not a forecast. The lower bound carries the current delay unchanged; the range comes
from measured added delay on the segments ahead.

Each answer feeds the next. That ordering is the product.

## The rule the whole thing rests on

**Nothing is displayed that was not measured.**

Norwegian railways count a train punctual if it reaches its **final** station within four
minutes, six for long distance. Delay at intermediate stops is not measured, not reported,
and does not move the published figure — currently 87.2%.

The forecast compounds this. Observed on a live service: delay grew across six consecutive
stops — `+25s, +80s, +76s, +96s, +86s, +132s` — while the prediction for all twelve
remaining stops stayed at exactly `+0`. Every board in the country shows that optimistic
number, unmarked.

So the product shows `actualDepartureTime` and differences derived from it. Where nothing
has been measured it says so. Where it projects forward it carries the current measured
delay unchanged and labels it *if it does not catch up* — arithmetic, not prediction.

## Why the operator will not build this

Not an oversight. An operator cannot ship an instrument that shows its own published metric
excludes the delay its passengers experience, nor annotate its own forecast as unreliable.
The conflict is structural.

## Core

### A · The line, as it is right now

Pick `from` → `to`. The pair fixes direction and makes "three stops away" meaningful. Line is
a filter on top, and it also decides which stations are drawn.

The screen is a diagram, not a table: stations along one axis, the user's station drawn as a
line across the full width, trains approaching on one side and already past on the other.
Delay is encoded as displacement from the line of track: an on-time train sits on it, a late
one has drifted off, and its footprints over the last stops show whether the drift is growing.
Colour says the same thing in a second channel, soft green to red by minutes. A calm line is
a straight line of green marks. A bad morning is visible without reading a number.

Two orientations of the same picture: stations across and delay upwards on a wide screen,
stations down and delay to the right on a phone, with a toggle to override. The delay axis
adapts to the worst train on screen so a quiet morning is not squeezed against the line.

- **Next departure**, the first thing read: the time the next train will actually leave, in
  large type, with one sentence of why and the platform; then the two after it. Beside it a
  one-word **station state**, from what the last five trains actually did at this station.
- **Approaching trains** — measured delay in words, footprints, growing / holding /
  shrinking, current position. Ordered by measured arrival, not timetable. Three honest
  states, never blended: measured · starts here · not departed yet.
- **Trains ahead of you** — those that already left this station, and what the stretch you
  are about to travel did to them.
- **One train, expanded** — stops passed with recorded times, stops remaining with the
  current delay carried forward, the arrival window.

The diagram is always accompanied by a text list carrying the same facts, so nothing depends
on reading the picture, and a connection dot says when the data was last refreshed.

### B · Where it is breaking

- **On your route** — the corridor segments are coloured by the delay they are *adding*,
  measured over trains that passed them in the last hour. Suppressed below four passes; grey
  is "too few trains", never "healthy". Half a minute lost on a stretch is not a delay and
  stays in the track colour.
- **Last hour** — a time chart of every train on the pair over the past hundred minutes,
  recorded times solid, timetable dashed, so the place where every line bends the same way is
  the cause. Moving along its time axis rewinds the whole page to that moment.
- **Map** — the pair's trains where they are on the real track, on a dark basemap, the
  corridor coloured the same way. Measured on a Tuesday afternoon: `Oslo S →
  Nationaltheatret, +1:49 per train, eleven trains in a row` — the Oslo tunnel, visible as a
  cause rather than a rumour.

### C · Your arrival

For the next train, and for any selected one:

> Arrives Oslo S **08:14–08:17**.
> Scheduled 08:12. Currently +1:04 at Lysaker.
> The last five trains over this stretch added between +0:10 and +2:40.

The lower bound is scheduled time plus current delay — arithmetic. The upper bound adds the
worst measured added delay over the segments ahead among recent trains. With fewer than
three completed trains to draw on, only the lower bound is shown, labelled *if it does not
catch up*. The sample size is always stated.

### The argument, as one line

> In the last hour, N trains through this station were more than four minutes late at at
> least one stop. None of that reaches the punctuality figure if they recover by the end.

One line, pure arithmetic over data already loaded. It is what makes the project a claim
rather than a utility.

## Scope

Rail stations inside the bounding box `59.55–60.45 N, 10.15–11.60 E`: Oslo, Bærum, Asker,
the whole of Akershus, and Drammen with the stations up to it, 106 stop places. Long-distance
`F` trains are excluded; Flytoget is not. The box also
catches a dozen stations just beyond the county line on Gjøvikbanen and Østre linje, plus
Hønefoss and Sande; they stay, because a pair selector handles them and a county boundary
would be a second data source for no user benefit.

## Out of scope

- **A European register.** The method ports to any GTFS-RT feed — 6000+ catalogued, and the
  Dutch feed is open and keyless, verified. It is a real second act. It is not this.
- **Recorded history.** Measurements evaporate from the API in two to three hours. Building
  a day-over-day picture means recording continuously; `collect.py` exists and is not running.
- **Connection risk.** Needs a third input and serves only those who transfer. The arrival
  window answers the same question for everyone.
- **Journey planning, ticketing, routing.** Three good products already do this.
- **Alerts, accounts, sharing.** Later, if the thing proves useful.
- **Bus, tram, metro.** The punctuality definition under challenge is rail's.

## Success

This is a daily utility, so success is measured on ordinary mornings, not at a demo.

- **Habit.** The owner opens it every weekday morning for two weeks before opening Vy, and
  keeps doing so. If Vy still gets opened first, the product has failed regardless of how it
  looks.
- **Time to answer.** With a remembered pair, the headline and the diagram are on screen and
  live within two seconds of opening https://ashklianko.github.io/ruteavvik/ on a phone over
  4G, with no interaction.
- **Checkable.** Any displayed delay can be verified against the platform display or Vy's
  recorded time for that stop. No number on screen is a prediction.
- **Worth opening when nothing is wrong.** A calm morning shows a straight spine and says so.
  A screen that is only interesting during incidents never becomes a habit.
- **Legible cold.** Someone who has never seen it understands the picture without a legend
  being explained to them: on the line means on time, off the line means late.

## Risks

| risk | severity | mitigation |
|---|---|---|
| Displacement misread as position along the track | high | the axis is labelled in minutes; colour repeats the message; *you are here* and the two side labels are permanent; the list carries the words |
| A first-time viewer does not understand the picture | high | one sentence of explanation on first opening, delays in words not codes, colour by delay not by line; the owner's partner is the test |
| Quiet morning, everything on the spine | medium | that is the designed green state: green marks on the line and the station chip *running well*; B still carries content |
| Measurements gone after 2–3 h | medium | the product is used in the moment; nothing depends on history |
| One sick train skews a segment | medium | n ≥ 4, grey below it |
| Reads as another departure board | medium | the diagram leads; scheduled times are the least prominent thing on screen |
| Arrival window rests on a small sample | medium | sample size stated in the sentence; below three trains only the lower bound is shown |
| Branching lines upstream of `from` | medium | rows above the horizon are indexed by stops away, not by station, so branches share the spine |
