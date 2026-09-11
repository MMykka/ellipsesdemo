import type { GeocodeCandidate } from './geocodeClient'
import { searchAddress } from './geocodeClient'

const cache = new Map<string, Promise<GeocodeCandidate[]>>()

function cacheKey(raw: string) {
  return raw.trim().toLowerCase()
}

/** Same-session memoized wrapper around searchAddress — repeated lookups of the same raw
 * address string (common: the same member's address across today's trips) hit the network once. */
export function searchAddressCached(raw: string, limit = 5): Promise<GeocodeCandidate[]> {
  const key = cacheKey(raw)
  const existing = cache.get(key)
  if (existing) return existing

  const promise = searchAddress(raw, limit)
  cache.set(key, promise)
  return promise
}

export function clearGeocodeCache() {
  cache.clear()
}
