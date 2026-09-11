import { describe, expect, it } from 'vitest'
import type { Trip } from '../../../types/trip'
import { buildDriverStops, stopKey } from '../buildDriverStops'

function makeTrip(overrides: Partial<Trip> & { id: string }): Trip {
  return {
    tripId: overrides.id,
    leg: 'A',
    memberName: 'Member',
    pickup: {
      address: { raw: 'pickup', geo: { lat: 1, lng: 1 }, geocodeStatus: 'resolved' },
      requestedTime: '2026-09-09T14:00:00.000Z',
    },
    dropoff: {
      address: { raw: 'dropoff', geo: { lat: 2, lng: 2 }, geocodeStatus: 'resolved' },
    },
    spaceType: '',
    status: 'Scheduled',
    sourceRowIndex: 0,
    importedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('buildDriverStops', () => {
  it('only includes trips assigned to the given driver', () => {
    const trips = [
      makeTrip({ id: 't1', assignedDriverId: 'driver-1' }),
      makeTrip({ id: 't2', assignedDriverId: 'driver-2' }),
      makeTrip({ id: 't3', assignedDriverId: undefined }),
    ]
    const stops = buildDriverStops(trips, 'driver-1')
    expect(stops.map((s) => s.tripId)).toEqual(['t1', 't1'])
  })

  it('skips trips missing pickup or dropoff geo', () => {
    const trips = [
      makeTrip({
        id: 't1',
        assignedDriverId: 'driver-1',
        pickup: { address: { raw: 'x', geocodeStatus: 'pending' } },
      }),
    ]
    expect(buildDriverStops(trips, 'driver-1')).toEqual([])
  })

  it('orders trips by requested pickup time, pickup before dropoff, sequential numbering', () => {
    const early = makeTrip({
      id: 'early',
      assignedDriverId: 'd1',
      pickup: {
        address: { raw: 'p1', geo: { lat: 10, lng: 10 }, geocodeStatus: 'resolved' },
        requestedTime: '2026-09-09T08:00:00.000Z',
      },
      dropoff: { address: { raw: 'd1', geo: { lat: 11, lng: 11 }, geocodeStatus: 'resolved' } },
    })
    const late = makeTrip({
      id: 'late',
      assignedDriverId: 'd1',
      pickup: {
        address: { raw: 'p2', geo: { lat: 20, lng: 20 }, geocodeStatus: 'resolved' },
        requestedTime: '2026-09-09T15:00:00.000Z',
      },
      dropoff: { address: { raw: 'd2', geo: { lat: 21, lng: 21 }, geocodeStatus: 'resolved' } },
    })

    // pass "late" first in the array to prove sorting (not array order) determines sequence
    const stops = buildDriverStops([late, early], 'd1')

    expect(stops.map((s) => ({ tripId: s.tripId, kind: s.kind, seq: s.sequenceNumber }))).toEqual([
      { tripId: 'early', kind: 'pickup', seq: 1 },
      { tripId: 'early', kind: 'dropoff', seq: 2 },
      { tripId: 'late', kind: 'pickup', seq: 3 },
      { tripId: 'late', kind: 'dropoff', seq: 4 },
    ])
  })

  it('puts trips with no requested pickup time last', () => {
    const noTime = makeTrip({
      id: 'no-time',
      assignedDriverId: 'd1',
      pickup: { address: { raw: 'p', geo: { lat: 1, lng: 1 }, geocodeStatus: 'resolved' } },
    })
    const withTime = makeTrip({
      id: 'with-time',
      assignedDriverId: 'd1',
      pickup: {
        address: { raw: 'p', geo: { lat: 1, lng: 1 }, geocodeStatus: 'resolved' },
        requestedTime: '2026-09-09T09:00:00.000Z',
      },
    })

    const stops = buildDriverStops([noTime, withTime], 'd1')
    expect(stops[0].tripId).toBe('with-time')
    expect(stops[2].tripId).toBe('no-time')
  })

  it('populates spaceType from the trip', () => {
    const trip = makeTrip({ id: 't1', assignedDriverId: 'd1', spaceType: 'Wheelchair' })
    const stops = buildDriverStops([trip], 'd1')
    expect(stops.every((s) => s.spaceType === 'Wheelchair')).toBe(true)
  })

  describe('manual order override', () => {
    const tripA = makeTrip({
      id: 'A',
      assignedDriverId: 'd1',
      pickup: { address: { raw: 'pa', geo: { lat: 1, lng: 1 }, geocodeStatus: 'resolved' }, requestedTime: '2026-09-09T08:00:00.000Z' },
      dropoff: { address: { raw: 'da', geo: { lat: 2, lng: 2 }, geocodeStatus: 'resolved' } },
    })
    const tripB = makeTrip({
      id: 'B',
      assignedDriverId: 'd1',
      pickup: { address: { raw: 'pb', geo: { lat: 3, lng: 3 }, geocodeStatus: 'resolved' }, requestedTime: '2026-09-09T09:00:00.000Z' },
      dropoff: { address: { raw: 'db', geo: { lat: 4, lng: 4 }, geocodeStatus: 'resolved' } },
    })

    it('honors a full manual order over the default time-based order', () => {
      const manualOrder = [stopKey('B', 'pickup'), stopKey('B', 'dropoff'), stopKey('A', 'pickup'), stopKey('A', 'dropoff')]
      const stops = buildDriverStops([tripA, tripB], 'd1', manualOrder)
      expect(stops.map((s) => stopKey(s.tripId, s.kind))).toEqual(manualOrder)
      expect(stops.map((s) => s.sequenceNumber)).toEqual([1, 2, 3, 4])
    })

    it('appends stops missing from a partial manual order, in default order, after the ones covered', () => {
      // override only covers trip B's stops; trip A's stops (new assignment) should append after
      const manualOrder = [stopKey('B', 'pickup'), stopKey('B', 'dropoff')]
      const stops = buildDriverStops([tripA, tripB], 'd1', manualOrder)
      expect(stops.map((s) => stopKey(s.tripId, s.kind))).toEqual([
        stopKey('B', 'pickup'),
        stopKey('B', 'dropoff'),
        stopKey('A', 'pickup'),
        stopKey('A', 'dropoff'),
      ])
    })

    it('ignores stale keys in the manual order that no longer correspond to an assigned stop', () => {
      const manualOrder = [stopKey('nonexistent', 'pickup'), stopKey('A', 'pickup'), stopKey('A', 'dropoff')]
      const stops = buildDriverStops([tripA], 'd1', manualOrder)
      expect(stops.map((s) => stopKey(s.tripId, s.kind))).toEqual([stopKey('A', 'pickup'), stopKey('A', 'dropoff')])
    })
  })
})
