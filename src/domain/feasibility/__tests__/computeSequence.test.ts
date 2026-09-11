import { describe, expect, it } from 'vitest'
import type { Stop } from '../../../types/routing'
import { computeSequence } from '../computeSequence'

const GARAGE = { lat: 33.7, lng: -116.3 }

function makeStop(overrides: Partial<Stop> & { sequenceNumber: number }): Stop {
  return {
    tripId: `trip-${overrides.sequenceNumber}`,
    leg: 'A',
    kind: 'pickup',
    memberName: 'Member',
    spaceType: 'AMB',
    geo: { lat: 33.72, lng: -116.32 },
    ...overrides,
  }
}

describe('computeSequence', () => {
  it('returns an empty array for no stops', () => {
    expect(computeSequence(GARAGE, [], { shiftStart: new Date() })).toEqual([])
  })

  it('computes travel/arrival walking from the garage through each stop in order', () => {
    const shiftStart = new Date('2026-09-09T08:00:00.000Z')
    const stops: Stop[] = [
      makeStop({ sequenceNumber: 1, kind: 'pickup', geo: { lat: 33.72, lng: -116.32 } }),
      makeStop({ sequenceNumber: 2, kind: 'dropoff', geo: { lat: 33.75, lng: -116.35 } }),
    ]

    const result = computeSequence(GARAGE, stops, { shiftStart })

    expect(result).toHaveLength(2)
    // first stop's arrival should be after shiftStart (nonzero travel from garage)
    expect(new Date(result[0].arriveTime).getTime()).toBeGreaterThan(shiftStart.getTime())
    // second stop's arrival should be after the first stop's service ends
    expect(new Date(result[1].arriveTime).getTime()).toBeGreaterThanOrEqual(
      new Date(result[0].performEnd).getTime(),
    )
    // cumulative distance should increase
    expect(result[1].arriveDistanceMiles).toBeGreaterThan(result[0].arriveDistanceMiles)
  })

  it('treats a missing garage as starting exactly at shiftStart with zero initial travel', () => {
    const shiftStart = new Date('2026-09-09T08:00:00.000Z')
    const stops: Stop[] = [makeStop({ sequenceNumber: 1 })]
    const result = computeSequence(undefined, stops, { shiftStart })

    expect(result[0].travelMiles).toBe(0)
    expect(result[0].travelMinutes).toBe(0)
    expect(result[0].arriveTime).toBe(shiftStart.toISOString())
  })

  it('a pickup does not start service before its requested time, even if the driver arrives early', () => {
    const shiftStart = new Date('2026-09-09T08:00:00.000Z')
    const stops: Stop[] = [
      makeStop({
        sequenceNumber: 1,
        kind: 'pickup',
        geo: GARAGE, // zero travel time, so arrival == shiftStart
        targetTime: '2026-09-09T09:00:00.000Z', // an hour after the driver would arrive
      }),
    ]
    const result = computeSequence(GARAGE, stops, { shiftStart })

    expect(result[0].arriveTime).toBe(shiftStart.toISOString())
    expect(new Date(result[0].performStart).getTime()).toBe(new Date('2026-09-09T09:00:00.000Z').getTime())
  })

  it('a dropoff begins service immediately on arrival regardless of target time', () => {
    const shiftStart = new Date('2026-09-09T08:00:00.000Z')
    const stops: Stop[] = [
      makeStop({
        sequenceNumber: 1,
        kind: 'dropoff',
        geo: GARAGE,
        targetTime: '2026-09-09T09:00:00.000Z',
      }),
    ]
    const result = computeSequence(GARAGE, stops, { shiftStart })
    expect(result[0].performStart).toBe(result[0].arriveTime)
  })

  it('uses the space-type service duration for load/unload time', () => {
    const shiftStart = new Date('2026-09-09T08:00:00.000Z')
    const stops: Stop[] = [makeStop({ sequenceNumber: 1, spaceType: 'Wheelchair' })]
    const result = computeSequence(GARAGE, stops, {
      shiftStart,
      serviceDurationByType: { Wheelchair: 8 },
    })
    expect(result[0].loadUnloadMinutes).toBe(8)
  })

  it('falls back to a default service duration for an unknown space type', () => {
    const shiftStart = new Date('2026-09-09T08:00:00.000Z')
    const stops: Stop[] = [makeStop({ sequenceNumber: 1, spaceType: 'SomethingUnusual' })]
    const result = computeSequence(GARAGE, stops, { shiftStart, serviceDurationByType: {} })
    expect(result[0].loadUnloadMinutes).toBeGreaterThan(0)
  })

  it('classifies status against the target time using classifyTiming', () => {
    const shiftStart = new Date('2026-09-09T08:00:00.000Z')
    const stops: Stop[] = [
      makeStop({
        sequenceNumber: 1,
        kind: 'dropoff',
        geo: GARAGE, // arrives exactly at shiftStart
        targetTime: shiftStart.toISOString(),
      }),
    ]
    const result = computeSequence(GARAGE, stops, { shiftStart })
    expect(result[0].status).toBe('On Time')
  })

  it('reports "Unknown" status when there is no target time', () => {
    const shiftStart = new Date('2026-09-09T08:00:00.000Z')
    const stops: Stop[] = [makeStop({ sequenceNumber: 1, targetTime: undefined })]
    const result = computeSequence(GARAGE, stops, { shiftStart })
    expect(result[0].status).toBe('Unknown')
  })
})
