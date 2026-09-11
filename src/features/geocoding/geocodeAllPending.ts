import { searchAddressCached } from '../../services/geocodeCache'
import { searchAddressViaCensus } from '../../services/censusGeocodeClient'
import type { AddressSlot } from '../../store/tripsStore'
import type { Trip } from '../../types/trip'

export interface GeocodeAllResult {
  resolved: number
  bestGuess: number
  viaCensus: number
  failed: number
}

interface GeocodeAllActions {
  setAddressGeo: (tripId: string, slot: AddressSlot, label: string, geo: { lat: number; lng: number }) => void
  setAddressFailed: (tripId: string, slot: AddressSlot) => void
}

/**
 * Best-effort bulk geocode: for every pickup/dropoff address still 'pending', applies the
 * top-ranked candidate. The underlying search (see scripts/geocode/normalize.mjs) requires house
 * number/zip to match exactly and only ranks street/city words, so the top result is normally a
 * strong match even when more than one candidate comes back — auto-applying it (rather than
 * always stopping for a manual pick) is what makes bulk import practical on a large regional
 * index. AddressGeocodeControl still shows a "not right?" affordance on every resolved address so
 * a bad auto-pick is one click to fix.
 *
 * Addresses the local index has zero candidates for get one automatic follow-up: the free US
 * Census Bureau Geocoder (see censusGeocodeClient.ts), which covers a real, common gap in
 * OpenStreetMap's community-tagged address points via TIGER/Line address-range interpolation.
 * That request sends only the bare address text, same as local search — never a member's name,
 * phone, or any other trip detail. Only what's left after both attempts needs a manual pick.
 */
export async function geocodeAllPending(
  trips: Trip[],
  actions: GeocodeAllActions,
): Promise<GeocodeAllResult> {
  const result: GeocodeAllResult = { resolved: 0, bestGuess: 0, viaCensus: 0, failed: 0 }

  const slots: { tripId: string; slot: AddressSlot; raw: string }[] = []
  for (const trip of trips) {
    if (trip.pickup.address.geocodeStatus === 'pending' && trip.pickup.address.raw) {
      slots.push({ tripId: trip.id, slot: 'pickup', raw: trip.pickup.address.raw })
    }
    if (trip.dropoff.address.geocodeStatus === 'pending' && trip.dropoff.address.raw) {
      slots.push({ tripId: trip.id, slot: 'dropoff', raw: trip.dropoff.address.raw })
    }
  }

  await Promise.all(
    slots.map(async ({ tripId, slot, raw }) => {
      const candidates = await searchAddressCached(raw)
      if (candidates.length > 0) {
        actions.setAddressGeo(tripId, slot, candidates[0].label, candidates[0].geo)
        if (candidates.length === 1) result.resolved += 1
        else result.bestGuess += 1
        return
      }

      const censusMatches = await searchAddressViaCensus(raw)
      if (censusMatches.length > 0) {
        actions.setAddressGeo(tripId, slot, censusMatches[0].label, censusMatches[0].geo)
        result.viaCensus += 1
        return
      }

      actions.setAddressFailed(tripId, slot)
      result.failed += 1
    }),
  )

  return result
}
