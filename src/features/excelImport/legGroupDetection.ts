import type { CanonicalField, FieldMappingEntry, LegGroup } from '../../types/columnMapping'

const KEYWORD_MAP: [CanonicalField, string[]][] = [
  ['tripId', ['trip id', 'tripid', 'trip #', 'trip no']],
  ['memberName', ['member name', 'client name', 'patient name', 'passenger name']],
  ['pickupAddress', ['pick-up address', 'pickup address', 'pick up address', 'from address']],
  ['pickupTime', ['pick-up time', 'pickup time', 'pick up time']],
  ['dropoffAddress', ['drop-off address', 'dropoff address', 'drop off address', 'to address']],
  ['apptTime', ['appt time', 'appointment time', 'drop-off time', 'dropoff time', 'appt']],
  ['phone1', ['phone number 1', 'phone 1', 'primary phone']],
  ['phone2', ['phone number 2', 'phone 2', 'secondary phone']],
  ['spaceType', ['level of service', 'space type', 'los', 'vehicle type']],
  ['mileage', ['mileage', 'miles']],
  ['driverName', ['driver name', 'driver']],
  ['fundingSource', ['funding source', 'lob', 'funding']],
  ['notes', ['notes/dispatch notes', 'dispatch notes', 'notes', 'driver notes']],
  ['status', ['status']],
  ['onSceneAt', ['on scene at', 'on scene']],
  ['onboardAt', ['member onboard at', 'onboard at', 'onboard']],
  ['finishedAt', ['finished at']],
  ['cancelledAt', ['cancelled at']],
  ['cancelledReason', ['cancelled reason', 'cancel reason']],
  ['fare', ['fare']],
  // phone/name/address fallbacks last, so more specific phrases above win first
  ['phone1', ['phone']],
]

function guessCanonicalField(label: string): CanonicalField {
  const normalized = label.trim().toLowerCase()
  if (/^column\d+$/.test(normalized)) return 'ignore'

  for (const [field, keywords] of KEYWORD_MAP) {
    if (keywords.some((kw) => normalized === kw || normalized.includes(kw))) {
      return field
    }
  }
  return 'ignore'
}

/**
 * Suggests an initial column mapping from a raw header row. When the same header label appears
 * more than once (common in exports that place two trip legs side by side per row), the first
 * occurrence is tentatively assigned to leg A and the second to leg B; everything else is 'shared'.
 * The user always reviews/adjusts this in the mapper UI before it's applied.
 */
export function suggestFieldMapping(headerRow: string[]): {
  fields: FieldMappingEntry[]
  hasTwoLegGroups: boolean
} {
  const seenCounts = new Map<string, number>()
  const labelTotalCounts = new Map<string, number>()
  for (const label of headerRow) {
    const key = label.trim().toLowerCase()
    labelTotalCounts.set(key, (labelTotalCounts.get(key) ?? 0) + 1)
  }

  let sawLegB = false

  const fields: FieldMappingEntry[] = headerRow.map((label, index) => {
    const key = label.trim().toLowerCase()
    const total = labelTotalCounts.get(key) ?? 1
    const occurrence = (seenCounts.get(key) ?? 0) + 1
    seenCounts.set(key, occurrence)

    let legGroup: LegGroup = 'shared'
    if (total >= 2 && key !== '' && !/^column\d+$/.test(key)) {
      legGroup = occurrence === 1 ? 'A' : 'B'
      if (legGroup === 'B') sawLegB = true
    }

    return {
      rawColumnKey: `col${index}`,
      rawColumnLabel: label,
      canonicalField: guessCanonicalField(label),
      legGroup,
    }
  })

  return { fields, hasTwoLegGroups: sawLegB }
}
