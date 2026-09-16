#!/usr/bin/env python3
import json, sqlite3, time, urllib.request, datetime, sys, os, ssl

API = "https://api.entur.io/journey-planner/v3/graphql"
CLIENT = "ashklianko-rail-punctuality"
DB = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rail.db")
BBOX = dict(minLat=59.80, minLon=10.35, maxLat=60.05, maxLon=10.95)
POLL_SECONDS = 60
HORIZON_SECONDS = 5400


def _ssl_context():
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except ImportError:
        pass
    for path in ("/etc/ssl/cert.pem", "/usr/local/etc/openssl/cert.pem"):
        if os.path.exists(path):
            return ssl.create_default_context(cafile=path)
    return ssl.create_default_context()


SSL_CTX = _ssl_context()


def gql(query):
    req = urllib.request.Request(
        API,
        data=json.dumps({"query": query}).encode(),
        headers={"Content-Type": "application/json", "ET-Client-Name": CLIENT},
    )
    with urllib.request.urlopen(req, timeout=45, context=SSL_CTX) as r:
        body = json.load(r)
    if "errors" in body:
        raise RuntimeError(json.dumps(body["errors"])[:400])
    return body["data"]


def discover_stations():
    d = gql(
        "{ stopPlacesByBbox(minimumLatitude:%(minLat)s, minimumLongitude:%(minLon)s,"
        " maximumLatitude:%(maxLat)s, maximumLongitude:%(maxLon)s)"
        "{ id name latitude longitude transportMode } }" % BBOX
    )
    return [
        s
        for s in d["stopPlacesByBbox"]
        if "rail" in [str(m).lower() for m in (s.get("transportMode") or [])]
    ]


CALL_FIELDS = """
  realtime cancellation predictionInaccurate
  aimedDepartureTime expectedDepartureTime actualDepartureTime
  aimedArrivalTime expectedArrivalTime
  destinationDisplay { frontText }
  quay { id publicCode }
  serviceJourney { id line { id publicCode transportMode } }
"""


def build_query(stations):
    parts = []
    for i, s in enumerate(stations):
        parts.append(
            f'  s{i}: stopPlace(id:"{s["id"]}") {{ id name '
            f"estimatedCalls(numberOfDepartures:120, timeRange:{HORIZON_SECONDS}) {{{CALL_FIELDS}}} }}"
        )
    return "{\n" + "\n".join(parts) + "\n}"


SCHEMA = """
CREATE TABLE IF NOT EXISTS obs (
  service_journey  TEXT NOT NULL,
  stop_place       TEXT NOT NULL,
  aimed_departure  TEXT NOT NULL,
  stop_name        TEXT,
  quay             TEXT,
  line             TEXT,
  destination      TEXT,
  expected_departure TEXT,
  actual_departure   TEXT,
  aimed_arrival      TEXT,
  expected_arrival   TEXT,
  delay_seconds    INTEGER,
  realtime         INTEGER,
  cancellation     INTEGER,
  inaccurate       INTEGER,
  first_seen       TEXT,
  last_seen        TEXT,
  polls            INTEGER DEFAULT 1,
  PRIMARY KEY (service_journey, stop_place, aimed_departure)
);
CREATE INDEX IF NOT EXISTS obs_stop_aimed ON obs(stop_place, aimed_departure);
CREATE INDEX IF NOT EXISTS obs_line ON obs(line);
CREATE TABLE IF NOT EXISTS stations (
  id TEXT PRIMARY KEY, name TEXT, lat REAL, lon REAL
);
CREATE TABLE IF NOT EXISTS cycles (
  ts TEXT PRIMARY KEY, rows_seen INTEGER, rows_new INTEGER, seconds REAL, error TEXT
);
"""

UPSERT = """
INSERT INTO obs (service_journey, stop_place, aimed_departure, stop_name, quay, line,
  destination, expected_departure, actual_departure, aimed_arrival, expected_arrival,
  delay_seconds, realtime, cancellation, inaccurate, first_seen, last_seen, polls)
VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)
ON CONFLICT(service_journey, stop_place, aimed_departure) DO UPDATE SET
  expected_departure = excluded.expected_departure,
  actual_departure   = COALESCE(excluded.actual_departure, obs.actual_departure),
  expected_arrival   = excluded.expected_arrival,
  delay_seconds      = excluded.delay_seconds,
  realtime           = excluded.realtime,
  cancellation       = excluded.cancellation,
  inaccurate         = excluded.inaccurate,
  last_seen          = excluded.last_seen,
  polls              = obs.polls + 1
"""


def parse(ts):
    return datetime.datetime.fromisoformat(ts) if ts else None


def cycle(conn, stations, query):
    t0 = time.time()
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    data = gql(query)
    rows = []
    for i, st in enumerate(stations):
        node = data.get(f"s{i}")
        if not node:
            continue
        for c in node.get("estimatedCalls") or []:
            sj = c["serviceJourney"]
            aimed, exp = parse(c["aimedDepartureTime"]), parse(c["expectedDepartureTime"])
            delay = int((exp - aimed).total_seconds()) if aimed and exp else None
            rows.append(
                (
                    sj["id"], node["id"], c["aimedDepartureTime"], node["name"],
                    (c.get("quay") or {}).get("publicCode"),
                    (sj.get("line") or {}).get("publicCode"),
                    (c.get("destinationDisplay") or {}).get("frontText"),
                    c["expectedDepartureTime"], c.get("actualDepartureTime"),
                    c.get("aimedArrivalTime"), c.get("expectedArrivalTime"),
                    delay, int(bool(c["realtime"])), int(bool(c["cancellation"])),
                    int(bool(c.get("predictionInaccurate"))), now, now,
                )
            )
    before = conn.execute("SELECT COUNT(*) FROM obs").fetchone()[0]
    conn.executemany(UPSERT, rows)
    after = conn.execute("SELECT COUNT(*) FROM obs").fetchone()[0]
    conn.execute(
        "INSERT OR REPLACE INTO cycles VALUES (?,?,?,?,?)",
        (now, len(rows), after - before, round(time.time() - t0, 2), None),
    )
    conn.commit()
    return len(rows), after - before, after


def main():
    once = "--once" in sys.argv
    conn = sqlite3.connect(DB)
    conn.executescript(SCHEMA)
    stations = discover_stations()
    conn.executemany(
        "INSERT OR REPLACE INTO stations VALUES (?,?,?,?)",
        [(s["id"], s["name"], s.get("latitude"), s.get("longitude")) for s in stations],
    )
    conn.commit()
    query = build_query(stations)
    print(f"станций: {len(stations)}  БД: {DB}", flush=True)

    while True:
        try:
            seen, new, total = cycle(conn, stations, query)
            print(
                f"{datetime.datetime.now():%H:%M:%S}  видно={seen:5d}  новых={new:4d}  всего={total}",
                flush=True,
            )
        except Exception as e:
            print(f"{datetime.datetime.now():%H:%M:%S}  ОШИБКА: {e}", flush=True)
            conn.execute(
                "INSERT OR REPLACE INTO cycles VALUES (?,?,?,?,?)",
                (datetime.datetime.now(datetime.timezone.utc).isoformat(), 0, 0, 0, str(e)[:300]),
            )
            conn.commit()
        if once:
            return
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
