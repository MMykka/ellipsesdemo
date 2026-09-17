import type { CanonicalField, FieldMappingEntry, LegGroup } from '../../types/columnMapping'

/**
 * Bump whenever KEYWORD_MAP or the auto-detection logic below changes in a way that could change
 * what an existing header row maps to. Column-mapping profiles are cached in localStorage keyed
 * by header row, so without this a fix here would silently stay unused forever for anyone who
 * already imported that file layout under the old (buggy) logic. mappingStore compares this
 * against a cached profile's own stamped version and, on a mismatch, treats it as not cached —
 * re-suggesting fresh and letting the mapper modal show the corrected mapping once.
 */
export const MAPPING_LOGIC_VERSION = 2

const KEYWORD_MAP: [CanonicalField, string[]][] = [
  ['tripId', ['trip id', 'tripid', 'trip #', 'trip no']],
  ['memberName', ['member name', 'client name', 'patient name', 'passenger name']],
  ['pickupAddress', ['pick-up address', 'pickup address', 'pick up address', 'from address']],
  ['pickupTime', ['pick-up time', 'pickup time', 'pick up time', 'schedule time', 'scheduled time']],
  ['tripDateTime', ['trip date', 'trip date/time', 'trip datetime', 'service date']],
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

// Matches values with an explicit date component paired with a time, e.g. "08/27/2026 1209",
// "9/14/2026 6:20 AM", or "2026-08-27 12:09" — as opposed to a bare time-of-day like "06:20",
// which shouldn't be mistaken for a full trip date/time.
const FULL_DATE_TIME_PATTERNS = [
  /^\d{1,2}\/\d{1,2}\/\d{2,4}[\sT]+\d/, // MM/DD/YYYY <time>
  /^\d{4}-\d{1,2}-\d{1,2}[\sT]+\d/, // YYYY-MM-DD <time>
]

/** An Excel date serial (days since 1899-12-30); values >= 1 carry a date, not just a time-of-day. */
function looksLikeDateSerial(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1
}

function looksLikeFullDateTime(value: unknown): boolean {
  if (value instanceof Date) return true
  if (looksLikeDateSerial(value)) return true
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return FULL_DATE_TIME_PATTERNS.some((pattern) => pattern.test(trimmed))
}

/**
 * For a blank-header ("ColumnN") column, sniffs a sample of raw data rows to see whether most
 * non-empty values look like a full date+time. Dispatch exports sometimes carry a trip date/time
 * column with no header text at all, so content is the only signal available.
 */
function columnLooksLikeDateTime(columnIndex: number, sampleRows: unknown[][]): boolean {
  let seen = 0
  let matches = 0
  for (const row of sampleRows) {
    const value = row[columnIndex]
    if (value === null || value === undefined || value === '') continue
    seen++
    if (looksLikeFullDateTime(value)) matches++
    if (seen >= 10) break
  }
  return seen > 0 && matches === seen
}

// "Actual Pick-up Time" contains "pick-up time" and "Actual Drop-Off Time" contains "drop-off
// time" as substrings, so they'd otherwise shadow the real Schedule Time / Appt. Time columns
// via the generic keyword matching below. These actual-time fields aren't consistently populated
// across exports and have no dedicated canonical field of their own, so they're left unmapped
// rather than risk silently overwriting a real value with a usually-blank one.
const IGNORE_EXACT = new Set([
  'actual pick-up time',
  'actual pickup time',
  'actual drop-off time',
  'actual dropoff time',
])

function guessCanonicalField(
  label: string,
  columnIndex: number,
  sampleRows: unknown[][],
): CanonicalField {
  // Strip punctuation like the period in "Appt. Time" so it still matches the "appt time" keyword.
  const normalized = label.trim().toLowerCase().replace(/[.,]/g, '')
  if (/^column\d+$/.test(normalized)) {
    return columnLooksLikeDateTime(columnIndex, sampleRows) ? 'tripDateTime' : 'ignore'
  }
  if (IGNORE_EXACT.has(normalized)) {
    return 'ignore'
  }

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
 * Blank-header columns are additionally sniffed against a sample of data rows to catch an
 * unlabeled trip date/time column. The user always reviews/adjusts this in the mapper UI before
 * it's applied.
 */
export function suggestFieldMapping(
  headerRow: string[],
  sampleRows: unknown[][] = [],
): {
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
      canonicalField: guessCanonicalField(label, index, sampleRows),
      legGroup,
    }
  })

  return { fields, hasTwoLegGroups: sawLegB }
}
