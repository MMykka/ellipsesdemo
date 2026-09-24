import { fetchRoadRoute } from './routingClient'
import type { GeoPoint } from '../types/trip'

const cache = new Map<string, Promise<[number, number][] | undefined>>()

function cacheKey(from: GeoPoint, to: GeoPoint): string {
  return `${from.lat.toFixed(6)},${from.lng.toFixed(6)}->${to.lat.toFixed(6)},${to.lng.toFixed(6)}`
}

/** Same-session memoized wrapper around fetchRoadRoute — re-selecting the same leg (toggling its
 * highlight off then back on) hits the network once. */
export function fetchRoadRouteCached(from: GeoPoint, to: GeoPoint): Promise<[number, number][] | undefined> {
  const key = cacheKey(from, to)
  const existing = cache.get(key)
  if (existing) return existing

  const promise = fetchRoadRoute(from, to)
  cache.set(key, promise)
  return promise
}
