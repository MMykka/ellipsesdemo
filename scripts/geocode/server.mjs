#!/usr/bin/env node
/**
 * Tiny local CORS proxy for address geocoding. Serves GET /search?q=<address>&limit=5 ->
 * { results: [{ label, lat, lon }] }, backed by the US Census Bureau's free public Geocoder
 * (geocoding.geo.census.gov). No Docker, no JVM, no local data to build — just Node,
 * run with: node scripts/geocode/server.mjs
 *
 * This proxy exists only because that API doesn't send CORS headers, so the browser can't call
 * it directly; this Node process isn't subject to CORS (a browser-only restriction), so it can.
 * It sends ONLY the bare address text a dispatcher searches — never a member's name, phone,
 * insurance, or any other trip detail.
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
    searchCensus(q)
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
