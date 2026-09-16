# Ruteavvik

Measured rail delay for Oslo, Bærum and Akershus. No forecasts.

Norwegian railways call a train punctual if it reaches its **final** station within four
minutes (six for long distance). A train can therefore be late at every platform you stand
on and still count as *i rute*. Departure boards compound this: they show the operator's
prediction, which assumes full recovery — a train whose delay has grown for six consecutive
stops is still predicted to arrive exactly on time at every remaining stop.

Ruteavvik shows only what has already been observed.

## What it shows

**Corridor** — pick two stations. Every approaching train with its measured delay, a
four-stop trail, whether that delay is growing or shrinking, where the train is right now
and how many stops away. Expanding a train shows the stops it has passed with real recorded
times, then the remaining stops with the current delay carried forward unchanged — labelled
as arithmetic, not prediction.

**Network** — the map colours each segment by the delay it *adds* to trains passing
through it, measured from trains that already went by in the last hour. Carried delay is a
symptom; added delay is the cause. Measured on a random Tuesday afternoon:
`Oslo S → Nationaltheatret, +1:49 per train, eleven trains in a row`.

## Running it

Static page, no backend, no API key. React + TypeScript + Vite; `pnpm`.

```
pnpm install
pnpm dev
```

Data comes straight from the [Entur](https://developer.entur.org/) JourneyPlanner v3 API,
which is open and permits cross-origin requests; the only requirement is an
`ET-Client-Name` header. `pnpm build` produces `dist/` for any static host.

## Limits

Observed times survive roughly two to three hours in the API, then only the timetable
remains. Yesterday resolves but carries no measurements. No historical archive of Norwegian
rail punctuality exists at per-departure granularity — capturing it means recording the
stream continuously, which `collect.py` does.

## Documents

- [docs/PRD.md](docs/PRD.md) — problem, users, goals, non-goals, risks
- [docs/SPEC.md](docs/SPEC.md) — what each screen does, state by state
- [docs/DATA.md](docs/DATA.md) — what the Entur API actually gives, verified, with its traps
- [docs/DECISIONS.md](docs/DECISIONS.md) — what was decided and why
- [docs/MILESTONES.md](docs/MILESTONES.md) — the two-day plan and its cut order
