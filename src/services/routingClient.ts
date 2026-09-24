import type { GeoPoint } from '../types/trip'

interface OsrmRouteResponse {
  code: string
  routes?: { geometry: { coordinates: [number, number][] } }[]
}

/**
 * Fetches an actual road route between two points from OSRM's free public demo routing server
 * (router.project-osrm.org) — no API key, no account, called directly from the browser (OSRM's
 * demo sends CORS headers, unlike the Census geocoder, so no proxy is needed). Sends ONLY the two
 * coordinate pairs — never a member's name, phone, trip details, or anything else. Returns
 * undefined on any failure (offline, no route found, demo server unavailable) so callers can fall
 * back to a straight-line estimate — this is a best-effort visual aid only; nothing in the app's
 * feasibility/ETA math depends on it.
 */
export async function fetchRoadRoute(from: GeoPoint, to: GeoPoint): Promise<[number, number][] | undefined> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) })
    if (!res.ok) return undefined
    const data = (await res.json()) as OsrmRouteResponse
    return data.routes?.[0]?.geometry.coordinates
  } catch {
    return undefined
  }
}
