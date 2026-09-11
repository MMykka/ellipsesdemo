import { describe, expect, it } from 'vitest'
import { classifyTiming, DEFAULT_TIMING_THRESHOLDS } from '../classifyTiming'

describe('classifyTiming', () => {
  const target = '2026-09-09T14:00:00.000Z'

  it('returns undefined when either time is missing', () => {
    expect(classifyTiming(undefined, target)).toBeUndefined()
    expect(classifyTiming('2026-09-09T14:00:00.000Z', undefined)).toBeUndefined()
  })

  it('returns undefined for unparseable dates', () => {
    expect(classifyTiming('not a date', target)).toBeUndefined()
  })

  it('classifies "On Time" within the threshold window', () => {
    expect(classifyTiming('2026-09-09T14:05:00.000Z', target)).toBe('On Time')
    expect(classifyTiming('2026-09-09T13:55:00.000Z', target)).toBe('On Time')
    expect(classifyTiming(target, target)).toBe('On Time')
  })

  it('classifies "Late" past the late threshold', () => {
    expect(classifyTiming('2026-09-09T14:11:00.000Z', target)).toBe('Late')
  })

  it('classifies "Early" past the early threshold', () => {
    expect(classifyTiming('2026-09-09T13:49:00.000Z', target)).toBe('Early')
  })

  it('respects custom thresholds', () => {
    const tight = { lateMinutes: 2, earlyMinutes: 2 }
    expect(classifyTiming('2026-09-09T14:03:00.000Z', target, tight)).toBe('Late')
    expect(classifyTiming('2026-09-09T14:03:00.000Z', target, DEFAULT_TIMING_THRESHOLDS)).toBe('On Time')
  })

  it('accepts Date objects as well as ISO strings', () => {
    const actual = new Date('2026-09-09T14:20:00.000Z')
    expect(classifyTiming(actual, new Date(target))).toBe('Late')
  })
})
