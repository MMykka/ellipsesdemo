# Offline Data Setup

This app needs no local data build for geocoding, but the map tiles depend on regional data you
download **once**, locally. This doc covers geocoding (Phase 2) and map tiles (Phase 3).

Map tile data isn't committed to the repo (see `.gitignore` — `offline-data/`, `*.pmtiles`) — it's
large, and regenerable from the steps below.

## Part 1: Geocoding

### Why this approach

Address geocoding is **online-only**, via the free US Census Bureau Geocoder
(`geocoding.geo.census.gov`) — genuinely free, with no API key, no account, and no billing
(unlike Google's Geocoding API, which needs a billing-enabled Cloud project even though usage
would likely stay within its free credit). It interpolates from TIGER/Line address *ranges* along
street segments, so it covers real houses well beyond what a point-by-point community-tagged
dataset like OpenStreetMap would — but that range data lags on newer developments, so a search that
returns nothing from Census automatically falls back to OpenStreetMap's Nominatim, which often has
exactly the newer/smaller places Census is missing. Nominatim fallback calls are throttled to
roughly one per second in the proxy, per its usage policy.

An earlier version of this project built a fully offline address index from a regional
OpenStreetMap extract, loaded into a local SQLite database (`better-sqlite3`). That required a
native compiler toolchain (MSVC + Windows SDK) to install the dependency, which was a recurring
source of setup failures across machines — different Visual Studio versions, node-gyp detection
bugs, partial installs. Moving geocoding fully online removes that dependency entirely: there is
no native addon anywhere in this project anymore, so `npm install` never needs to compile
anything.

**Privacy scope**: every geocoding request sends **only the bare address text** being searched —
never a member's name, phone, insurance, or any other trip/driver detail. This is the one place
the app talks to the internet at runtime; nothing else does.

### Run the geocode proxy

The browser can't call `geocoding.geo.census.gov` or `nominatim.openstreetmap.org` directly —
neither sends CORS headers — so a tiny local Node script (`scripts/geocode/server.mjs`) proxies the
request. It needs no local data and no build step:

```
npm run geocode:serve
```

Serves `GET /search?q=<address>&limit=5` on `http://localhost:5175` by default (configurable via
the `GEOCODE_PORT` env var). Leave this running alongside `npm run dev` — the app's `.env` already
points `VITE_GEOCODE_URL` at `http://localhost:5175`.

### Using it in the app

- **Automatic on import**: importing an Excel file geocodes every pickup/dropoff address right
  away — no button click needed. The top-ranked result is applied directly; if more than one
  candidate comes back, the top guess is still auto-applied (flagged as a "best guess" so it's
  easy to double check), which is what makes bulk import practical.
- **Fixing a bad match**: every geocoded address has a small "Not right? Fix match" link to
  re-open the search and pick a different candidate, edit the search text and retry, or drop a pin
  yourself on an embedded map.
- **Routing page**: adding a driver geocodes their garage address through the exact same flow.

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
