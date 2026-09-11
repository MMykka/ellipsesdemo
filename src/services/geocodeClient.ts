import type { GeoPoint } from '../types/trip'

export interface GeocodeCandidate {
  label: string
  geo: GeoPoint
}

const BASE_URL = import.meta.env.VITE_GEOCODE_URL ?? 'http://localhost:5175'

interface RawSearchResult {
  label: string
  lat: number
  lon: number
}

/**
 * Queries the free US Census Bureau Geocoder (geocoding.geo.census.gov), routed through our own
 * tiny local Node proxy (scripts/geocode/server.mjs) — that API doesn't send CORS headers, so the
 * browser can't call it directly, but a Node process isn't subject to that browser-only
 * restriction. Sends ONLY the bare address text being searched — never a member's name, phone,
 * insurance, or any other trip detail. Returns an empty array on any failure (proxy not running,
 * no matches) rather than throwing — callers treat "no candidates" as a normal outcome.
 */
export async function searchAddress(query: string, limit = 5): Promise<GeocodeCandidate[]> {
  if (!query.trim()) return []

  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}&limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = (await res.json()) as { results: RawSearchResult[] }
    return data.results.map((r) => ({
      label: r.label,
      geo: { lat: r.lat, lng: r.lon },
    }))
  } catch {
    return []
  }
}

export async function isGeocodeServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/health`)
    return res.ok
  } catch {
    return false
  }
}
