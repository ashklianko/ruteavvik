# Ruteavvik

Measured rail delay for Oslo, Bærum and Akershus. No forecasts.

Norwegian railways call a train punctual if it reaches its **final** station within four
minutes (six for long distance). A train can therefore be late at every platform you stand
on and still count as *i rute*. Departure boards compound this: they show the operator's
prediction, which assumes full recovery — a train whose delay has grown for six consecutive
stops is still predicted to arrive exactly on time at every remaining stop.

Ruteavvik shows only what has already been observed.

## What it shows

Pick two stations. The **Now** view is a diagram of the line between them as it is at this
moment: stations along one axis, your station as a line across it, each train a mark whose
distance from the line of track is its measured delay, coloured green to red by minutes, with
footprints over its last stops. The next train's real departure time and platform sit at the
top, with a one-word state of the station from what the last five trains actually did. The
corridor ahead is coloured by the delay each stretch *adds*, measured on the trains that just
went through it. A list beside the diagram carries the same facts in words, and each train
expands into its recorded and carried-forward times.

**Last hour** is a time chart of the same trains, recorded times solid and timetable dashed;
drag along it and the whole page rewinds. **Map** puts the pair's trains on the real track on
a dark basemap.

Everything shown is recorded or arithmetic on a record and the timetable, labelled as such.
Nothing repeats the operator's forecast.

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
- [docs/LICENSES.md](docs/LICENSES.md) — third-party assets
