import type { Trip } from '../../types/trip'

/**
 * A trip's date/time for display and ordering purposes: its pickup time when known, falling back
 * to the imported trip date/time (some exports carry only one of the two — e.g. a plain
 * "Schedule Time" column maps to pickup time, with no separate trip-date/time column at all).
 */
export function tripDisplayDateTime(trip: Trip): string | undefined {
  return trip.pickup.requestedTime ?? trip.tripDateTime
}

/** Same as tripDisplayDateTime, as a sortable number. Trips with neither time sort last. */
export function tripSortTimestamp(trip: Trip): number {
  const iso = tripDisplayDateTime(trip)
  return iso ? new Date(iso).getTime() : Infinity
}
