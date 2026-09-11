#!/usr/bin/env node
/**
 * Tiny local geocoding server. Loads the SQLite index built by build-index.mjs and serves
 * GET /search?q=<address>&limit=5 -> [{ label, lat, lon, housenumber, street, city, state, postcode }].
 * No Docker, no JVM — just Node + SQLite, run with: node scripts/geocode/server.mjs
 *
 * Also proxies GET /census-search?q=<address> to the US Census Bureau's free public Geocoder
 * (geocoding.geo.census.gov) — a fallback for addresses the local OSM-based index doesn't have.
 * This proxy exists only because that API doesn't send CORS headers, so the browser can't call it
 * directly; this Node process isn't subject to CORS (a browser-only restriction), so it can.
 */
import Database from 'better-sqlite3'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { toMatchExpression } from './normalize.mjs'

const DB_PATH = process.env.GEOCODE_DB_PATH ?? 'offline-data/geocode-index.sqlite'
const PORT = Number(process.env.GEOCODE_PORT ?? 5175)

if (!existsSync(DB_PATH)) {
  console.error(
    `No geocode index found at "${DB_PATH}". Build one first with:\n` +
      `  node scripts/geocode/build-index.mjs <input.geojson> ${DB_PATH}\n` +
      `See docs/OFFLINE_SETUP.md.`,
  )
  process.exit(1)
}

const db = new Database(DB_PATH, { readonly: true })
const searchStmt = db.prepare(`
  SELECT a.label, a.lat, a.lon, a.housenumber, a.street, a.city, a.state, a.postcode
  FROM addresses_fts f
  JOIN addresses a ON a.id = f.rowid
  WHERE addresses_fts MATCH ?
  ORDER BY rank
  LIMIT ?
`)

function search(query, limit) {
  const matchExpr = toMatchExpression(query)
  if (!matchExpr) return []
  try {
    return searchStmt.all(matchExpr, limit)
  } catch {
    // A malformed FTS5 query (stray operators etc.) — treat as no matches rather than erroring.
    return []
  }
}

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

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)

  res.setHeader('Access-Control-Allow-Origin', '*')

  if (url.pathname === '/search') {
    const q = url.searchParams.get('q') ?? ''
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 5) || 5, 20)
    const results = q.trim() ? search(q, limit) : []
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ results }))
    return
  }

  if (url.pathname === '/census-search') {
    const q = url.searchParams.get('q') ?? ''
    res.setHeader('Content-Type', 'application/json')
    if (!q.trim()) {
      res.end(JSON.stringify({ results: [] }))
      return
    }
    searchCensus(q)
      .then((results) => res.end(JSON.stringify({ results })))
      .catch((err) => {
        console.error('census-search proxy error:', err.message)
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
