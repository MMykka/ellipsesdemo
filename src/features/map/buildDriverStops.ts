import { tripSortTimestamp } from '../../domain/time/tripSortTime'
import type { Trip } from '../../types/trip'
import type { Stop } from '../../types/routing'

export type StopKind = Stop['kind']

export function stopKey(tripId: string, kind: StopKind): string {
  return `${tripId}:${kind}`
}

interface Candidate {
  trip: Trip
  kind: StopKind
  isPreview?: boolean
}

function defaultCandidateOrder(a: Candidate, b: Candidate): number {
  const timeA = tripSortTimestamp(a.trip)
  const timeB = tripSortTimestamp(b.trip)
  if (timeA !== timeB) return timeA - timeB
  if (a.trip.id !== b.trip.id) return a.trip.id < b.trip.id ? -1 : 1
  return a.kind === 'pickup' ? -1 : 1 // pickup before dropoff within the same trip
}

function candidateToStop(candidate: Candidate, sequenceNumber: number): Stop {
  const { trip, kind, isPreview } = candidate
  const leg = kind === 'pickup' ? trip.pickup : trip.dropoff
  return {
    sequenceNumber,
    tripId: trip.id,
    leg: trip.leg,
    kind,
    memberName: trip.memberName,
    spaceType: trip.spaceType,
    geo: leg.address.geo!,
    targetTime: kind === 'pickup' ? trip.pickup.requestedTime : trip.dropoff.apptTime,
    ...(isPreview ? { isPreview: true } : {}),
  }
}

/**
 * Pure sequencing logic behind useDriverRoute — kept separate so it's testable without React.
 * Default order: trips sorted by requested pickup time, each contributing its pickup then its
 * dropoff. A dispatcher can override this via drag-to-reorder (stored per-driver as an ordered
 * list of stop keys in sequenceOverrideStore) — any stop not covered by the override (new
 * assignments made after the override was set) is appended at the end in default order.
 *
 * `previewTripId` optionally folds one extra, not-actually-assigned trip into the sequence
 * (flagged with `isPreview`) so a dispatcher can see how it would land on this driver's route
 * before committing to the assignment. It's ignored once the trip is genuinely assigned here.
 */
export function buildDriverStops(
  trips: Trip[],
  driverId: string,
  manualOrder?: string[],
  previewTripId?: string,
): Stop[] {
  const assigned = trips
    .filter((t) => t.assignedDriverId === driverId)
    .filter((t) => t.pickup.address.geo && t.dropoff.address.geo)

  const previewTrip = trips.find(
    (t) =>
      t.id === previewTripId &&
      t.assignedDriverId !== driverId &&
      t.pickup.address.geo &&
      t.dropoff.address.geo,
  )

  const candidates: Candidate[] = [
    ...assigned.flatMap((trip) => [
      { trip, kind: 'pickup' as const },
      { trip, kind: 'dropoff' as const },
    ]),
    ...(previewTrip
      ? [
          { trip: previewTrip, kind: 'pickup' as const, isPreview: true },
          { trip: previewTrip, kind: 'dropoff' as const, isPreview: true },
        ]
      : []),
  ]

  let ordered: Candidate[]
  if (manualOrder && manualOrder.length > 0) {
    const byKey = new Map(candidates.map((c) => [stopKey(c.trip.id, c.kind), c]))
    const seen = new Set<string>()
    const fromOverride: Candidate[] = []
    for (const key of manualOrder) {
      const c = byKey.get(key)
      if (c) {
        fromOverride.push(c)
        seen.add(key)
      }
    }
    const remaining = candidates
      .filter((c) => !seen.has(stopKey(c.trip.id, c.kind)))
      .sort(defaultCandidateOrder)
    ordered = [...fromOverride, ...remaining]
  } else {
    ordered = [...candidates].sort(defaultCandidateOrder)
  }

  return ordered.map((candidate, index) => candidateToStop(candidate, index + 1))
}
