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

  const tripId = tripIdRaw ?? `row${rowIndex}-${leg}`
  // Some exports already bake the leg letter into the trip ID itself (e.g. "580570-A"); only
  // append it ourselves when it isn't already there, to avoid ids like "580570-A-A".
  const alreadyHasLegSuffix = new RegExp(`[-_]${leg}$`, 'i').test(tripId)
  const id = alreadyHasLegSuffix ? tripId : `${tripId}-${leg}`

  return {
    id,
    tripId,
    leg,
    memberName: memberName ?? 'Unknown Member',
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
    status: (cellText(get('status')) as Trip['status']) ?? 'Scheduled',
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

  return trips
}
