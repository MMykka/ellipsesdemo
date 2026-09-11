/**
 * Normalizes Excel cell values that represent a time-of-day or datetime into an ISO 8601 string.
 * Handles three shapes seen in real exports: a JS Date (exceljs parses formatted date/time cells
 * into Date objects), an Excel serial number (fractional day count, e.g. 0.25 = 06:00), and a
 * plain string (e.g. "06:20", "0620", "06/20/2026 06:20 AM").
 */
export function normalizeExcelDateTime(
  value: unknown,
  referenceDate: Date = new Date(),
): string | undefined {
  if (value === null || value === undefined || value === '') return undefined

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined
    return combineWithReferenceDateIfTimeOnly(value, referenceDate)
  }

  if (typeof value === 'number') {
    return excelSerialToIso(value, referenceDate)
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return undefined

    const hhmm = parseHhMm(trimmed)
    if (hhmm) {
      const d = new Date(referenceDate)
      d.setHours(hhmm.hours, hhmm.minutes, 0, 0)
      return d.toISOString()
    }

    const parsed = new Date(trimmed)
    if (!Number.isNaN(parsed.getTime())) {
      return combineWithReferenceDateIfTimeOnly(parsed, referenceDate)
    }

    return undefined
  }

  return undefined
}

/** Excel's epoch is 1899-12-30 (accounting for the historical 1900 leap-year bug). */
const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 24 * 60 * 60 * 1000

function excelSerialToIso(serial: number, referenceDate: Date): string | undefined {
  if (!Number.isFinite(serial)) return undefined

  // A serial below 1 has no date component (e.g. 0.25 = 06:00) — treat it as time-only,
  // applied to the reference date, rather than the year-1899 Excel epoch.
  if (serial < 1) {
    const msIntoDay = Math.round(serial * MS_PER_DAY)
    const d = new Date(referenceDate)
    d.setHours(0, 0, 0, 0)
    return new Date(d.getTime() + msIntoDay).toISOString()
  }

  const ms = EXCEL_EPOCH_MS + serial * MS_PER_DAY
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}

function combineWithReferenceDateIfTimeOnly(value: Date, referenceDate: Date): string {
  // exceljs returns time-only cells as a Date on 1899-12-31 (its own time-serialization epoch).
  // Re-anchor those onto the reference date so times aren't stranded in 1899.
  if (value.getUTCFullYear() === 1899) {
    const d = new Date(referenceDate)
    d.setHours(value.getHours(), value.getMinutes(), value.getSeconds(), value.getMilliseconds())
    return d.toISOString()
  }
  return value.toISOString()
}

function parseHhMm(text: string): { hours: number; minutes: number } | undefined {
  // "0620" military-style
  if (/^\d{3,4}$/.test(text)) {
    const padded = text.padStart(4, '0')
    const hours = Number(padded.slice(0, 2))
    const minutes = Number(padded.slice(2))
    if (hours <= 23 && minutes <= 59) return { hours, minutes }
    return undefined
  }

  // "6:20", "06:20", "6:20 AM", "06:20:00"
  const match = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i)
  if (!match) return undefined

  let hours = Number(match[1])
  const minutes = Number(match[2])
  const meridiem = match[3]?.toUpperCase()

  if (hours > 23 || minutes > 59) return undefined

  if (meridiem === 'PM' && hours < 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0

  return { hours, minutes }
}
