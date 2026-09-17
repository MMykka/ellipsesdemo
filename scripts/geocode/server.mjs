#!/usr/bin/env node
/**
 * Tiny local CORS proxy for address geocoding. Serves GET /search?q=<address>&limit=5 ->
 * { results: [{ label, lat, lon }] }, backed by the US Census Bureau's free public Geocoder
 * (geocoding.geo.census.gov), with an OpenStreetMap Nominatim fallback when Census finds nothing.
 * No Docker, no JVM, no local data to build — just Node, run with:
 * node scripts/geocode/server.mjs
 *
 * This proxy exists only because neither API sends CORS headers, so the browser can't call them
 * directly; this Node process isn't subject to CORS (a browser-only restriction), so it can. It
 * sends ONLY the bare address text a dispatcher searches — never a member's name, phone,
 * insurance, or any other trip detail.
 *
 * Why the fallback: Census's geocoder interpolates from TIGER/Line address *ranges*, which covers
 * real houses well but lags behind on newer developments — e.g. a recently built apartment complex
 * can return zero matches even for a correctly formatted address. Nominatim's community-tagged
 * OpenStreetMap data often has exactly these newer/smaller places, so it catches what Census
 * misses. Census stays primary (queried first, and used alone whenever it finds a match) since its
 * range-interpolated coverage of ordinary houses is broader overall.
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.GEOCODE_PORT ?? 5175)

async function searchCensus(query) {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(
    query,
  )}&benchmark=4&format=json`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!res.ok) return []
  const data = await res.json()
  const matches = data.result?.addressMatches ?? []
  return matches.map((m) => ({
    label: m.matchedAddress,
    lat: m.coordinates.y,
    lon: m.coordinates.x,
  }))
}

// Nominatim's usage policy (https://operations.osmfoundation.org/policies/nominatim/) caps
// automated use at 1 request/second and requires a descriptive User-Agent identifying the app —
// this queue serializes fallback calls with a floor between them so a batch of simultaneous
// import-time lookups can't burst past that, even though it's only ever invoked for the (usually
// few) addresses Census fails on.
const NOMINATIM_MIN_INTERVAL_MS = 1100
let nominatimQueue = Promise.resolve()

function searchNominatim(query) {
  const run = async () => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      query,
    )}&format=json&addressdetails=0`
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'ellipsesdemo-geocode-proxy/1.0 (local dev tool; Census fallback)' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.map((r) => ({
      label: r.display_name,
      lat: Number(r.lat),
      lon: Number(r.lon),
    }))
  }

  const scheduled = nominatimQueue.then(async () => {
    const result = await run().catch((err) => {
      console.error('nominatim fallback error:', err.message)
      return []
    })
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS))
    return result
  })
  // Chain the next caller off this call's throttle delay, not its result — so lookups still queue
  // even if this one rejects (already caught above, but guards future changes).
  nominatimQueue = scheduled.then(
    () => undefined,
    () => undefined,
  )
  return scheduled
}

async function searchAddress(query) {
  const censusResults = await searchCensus(query)
  if (censusResults.length > 0) return censusResults
  return searchNominatim(query)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  res.setHeader('Access-Control-Allow-Origin', '*')

  if (url.pathname === '/search') {
    const q = url.searchParams.get('q') ?? ''
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 5) || 5, 20)
    res.setHeader('Content-Type', 'application/json')
    if (!q.trim()) {
      res.end(JSON.stringify({ results: [] }))
      return
    }
    searchAddress(q)
      .then((results) => res.end(JSON.stringify({ results: results.slice(0, limit) })))
      .catch((err) => {
        console.error('search proxy error:', err.message)
        res.end(JSON.stringify({ results: [] }))
      })
    return
  }

  if (url.pathname === '/health') {
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ ok: true }))
    return
  }

  res.statusCode = 404
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log(`Geocode server listening on http://localhost:${PORT}`)
})
