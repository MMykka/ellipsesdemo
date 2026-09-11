import type { GeoPoint } from '../types/trip'

export interface CensusGeocodeResult {
  label: string
  geo: GeoPoint
}

interface ProxyResponse {
  results: { label: string; lat: number; lon: number }[]
}

const BASE_URL = import.meta.env.VITE_GEOCODE_URL ?? 'http://localhost:5175'

/**
 * Free, no-signup, no-API-key fallback for addresses the local offline index doesn't have.
 * The US Census Bureau's public Geocoder interpolates from TIGER/Line address RANGES along
 * street segments, which covers a lot of real houses that OpenStreetMap's point-by-point
 * community tagging simply never got around to — exactly the gap this fills.
 *
 * Routed through our own local geocode server's /census-search proxy rather than called
 * directly: geocoding.geo.census.gov doesn't send CORS headers, so a browser can't fetch it
 * directly (a Node process isn't subject to that browser-only restriction).
 *
 * This is the one deliberate exception to "fully offline": clicking this makes a live request to
 * a US government server. It sends ONLY the bare address text — the same scope as every local
 * search — never a member's name, phone, or any other trip detail. Never called automatically;
 * only when the dispatcher explicitly clicks for an address the local index couldn't resolve.
 */
export async function searchAddressViaCensus(query: string): Promise<CensusGeocodeResult[]> {
  if (!query.trim()) return []

  try {
    const url = `${BASE_URL}/census-search?q=${encodeURIComponent(query)}`
    const res = await fetch(url)
    if (!res.ok) return []
    const data = (await res.json()) as ProxyResponse
    return data.results.map((r) => ({ label: r.label, geo: { lat: r.lat, lng: r.lon } }))
  } catch {
    return []
  }
}
