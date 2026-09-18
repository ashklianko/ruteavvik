# Ruteavvik in five minutes

Speaker script with demo cues. Open https://ashklianko.github.io/ruteavvik/ beforehand,
wide window, scene switcher in the bottom left corner. Times are cumulative.

---

**0:00 · Hook**

*Live page, Sandvika to Oslo S.*

Every morning the platforms around Oslo fill with people looking at a board. The board
shows one thing: when the operator expects the train. Not when trains have been arriving.
Not how the line is doing. Not whether the delay is growing or melting away. One promise,
and you take it or you don't.

Ruteavvik is the other board. It shows what the trains actually did, in the last hour, on
your stretch of line. Measured, not promised.

**0:35 · Where the data comes from**

Entur, the national transport data hub, records the moment every train leaves every
station and publishes it, open, straight to the browser. That record has been sitting there
for years. Nobody turned it into something a commuter can read at a glance. That is the
whole product.

**1:00 · Demo one: a real morning peak**

*Switch scene to "Morning peak, Sandvika 07:47".*

This is Sandvika to Oslo S, yesterday morning, replayed from a recording. Three questions,
one screen.

*Point at the top right.*

Question one: when do I actually leave. *Next 07:47, due, R14 to Kongsvinger, platform 4, two
minutes late.* Timetable plus the delay we measured at the train's last stop, not the
operator's estimate. Then the departures after it, and a one-word verdict for the station,
*delays*, from what the last trains really did here.

*Sweep across the diagram.*

Question two: how is the line right now. Stations across, you at the vertical line, trains
coming towards you on the left, trains already gone on the right. Height is measured delay,
colour is delay too: green within a minute, amber, orange, red. One glance and you know
whether to run or have the coffee.

*Hover the train with the longest trail.*

The dots behind a train are its footprints: the delay at each of its last stops. A trail
climbing away from the axis is a train getting later. Falling back, catching up. You are
watching the trend, not a snapshot.

*Point at the coloured stretch of the axis.*

Question three, and this is the one no other board has: where does the delay come from. The
axis itself is coloured where the line adds time, measured across every train that passed
in the last hour. Grey means too few trains to say. The first time we probed the data, the
tunnel between Nationaltheatret and Oslo S was adding a hundred and nine seconds to every
single train, twelve trains in a row. Nobody on the platform knew. This stretch shows it
live.

*Click the next train.*

Click a train and you get its whole story: every stop passed with the recorded time, every
stop ahead with the delay carried forward, and an arrival window at Oslo S built from what
the last trains did on the same stretch. The headline now follows this train: leaves,
arrives, timetable struck through.

**2:45 · Demo two: a bad morning**

*Switch scene to "Synthetic: signal failure at Lysaker".*

Two days of recordings gave us no cancellation to show, so this scene is generated from the
real timetable with invented times. The dot in the corner says so. Invented data is always
labelled here; that is a rule.

The station chip is red, *disrupted*. Under the departure, the operator's own notice: signal
failure at Lysaker, allow extra time. In the list, one train cancelled and struck through,
one running with fewer carriages, one growing from Drammen, one catching up. Every fact in
one line each.

*Open the Map tab.*

The same facts on the track. The Lysaker to Skøyen stretch is orange because every train
is losing time there. Solid marks are recorded positions; rings are where the timetable
would have carried a train since its last recording, so the map moves without pretending we
know where the train is.

*Open Last hour, drag along the time axis.*

The time chart, one line per train, solid where recorded, dashed where timetable. Drag along
the axis and the whole page rewinds to that minute; every recording after it is forgotten.
You can replay the morning and see exactly when the line broke.

**3:50 · What is under it**

A static page. No backend, no key, no database, nothing to run. Entur answers the browser
directly, OpenFreeMap serves the map, GitHub Pages deploys on every push. React and
TypeScript, MapLibre for the map.

It went from a one-page brief to this in two days, with Claude Code. The repository carries
what a team would leave behind: a PRD, a spec, a data document with every trap the API set
us, and every design decision written down with its cost. One person and an agent, working
the way a team works.

**4:30 · The rule that makes it trustworthy**

Nothing on this screen is a prediction. Every number traces back to a recorded time. Where
we project forward we carry the measured delay unchanged and say *if it does not catch up*.
Where the sample is thin the page says so. Where nothing has been recorded it says *not
departed yet* and refuses to guess. A board you can trust is a board that tells you what it
does not know.

**4:50 · Close**

ashklianko.github.io/ruteavvik. Pick your two stations tomorrow morning, and see what the
trains actually did.
