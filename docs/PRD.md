# Ruteavvik — product requirements

**Status:** draft 3 · **Owner:** ashklianko · **Updated:** 2026-09-16
Supersedes draft 2: connection odds replaced by the arrival window, scope extended to
Akershus, success rephrased around daily use instead of a demo.

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
a filter on top.

The screen is a diagram, not a table: a vertical spine of stations, the user's station drawn
as a horizon across the full width. Above it, trains approaching; below it, trains already
past and the stretch the user is about to travel. Delay is encoded as horizontal
displacement — an on-time train sits on the spine, a late one has drifted off it, and its
trail over the last stops shows whether the drift is growing or shrinking. A calm line is a
straight line. A bad morning is visible without reading a single number.

- **Approaching trains** — measured delay, four-stop trail, growing / holding / shrinking,
  current position, stops away, line and train number. Ordered by measured arrival, not
  timetable. Three honest states, never blended: measured · starts here · not departed yet.
- **Trains ahead of you** — those that already left this station, and what the stretch you
  are about to travel did to them. Their loss is the best available estimate of yours.
- **One train, expanded** — stops passed with recorded times, stops remaining with the
  current delay carried forward.
- **Headline** — one sentence, no statistics, always present: the next train to `to`, its
  measured state, and where it is.

The diagram is always accompanied by a text list carrying the same facts, so nothing depends
on reading the picture.

### B · Where it is breaking

- **On your route** — the corridor segments below the horizon are coloured by the delay they
  are *adding*, measured over trains that passed them in the last hour. Suppressed below four
  passes; grey is "too few trains", never "healthy".
- **Across the network** — a map of all rail lines in scope, coloured the same way. Measured
  on a Tuesday afternoon: `Oslo S → Nationaltheatret, +1:49 per train, eleven trains in a
  row` — the Oslo tunnel, visible as a cause rather than a rumour. Context and exploration,
  not the thing you open at 07:38; built last.

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

Rail stations inside the bounding box `59.55–60.45 N, 10.30–11.60 E`: Oslo, Bærum, Asker
and the whole of Akershus, 100 stop places. The box also catches a dozen stations just
beyond the county line on Gjøvikbanen and Østre linje; they stay, because a pair selector
handles them and a county boundary would be a second data source for no user benefit.

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
  live within two seconds of opening on a phone over 4G, with no interaction.
- **Checkable.** Any displayed delay can be verified against the platform display or Vy's
  recorded time for that stop. No number on screen is a prediction.
- **Worth opening when nothing is wrong.** A calm morning shows a straight spine and says so.
  A screen that is only interesting during incidents never becomes a habit.
- **Legible cold.** Someone who has never seen it understands the picture without a legend
  being explained to them: on the line means on time, off the line means late.

## Risks

| risk | severity | mitigation |
|---|---|---|
| Displacement misread as position along the track | high | the axis is labelled in minutes on the horizon; the list carries the numbers; the spine is straight and obviously vertical |
| Quiet morning, everything on the spine | medium | that is the designed green state; the headline says "all N trains within a minute"; B still carries content |
| Measurements gone after 2–3 h | medium | the product is used in the moment; nothing depends on history |
| One sick train skews a segment | medium | n ≥ 4, grey below it |
| Reads as another departure board | medium | the diagram leads; scheduled times are the least prominent thing on screen |
| Arrival window rests on a small sample | medium | sample size stated in the sentence; below three trains only the lower bound is shown |
| Branching lines upstream of `from` | medium | rows above the horizon are indexed by stops away, not by station, so branches share the spine |
