import { describe, expect, it } from 'vitest'
import { normalizeExcelDateTime } from '../timeUtils'

describe('normalizeExcelDateTime', () => {
  const reference = new Date(2026, 8, 9) // 2026-09-09, local time, midnight

  it('returns undefined for empty/nullish input', () => {
    expect(normalizeExcelDateTime(undefined, reference)).toBeUndefined()
    expect(normalizeExcelDateTime(null, reference)).toBeUndefined()
    expect(normalizeExcelDateTime('', reference)).toBeUndefined()
  })

  it('parses a fractional Excel serial as a time on the reference date', () => {
    const iso = normalizeExcelDateTime(0.25, reference) // 06:00
    expect(iso).toBeDefined()
    const d = new Date(iso!)
    expect(d.getHours()).toBe(6)
    expect(d.getMinutes()).toBe(0)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(9)
  })

  it('parses a full Excel serial date+time', () => {
    // 46000 => 2025-12-25-ish; just assert it round-trips to a sane date, not 1899/1970
    const iso = normalizeExcelDateTime(46000.5, reference)
    expect(iso).toBeDefined()
    const d = new Date(iso!)
    expect(d.getFullYear()).toBeGreaterThan(2020)
  })

  it('parses military-style "0620" strings', () => {
    const iso = normalizeExcelDateTime('0620', reference)
    const d = new Date(iso!)
    expect(d.getHours()).toBe(6)
    expect(d.getMinutes()).toBe(20)
  })

  it('parses "6:20 AM" / "6:20 PM" strings', () => {
    const am = new Date(normalizeExcelDateTime('6:20 AM', reference)!)
    expect(am.getHours()).toBe(6)
    expect(am.getMinutes()).toBe(20)

    const pm = new Date(normalizeExcelDateTime('6:20 PM', reference)!)
    expect(pm.getHours()).toBe(18)
    expect(pm.getMinutes()).toBe(20)
  })

  it('parses 24h "HH:MM" strings without meridiem', () => {
    const d = new Date(normalizeExcelDateTime('23:45', reference)!)
    expect(d.getHours()).toBe(23)
    expect(d.getMinutes()).toBe(45)
  })

  it('re-anchors a JS Date already on the reference date', () => {
    const jsDate = new Date(2026, 8, 9, 14, 30)
    const iso = normalizeExcelDateTime(jsDate, reference)
    const d = new Date(iso!)
    expect(d.getHours()).toBe(14)
    expect(d.getMinutes()).toBe(30)
  })

  it('re-anchors an exceljs time-only Date (1899 epoch) onto the reference date', () => {
    // exceljs represents a pure time-of-day cell as a Date on its own 1899-12-31 epoch
    const timeOnly = new Date(Date.UTC(1899, 11, 31, 6, 20))
    const iso = normalizeExcelDateTime(timeOnly, reference)
    const d = new Date(iso!)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(8)
    expect(d.getDate()).toBe(9)
  })

  it('returns undefined for garbage strings', () => {
    expect(normalizeExcelDateTime('not a time', reference)).toBeUndefined()
  })
})
