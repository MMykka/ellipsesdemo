# NEMT Dispatch Tool

An internal, fully offline dispatch tool for planning non-emergency medical transport (NEMT) trips: import a daily Excel export into trip cards, then use a map + dispatch table to check whether a driver can feasibly take a trip and assign it.

No database — all imported trip data lives only in memory for the current session and is gone when the dev server stops or the page reloads. Re-import each day. (The driver roster and Excel column-mapping are the one exception: those persist in the browser's local storage as a convenience, since re-entering them every session would be pure friction.)

## Status

This is being built in phases. Currently implemented:

- **Phase 1 — Excel import + trip cards.** Import an `.xlsx` file, map its columns (handles messy/duplicated headers and two-legs-per-row exports) to trip fields, and see the results as cards on the Trips page.
- **Phase 2 — Offline geocoding.** A local address search index built from a regional OpenStreetMap extract (see `docs/OFFLINE_SETUP.md`), served by a tiny local Node script — no Docker, no JVM. Importing an Excel file automatically geocodes every address against it, no button click needed — the top-ranked match is applied directly (house number + zip are required to match exactly, so this is normally reliable), with a small "Not right? Fix match" link on every card to correct a bad pick. For an address OpenStreetMap genuinely doesn't have (a real, fairly common gap in crowdsourced map data — some residential house numbers just aren't individually tagged), there's a free, no-signup fallback to the US Census Bureau's Geocoder (only the bare address text is sent, never member/trip details), or you can edit the search text and retry, or drop a pin yourself on an embedded map.
- **Phase 3 — Map + driver routes.** The Routing page renders an offline vector map (MapLibre + PMTiles — see `docs/OFFLINE_SETUP.md`) showing a selected driver's assigned stops as numbered pickup (green) / dropoff (red) pins plus a black "G" garage marker. Assign a trip to a driver from its card on the Trips page to see it appear here.
- **Phase 4 — Dispatch table + feasibility.** Below the map, a table shows each assigned stop's estimated travel distance/time, ETA, and a Late/On Time/Early status against its target time — computed with a straight-line-distance estimate (see `docs/OFFLINE_SETUP.md` for why, no real road routing). Drag rows to reorder the route; times recompute automatically. Unassign a stop's trip directly from the table. Trip cards on the Trips page show the same Late/On Time/Early badges against actual recorded on-scene/finished times, via the same shared `classifyTiming` logic.

This covers the originally planned build. Natural follow-ups if this keeps getting used: real road routing (swapping the distance estimate for something like OSRM), a live driver-location feed instead of manually-entered garage addresses, and map/table row click-to-highlight sync.

## Running it

```bash
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173) and go to the **Trips** tab to import an Excel file.

For address geocoding to work, also run the local geocode server in a second terminal (see `docs/OFFLINE_SETUP.md` for one-time setup):

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
