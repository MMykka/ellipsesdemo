# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

An internal dispatch tool for planning non-emergency medical transport (NEMT) trips: import a daily
Excel/CSV export into trip cards, then use a map + dispatch table to check whether a driver can
feasibly take a trip and assign it. There is no backend/database — all imported trip data lives only
in memory for the session (Zustand store, wiped on reload). Only the driver roster and Excel
column-mapping profiles persist, in browser `localStorage`, as a deliberate convenience.

The app is offline-first with two deliberate, narrowly-scoped exceptions to that rule: address
geocoding and an optional road-route preview on the map. Both send only bare address text or
coordinate pairs — never member/trip/driver details. See "Online exceptions" below and
`docs/OFFLINE_SETUP.md` for the full rationale.

## Commands

```bash
npm run dev            # start the app (Vite, default http://localhost:5173)
npm run geocode:serve  # start the local geocode CORS proxy (needed for address lookups to work)
npm run build           # tsc -b && vite build
npm run lint            # oxlint
npm run test             # vitest run (single run)
npm run test:watch      # vitest watch mode
```

Run a single test file or test name with vitest directly, e.g.:

```bash
npx vitest run src/domain/feasibility/__tests__/computeSequence.test.ts
npx vitest run -t "some test name"
```

First-time setup on a new machine (Windows): `npm run setup` (`scripts/setup.ps1`) runs
`npm install`, creates `.env`, and downloads/builds offline map tiles. It's idempotent — safe to
re-run. On other platforms, or if you don't need the map tiles, `npm install` + `npm run dev` is
enough on its own.

Tests use `vitest` with `jsdom` (see `vitest.config.ts`, setup file `src/test/setup.ts`). There is
no separate typecheck script — `npm run build` (`tsc -b`) is the typecheck.

## Architecture

### Data flow: import → store → derive → render

1. **Import** (`src/features/excelImport/`): `parseWorkbook.ts` sniffs the file's actual bytes
   (zip signature vs OLE2 vs plain text) rather than trusting its extension, so a mislabeled
   `.xlsx`/`.csv` still parses correctly; legacy `.xls` is explicitly rejected with a clear error.
   `legGroupDetection.ts` auto-suggests a column mapping from header text (keyword matching) and
   from sniffing sample cell values for unlabeled date/time columns, and detects "two legs per row"
   exports (duplicate header seen twice → leg A / leg B). `MAPPING_LOGIC_VERSION` must be bumped
   whenever this heuristic changes, since mapping profiles are cached in `localStorage` keyed by
   header row and a stale cached mapping would otherwise silently keep using the old (buggy)
   logic forever. `applyMapping.ts` turns the reviewed mapping into `Trip` objects.
   `matchDriverByName.ts` auto-assigns an imported trip to a roster driver when the export's
   "Driver Name" column matches an existing driver (case/whitespace-insensitive).
2. **Store** (`src/store/`, Zustand): `tripsStore` holds all `Trip[]` in memory only — imports
   upsert by trip `id` so re-importing a file refreshes those trips in place rather than
   duplicating. `driversStore` and `mappingStore` are `localStorage`-backed (via
   `src/lib/storage/localStorage.ts`, which never touches trip data). `selectionStore` and
   `sequenceOverrideStore` are in-memory UI state (selected driver, per-driver drag-to-reorder
   overrides of stop sequence).
3. **Derive** (`src/domain/` — pure functions, no React, no network, fully unit-testable):
   - `feasibility/haversineEstimate.ts` — straight-line distance/time estimate between two points.
     This (not real road routing) is what all ETA/feasibility math is based on — see
     `docs/OFFLINE_SETUP.md` for why. The OSRM road-routing lookup (`src/services/routingClient.ts`)
     is a map *visual* aid only and never feeds into this.
   - `feasibility/computeSequence.ts` — walks a driver's ordered stops (garage → stop → stop → …),
     computing travel time/distance, arrival time, load/unload dwell time (by `spaceType`), and a
     Late/On Time/Early classification per stop.
   - `feasibility/classifyTiming.ts` — the single Late/On Time/Early comparison shared by both the
     dispatch table's predictive badges (ETA vs target) and trip cards' historical badges (actual
     recorded time vs target).
   - `time/` — time parsing/formatting and trip sort-time derivation.
4. **Render**:
   - `features/trips/` — Trips page and trip cards (status badges via `classifyTiming`).
   - `features/map/` — Routing page. `buildDriverStops.ts` (pure, tested) turns a driver's assigned
     trips into an ordered `Stop[]`, applying any `sequenceOverrideStore` manual order and
     optionally folding in one `previewTripId` (an unassigned trip being considered for this
     driver, shown flagged with `isPreview` before the assignment is committed). `useDriverRoute.ts`
     wraps this with `computeSequence` for the live map/table view. `MapView.tsx` renders
     MapLibre/PMTiles with pickup(green)/dropoff(red)/garage(black "G") markers
     (`markers/markerFactory.ts`) and draws a selected leg's path — straight-line instantly, then
     upgraded in place to the real road path once `routingClient.ts` resolves (see below).
   - `features/dispatchTable/` — drag-to-reorder (writes to `sequenceOverrideStore`), unassign,
     Excel export of the current table.

### Online exceptions

Both are narrow, deliberate, and documented in depth in `docs/OFFLINE_SETUP.md` — read it before
touching either:

- **Geocoding** (`src/services/geocodeClient.ts` + `src/services/geocodeCache.ts`): queries the
  free US Census Bureau Geocoder, falling back to OpenStreetMap Nominatim when Census finds no
  match. Neither API sends CORS headers, so both are proxied through a local Node script
  (`scripts/geocode/server.mjs`, run via `npm run geocode:serve`) rather than called directly from
  the browser. Runs automatically on import (top-ranked match auto-applied) and when adding a
  driver's garage address.
- **Road-route preview** (`src/services/routingClient.ts` + `src/services/routingCache.ts`): calls
  OSRM's free public demo (`router.project-osrm.org`) directly from the browser (it does send CORS
  headers, so no proxy needed) to draw an actual road path for a selected leg on the map. Failures
  fall back silently to the straight-line estimate — this path is a visual aid only and never
  affects feasibility/ETA numbers. `routingCache.ts` memoizes in-flight/completed lookups per
  session so re-toggling the same leg's highlight doesn't re-fetch.

Everything else in the app makes zero network requests.

### Map tiles

The Routing page uses an offline vector basemap: MapLibre GL JS + a single PMTiles archive (no
tile server, static file read via HTTP range requests), styled via `@protomaps/basemaps`. Tile
data is not committed (`offline-data/`, `*.pmtiles` are gitignored) — it's built once locally per
`docs/OFFLINE_SETUP.md`. `vite.config.ts` deliberately excludes `maplibre-gl` from dependency
pre-bundling — without that exclusion its web worker 404s under Vite's dev server and the map
silently never fetches tiles.

## Conventions

- No path aliases — imports are relative throughout.
- Domain logic (`src/domain/`) is kept pure and network-free by design so it stays unit-testable;
  new feasibility/timing logic belongs there, not inlined in components.
- `Address.geocodeStatus` (`pending`/`resolved`/`failed`/`skipped`) drives UI state for pickup/
  dropoff — a stop only gets placed on the map/route once its address has a resolved `geo`.
