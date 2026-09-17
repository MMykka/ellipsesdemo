import { normalizeExcelDateTime } from '../../domain/time/timeUtils'
import type { ColumnMappingProfile, FieldMappingEntry, LegGroup } from '../../types/columnMapping'
import type { Address, Trip, TripLeg } from '../../types/trip'

function cellText(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined
  const text = String(value).trim()
  return text || undefined
}

function cellNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const num = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(num) ? num : undefined
}

function makeAddress(raw: string | undefined): Address {
  return { raw: raw ?? '', geocodeStatus: raw ? 'pending' : 'skipped' }
}

function valueFor(
  row: unknown[],
  fields: FieldMappingEntry[],
  legGroup: LegGroup,
  canonicalField: string,
): unknown {
  const index = fields.findIndex(
    (f) =>
      f.canonicalField === canonicalField &&
      (f.legGroup === legGroup || f.legGroup === 'shared'),
  )
  if (index === -1) return undefined
  return row[index]
}

function buildTripForLeg(
  row: unknown[],
  fields: FieldMappingEntry[],
  legGroup: LegGroup,
  leg: TripLeg,
  rowIndex: number,
  importedAt: string,
  referenceDate: Date,
): Trip | undefined {
  const get = (field: string) => valueFor(row, fields, legGroup, field)

  const tripIdRaw = cellText(get('tripId'))
  const memberName = cellText(get('memberName'))
  const pickupAddressRaw = cellText(get('pickupAddress'))
  const dropoffAddressRaw = cellText(get('dropoffAddress'))

  // A leg with no identifying data at all (blank B-leg columns on a single-leg row) is skipped.
  if (!tripIdRaw && !memberName && !pickupAddressRaw && !dropoffAddressRaw) {
    return undefined
  }

  const statusRaw = cellText(get('status'))
  // Cancelled trips are dropped on import rather than shown — they're not something a dispatcher
  // needs to route or see cluttering the trip list.
  if (statusRaw?.trim().toLowerCase() === 'cancelled') {
    return undefined
  }

  const tripId = tripIdRaw ?? `row${rowIndex}-${leg}`
  // Some exports already bake the leg letter into the trip ID itself — either with a separator
  // ("580570-A") or without one ("X0VG47D190A", a common convention where a round trip is split
  // across two full rows, one per leg, rather than side-by-side columns on one row). That suffix
  // is the authoritative signal for which leg a row is — it takes priority over the column-group
  // leg — and we only append our own "-${leg}" when the id doesn't already end in one.
  const idLegMatch = tripId.match(/([AB])$/i)
  const actualLeg: TripLeg = idLegMatch ? (idLegMatch[1].toUpperCase() as TripLeg) : leg
  const id = idLegMatch ? tripId : `${tripId}-${leg}`

  return {
    id,
    tripId,
    leg: actualLeg,
    memberName: memberName ?? 'Unknown Member',
    tripDateTime: normalizeExcelDateTime(get('tripDateTime'), referenceDate),
    phone1: cellText(get('phone1')),
    phone2: cellText(get('phone2')),
    pickup: {
      address: makeAddress(pickupAddressRaw),
      requestedTime: normalizeExcelDateTime(get('pickupTime'), referenceDate),
      onSceneAt: normalizeExcelDateTime(get('onSceneAt'), referenceDate),
      onboardAt: normalizeExcelDateTime(get('onboardAt'), referenceDate),
    },
    dropoff: {
      address: makeAddress(dropoffAddressRaw),
      apptTime: normalizeExcelDateTime(get('apptTime'), referenceDate),
      finishedAt: normalizeExcelDateTime(get('finishedAt'), referenceDate),
    },
    spaceType: cellText(get('spaceType')) ?? '',
    mileage: cellNumber(get('mileage')),
    fare: cellNumber(get('fare')),
    driverName: cellText(get('driverName')),
    fundingSource: cellText(get('fundingSource')),
    notes: cellText(get('notes')),
    status: (statusRaw as Trip['status']) ?? 'Scheduled',
    cancelledAt: normalizeExcelDateTime(get('cancelledAt'), referenceDate),
    cancelledReason: cellText(get('cancelledReason')),
    sourceRowIndex: rowIndex,
    importedAt,
  }
}

/**
 * Applies a confirmed column mapping to raw parsed rows, producing one Trip per row (or two
 * linked Trips, leg A + leg B, when the mapping identifies two side-by-side field groups).
 */
export function applyMapping(
  rows: unknown[][],
  profile: ColumnMappingProfile,
  referenceDate: Date = new Date(),
): Trip[] {
  const importedAt = new Date().toISOString()
  const trips: Trip[] = []

  rows.forEach((row, rowIndex) => {
    const legA = buildTripForLeg(row, profile.fields, 'A', 'A', rowIndex, importedAt, referenceDate)
    const legB = profile.hasTwoLegGroups
      ? buildTripForLeg(row, profile.fields, 'B', 'B', rowIndex, importedAt, referenceDate)
      : undefined

    if (legA && legB) {
      legA.linkedTripRecordId = legB.id
      legB.linkedTripRecordId = legA.id
    }

    if (legA) trips.push(legA)
    if (legB) trips.push(legB)
  })

  linkRoundTripLegsAcrossRows(trips)

  return trips
}

/**
 * Some exports carry each leg of a round trip as its own full row — pickup-leg and return-leg
 * side by side in one row is only one convention; the other puts them on two separate rows,
 * distinguished solely by a trailing "A"/"B" on the trip ID (e.g. "X0VG47D190A" and
 * "X0VG47D190B"). buildTripForLeg already reads that suffix into each trip's `leg`; this links
 * such pairs via linkedTripRecordId so dispatchers can see they're the same round trip, the same
 * way same-row leg pairs already are.
 */
function linkRoundTripLegsAcrossRows(trips: Trip[]): void {
  const byBaseId = new Map<string, Trip[]>()
  for (const trip of trips) {
    const baseId = trip.tripId.replace(/[-_]?[AB]$/i, '')
    const group = byBaseId.get(baseId)
    if (group) group.push(trip)
    else byBaseId.set(baseId, [trip])
  }

  for (const group of byBaseId.values()) {
    if (group.length !== 2) continue
    const [first, second] = group
    if (first.linkedTripRecordId || second.linkedTripRecordId) continue
    if (first.leg === second.leg) continue
    first.linkedTripRecordId = second.id
    second.linkedTripRecordId = first.id
  }
}
