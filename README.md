# NEMT Dispatch Tool

An internal dispatch tool for planning non-emergency medical transport (NEMT) trips: import a daily Excel export into trip cards, then use a map + dispatch table to check whether a driver can feasibly take a trip and assign it. Everything runs locally and offline except address geocoding, which sends only the bare address text to a free public geocoder — see Phase 2 below.

No database — all imported trip data lives only in memory for the current session and is gone when the dev server stops or the page reloads. Re-import each day. (The driver roster and Excel column-mapping are the one exception: those persist in the browser's local storage as a convenience, since re-entering them every session would be pure friction.)

## Status

This is being built in phases. Currently implemented:

- **Phase 1 — Excel import + trip cards.** Import an `.xlsx` file, map its columns (handles messy/duplicated headers and two-legs-per-row exports) to trip fields, and see the results as cards on the Trips page.
- **Phase 2 — Online geocoding.** Address lookups go through the free US Census Bureau Geocoder (`geocoding.geo.census.gov`), falling back to OpenStreetMap's Nominatim for addresses Census can't find (it lags on newer developments), both proxied through a tiny local Node script to work around their missing CORS headers — no API key, no account, no local data to build (see `docs/OFFLINE_SETUP.md`). This is the one deliberate exception to "fully offline": every request sends only the bare address text being searched, never a member's name, phone, or any other trip/driver detail. Importing an Excel file automatically geocodes every address, no button click needed — the top-ranked match is applied directly, with a small "Not right? Fix match" link on every card to correct a bad pick, edit the search text and retry, or drop a pin yourself on an embedded map.
- **Phase 3 — Map + driver routes.** The Routing page renders an offline vector map (MapLibre + PMTiles — see `docs/OFFLINE_SETUP.md`) showing a selected driver's assigned stops as numbered pickup (green) / dropoff (red) pins plus a black "G" garage marker. Assign a trip to a driver from its card on the Trips page to see it appear here.
- **Phase 4 — Dispatch table + feasibility.** Below the map, a table shows each assigned stop's estimated travel distance/time, ETA, and a Late/On Time/Early status against its target time — computed with a straight-line-distance estimate (see `docs/OFFLINE_SETUP.md` for why, no real road routing). Drag rows to reorder the route; times recompute automatically. Unassign a stop's trip directly from the table. Trip cards on the Trips page show the same Late/On Time/Early badges against actual recorded on-scene/finished times, via the same shared `classifyTiming` logic.

This covers the originally planned build. Natural follow-ups if this keeps getting used: real road routing (swapping the distance estimate for something like OSRM), a live driver-location feed instead of manually-entered garage addresses, and map/table row click-to-highlight sync.

## Running it

**First time on a new machine (Windows):**

```bash
npm run setup
```

This is a one-shot script (`scripts/setup.ps1`) that runs `npm install`, creates `.env`, and
downloads/builds the offline map tiles (see `docs/OFFLINE_SETUP.md` for what each piece does and
how to target a region other than California). There's no native compiler to install — geocoding
is online-only (see Phase 2 above), so there's no native addon in this project at all. It's safe
to re-run if it fails partway through — every step is skipped if its output already exists.

Any platform (not just Windows) can equally just run `npm install` and `npm run dev` directly —
`npm run setup` only adds the (optional) map-tiles download on top.

**Every time after that:**

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173) and go to the **Trips** tab to import an Excel file.

For address geocoding to work, also run the local geocode server in a second terminal:

```bash
npm run geocode:serve
```

## Tests

```bash
npm run test
```

## Project layout

- `src/types/` — core data model (Trip, Driver, ColumnMappingProfile)
- `src/features/excelImport/` — file parsing, column-mapping heuristics + UI
- `src/features/trips/` — the Trips page and trip card UI
- `src/features/map/` — Routing page, MapLibre/PMTiles map view, driver-route derivation
- `src/features/dispatchTable/` — the dispatch table (drag-to-reorder, unassign)
- `src/store/` — in-memory (trips) and local-storage-backed (drivers, mapping profiles) state
- `src/domain/` — pure calculation logic (time parsing, feasibility sequencing)
