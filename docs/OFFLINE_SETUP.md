# Offline Data Setup

This app needs no internet access at runtime, but the map tiles and geocoding both depend on
regional data you download/build **once**, locally. This doc covers geocoding (Phase 2) and map
tiles (Phase 3).

None of this data is committed to the repo (see `.gitignore` — `offline-data/`, `*.osm.pbf`,
`*.pmtiles`) — it's large, and regenerable from the steps below.

## Part 1: Geocoding

### Why this approach

We looked at Photon (komoot's offline geocoder) first, but its only pre-built search index is
**planet-scale** (60-100+ GB, 64GB RAM recommended) — there's no clean pre-built country or state
extract. Building one ourselves would mean standing up a full Nominatim/PostgreSQL import
pipeline, which is a lot of infrastructure for a tool that only needs to geocode a modest number
of Southern-California addresses a day.

Instead, we extract address points directly from the **same regional OpenStreetMap extract**
used for map tiles below, load them into a local SQLite database with full-text search, and serve
that from a small local Node script — no JVM, no Elasticsearch, no Docker.

### 1. Get a regional OSM extract

Download an extract for your operating region from [Geofabrik](https://download.geofabrik.de/)
(this project's examples use Southern California trips, so California is a reasonable starting
region — add more states later by repeating this process against their extracts):

```
https://download.geofabrik.de/north-america/us/california-latest.osm.pbf
```

Save it somewhere outside the repo, e.g. `offline-data/raw/california-latest.osm.pbf`.

### 2. Extract address features with pbf2json

We looked at `osmium-tool` first, but it's not an npm package and has no official Windows binary
(only conda-forge, or building from source). [`pbf2json`](https://github.com/pelias/pbf2json) (from
the Pelias geocoder project) does the same job — filter an OSM extract down to just address-tagged
features — and ships prebuilt binaries for Windows/Mac/Linux **via npm**, with no separate install
step. It also already resolves way (building) geometries to a center point for you, so there's no
separate "export to GeoJSON" pass needed.

It's already a devDependency of this project. Run it against your extract:

```
npx pbf2json -tags="addr:housenumber" offline-data/raw/california-latest.osm.pbf > offline-data/raw/california-addresses.jsonl
```

This can take several minutes for a state-sized extract. The output is newline-delimited JSON (one
OSM element per line), which is a different shape than GeoJSON — see the next step.

### 3. Build the local search index

`geocode:build` reads pbf2json's newline-delimited JSON (or GeoJSON, one feature per line or a
single FeatureCollection — all three shapes are handled):

```
npm run geocode:build -- offline-data/raw/california-addresses.jsonl offline-data/geocode-index.sqlite
```

This keeps only records with a house number + street, and writes `offline-data/geocode-index.sqlite`
(an `addresses` table plus an FTS5 full-text index for fuzzy/prefix matching).

### 4. Run the geocode server

```
npm run geocode:serve
```

Serves `GET /search?q=<address>&limit=5` on `http://localhost:5175` by default (configurable via
the `GEOCODE_PORT` / `GEOCODE_DB_PATH` env vars). Leave this running alongside `npm run dev` —
the app's `.env` already points `VITE_GEOCODE_URL` at `http://localhost:5175`.

### Using it in the app

- **Automatic on import**: importing an Excel file geocodes every pickup/dropoff address right
  away — no button click needed. The house number + zip must match exactly (see
  `scripts/geocode/normalize.mjs`), so the top-ranked result is normally reliable even when more
  than one candidate comes back; that top match is applied directly.
- **Fixing a bad match**: every geocoded address has a small "Not right? Fix match" link to
  re-open the search and pick a different candidate, edit the search text and retry, or drop a pin
  yourself on an embedded map.
- **When nothing matches locally**: OpenStreetMap's address coverage is real but uneven — some
  streets have every house number individually tagged, others don't. When the local index has zero
  candidates, the panel offers a **free US Census Bureau lookup** (see below) as a second attempt
  before falling back to a manual map pin.
- **Routing page**: adding a driver geocodes their garage address through the exact same flow.

### Free online fallback: US Census Bureau Geocoder

For an address the local OSM-based index doesn't have, the "Search the free US Census address
database (online)" button queries `geocoding.geo.census.gov` — the US Census Bureau's public
Geocoder. It's genuinely free with **no API key, no account, no billing** (unlike Google's
Geocoding API, which needs a billing-enabled Cloud project even though usage would likely stay
within its free credit). It interpolates from TIGER/Line address *ranges* along street segments,
so it often finds houses OpenStreetMap's point-by-point community tagging never got to.

This is the one deliberate exception to "fully offline" — clicking it sends a live request to a US
government server. It sends **only the bare address text**, the same scope as every local search;
never a member's name, phone, insurance, or any other trip detail. It's never called
automatically, only when you explicitly click it for an address that failed locally.

Technical note: the browser can't call that API directly (it doesn't send CORS headers), so the
request is proxied through `scripts/geocode/server.mjs`'s `/census-search` endpoint — the same
local server you're already running for offline search, not a new process.

### Expanding geocoding coverage later

`geocode:build` rebuilds its output file from scratch each run (it does not append), so to cover
more than one state, run `pbf2json` against each extract separately and concatenate the outputs
before building the index:

```
npx pbf2json -tags="addr:housenumber" offline-data/raw/nevada-latest.osm.pbf > offline-data/raw/nevada-addresses.jsonl
cat offline-data/raw/california-addresses.jsonl offline-data/raw/nevada-addresses.jsonl > offline-data/raw/combined-addresses.jsonl
npm run geocode:build -- offline-data/raw/combined-addresses.jsonl offline-data/geocode-index.sqlite
```

## Part 2: Map tiles

### Why this approach

The Routing page renders an offline vector basemap using [MapLibre GL JS](https://maplibre.org/)
and a single-file [PMTiles](https://docs.protomaps.com/pmtiles/) archive — no tile server process,
just a static file the browser reads via HTTP range requests. The style itself (roads, water,
buildings, etc.) comes from the `@protomaps/basemaps` npm package, which already matches the
schema Protomaps' own basemap builds use — so rather than running the full
[planetiler](https://github.com/onthegomap/planetiler) build pipeline ourselves, we cut a regional
extract out of Protomaps' free daily planet-scale build using the `pmtiles` CLI's `extract`
command, which only downloads the bytes for your region (not the whole planet file).

No `glyphs`/`sprite` URL is configured in the style (Protomaps only hosts those online, which would
break full offline operation) — but text labels render anyway. Verified: maplibre-gl v6 falls back
to local system fonts for text when no glyphs source is configured, and issues zero external
network requests doing it. Only custom sprite icons would need self-hosting, and only if a future
style change actually needs them.

### 1. Install the pmtiles CLI

This is a separate Go binary (`go-pmtiles`), not the npm package — download the one for your OS
from [github.com/protomaps/go-pmtiles/releases](https://github.com/protomaps/go-pmtiles/releases)
and put it on your PATH. Verify with:

```
pmtiles --version
```

### 2. Extract your region from the daily planet build

Protomaps publishes a free daily build at `https://build.protomaps.com/<YYYYMMDD>.pmtiles` (check
[maps.protomaps.com/builds](https://maps.protomaps.com/builds) for the latest available date).
Cut out California (adjust the `--bbox` for your own region — `minLon,minLat,maxLon,maxLat`):

```
pmtiles extract https://build.protomaps.com/20260908.pmtiles offline-data/tiles/california.pmtiles --bbox=-124.5,32.5,-114.0,42.1 --maxzoom=14
```

This streams only the tiles inside that bounding box, not the full planet file. A state-sized
region at `--maxzoom=14` is typically in the low single-digit GB range; drop `--maxzoom` for less
detail (and a smaller file) if that's more than you need.

### 3. Put it where the app can serve it

```
mkdir -p public/tiles
mv offline-data/tiles/california.pmtiles public/tiles/region.pmtiles
```

Vite serves anything under `public/` as a static file, so this becomes available at
`/tiles/region.pmtiles` — which is exactly what `VITE_PMTILES_URL` defaults to (see
`.env.example`). Only change that env var if you name the file differently or serve it from
somewhere else.

### 4. Restart the dev server

`.env` changes require a restart (not just a browser reload) to take effect:

```
npm run dev
```

Open the Routing page, pick a driver, and you should see rendered terrain (roads, water, land use)
under any assigned trip's pickup/dropoff pins, instead of a flat gray background.

### A note on Vite + MapLibre

`vite.config.ts` already excludes `maplibre-gl` from Vite's dependency pre-bundling
(`optimizeDeps.exclude`). Without this, MapLibre's web worker fails to load in dev mode (404s on
`maplibre-gl-worker.mjs`) and the map silently never fetches any tiles — no console error, it just
stays blank. This is already handled for you; mentioned here only so it doesn't look like a mystery
if you ever see it while upgrading `maplibre-gl` or `vite`.

### Coverage outside your region

The map itself pans freely across all of the US (and the world) — there's no artificial boundary —
but outside whatever bounding box(es) you've extracted, it renders as a flat background with no
roads/water/buildings, which is expected for an offline regional extract. Add more states later by
repeating step 2 with a different `--bbox` and either serving multiple files (switching
`VITE_PMTILES_URL`) or re-running `extract` with a bbox that covers both regions.
