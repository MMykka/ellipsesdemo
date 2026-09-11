import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Trip } from '../../../types/trip'

vi.mock('../../../services/geocodeCache', () => ({
  searchAddressCached: vi.fn(),
}))

import { searchAddressCached } from '../../../services/geocodeCache'
import { geocodeAllPending } from '../geocodeAllPending'

function makeTrip(id: string, pickupRaw: string, dropoffRaw: string): Trip {
  return {
    id,
    tripId: id,
    leg: 'A',
    memberName: 'Test Member',
    pickup: { address: { raw: pickupRaw, geocodeStatus: 'pending' } },
    dropoff: { address: { raw: dropoffRaw, geocodeStatus: 'pending' } },
    spaceType: '',
    status: 'Scheduled',
    sourceRowIndex: 0,
    importedAt: new Date().toISOString(),
  }
}

describe('geocodeAllPending', () => {
  beforeEach(() => {
    vi.mocked(searchAddressCached).mockReset()
  })

  it('auto-applies the top candidate whether the match is unambiguous or a best guess, and marks zero-match as failed', async () => {
    vi.mocked(searchAddressCached).mockImplementation(async (raw: string) => {
      if (raw === 'unique address') {
        return [{ label: 'Unique Address Resolved', geo: { lat: 1, lng: 2 } }]
      }
      if (raw === 'ambiguous address') {
        return [
          { label: 'Candidate 1', geo: { lat: 1, lng: 1 } },
          { label: 'Candidate 2', geo: { lat: 2, lng: 2 } },
        ]
      }
      return []
    })

    const trip = makeTrip('t1', 'unique address', 'ambiguous address')
    const trip2 = makeTrip('t2', 'truly nowhere address', 'unique address')

    const setAddressGeo = vi.fn()
    const setAddressFailed = vi.fn()

    const result = await geocodeAllPending([trip, trip2], { setAddressGeo, setAddressFailed })

    expect(result).toEqual({ resolved: 2, bestGuess: 1, failed: 1 })
    expect(setAddressGeo).toHaveBeenCalledWith(
      't1',
      'pickup',
      'Unique Address Resolved',
      { lat: 1, lng: 2 },
    )
    // ambiguous 'ambiguous address' on t1.dropoff auto-applies the top-ranked candidate
    expect(setAddressGeo).toHaveBeenCalledWith('t1', 'dropoff', 'Candidate 1', { lat: 1, lng: 1 })
    expect(setAddressFailed).toHaveBeenCalledWith('t2', 'pickup')
  })

  it('skips addresses that are not pending or have no raw text', async () => {
    const trip: Trip = {
      ...makeTrip('t3', '', 'already resolved'),
      dropoff: {
        address: { raw: 'already resolved', geocodeStatus: 'resolved', geo: { lat: 9, lng: 9 } },
      },
    }

    const setAddressGeo = vi.fn()
    const setAddressFailed = vi.fn()
    const result = await geocodeAllPending([trip], { setAddressGeo, setAddressFailed })

    expect(result).toEqual({ resolved: 0, bestGuess: 0, failed: 0 })
    expect(searchAddressCached).not.toHaveBeenCalled()
  })
})
