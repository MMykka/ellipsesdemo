import type { GeoPoint } from '../types/trip'

export interface GeocodeCandidate {
  label: string
  geo: GeoPoint
  housenumber?: string
  street?: string
  city?: string
  state?: string
  postcode?: string
}

const BASE_URL = import.meta.env.VITE_GEOCODE_URL ?? 'http://localhost:5175'

interface RawSearchResult {
  label: string
  lat: number
  lon: number
  housenumber?: string
  street?: string
  city?: string
  state?: string
  postcode?: string
}

/**
 * Queries the local offline geocode server (scripts/geocode/server.mjs). Returns an empty array
 * on any failure (server not running, no matches) rather than throwing — callers treat "no
 * candidates" as a normal, expected outcome for addresses outside the indexed region.
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
      housenumber: r.housenumber,
      street: r.street,
      city: r.city,
      state: r.state,
      postcode: r.postcode,
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
