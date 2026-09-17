import { searchAddressCached } from '../../services/geocodeCache'
import type { AddressSlot } from '../../store/tripsStore'
import type { Trip } from '../../types/trip'

export interface GeocodeAllResult {
  resolved: number
  bestGuess: number
  failed: number
}

interface GeocodeAllActions {
  setAddressGeo: (tripId: string, slot: AddressSlot, label: string, geo: { lat: number; lng: number }) => void
  setAddressFailed: (tripId: string, slot: AddressSlot) => void
}

/**
 * Best-effort bulk geocode: for every pickup/dropoff address still 'pending', applies the
 * top-ranked candidate from the free US Census Bureau Geocoder, falling back to OpenStreetMap
 * Nominatim for addresses Census can't find (see geocodeClient.ts). Only the bare address text is
 * ever sent — never a member's name, phone, or any other trip detail.
 * Auto-applying the top result (rather than always stopping for a manual pick) is what makes bulk
 * import practical; AddressGeocodeControl still shows a "not right?" affordance on every resolved
 * address so a bad auto-pick is one click to fix.
 */
export async function geocodeAllPending(
  trips: Trip[],
  actions: GeocodeAllActions,
): Promise<GeocodeAllResult> {
  const result: GeocodeAllResult = { resolved: 0, bestGuess: 0, failed: 0 }

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

      actions.setAddressFailed(tripId, slot)
      result.failed += 1
    }),
  )

  return result
}
