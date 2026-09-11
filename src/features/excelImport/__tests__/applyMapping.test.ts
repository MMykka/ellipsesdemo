import { describe, expect, it } from 'vitest'
import { suggestFieldMapping } from '../legGroupDetection'
import { applyMapping } from '../applyMapping'
import type { ColumnMappingProfile } from '../../../types/columnMapping'

describe('suggestFieldMapping + applyMapping', () => {
  const reference = new Date(2026, 8, 9)

  it('produces two linked trips from a row with duplicated leg-A/leg-B headers', () => {
    const headerRow = [
      'Funding Source',
      'Trip ID',
      'Member Name',
      'Pick-up Address',
      'Drop-Off Address',
      'Phone Number 1',
      'Mileage',
      'Trip ID',
      'Member Name',
      'Pick-up Address',
      'Driver Name',
      'Notes/Dispatch Notes',
    ]

    const { fields, hasTwoLegGroups } = suggestFieldMapping(headerRow)
    expect(hasTwoLegGroups).toBe(true)

    // Trip ID: first occurrence -> A, second -> B
    const tripIdFields = fields.filter((f) => f.canonicalField === 'tripId')
    expect(tripIdFields).toHaveLength(2)
    expect(tripIdFields[0].legGroup).toBe('A')
    expect(tripIdFields[1].legGroup).toBe('B')

    // Funding Source appears once -> shared
    const funding = fields.find((f) => f.canonicalField === 'fundingSource')
    expect(funding?.legGroup).toBe('shared')

    const profile: ColumnMappingProfile = {
      id: 'test',
      headerSignature: headerRow,
      fields,
      hasTwoLegGroups,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    }

    const row = [
      'Medi-Cal',
      '580570-A',
      'Eugene Conner',
      '44220 San Pablo Ave',
      '82900 Ave 42',
      '(442) 599-1471',
      10.74,
      '580570-B',
      'Eugene Conner',
      '82900 Ave 42',
      'Felix Encarnacion',
      'PU: Wheelchair Manual',
    ]

    const trips = applyMapping([row], profile, reference)
    expect(trips).toHaveLength(2)

    const [legA, legB] = trips
    expect(legA.leg).toBe('A')
    expect(legA.tripId).toBe('580570-A')
    expect(legA.id).toBe('580570-A') // source tripId already carries the leg suffix — must not double up to "580570-A-A"
    expect(legA.memberName).toBe('Eugene Conner')
    expect(legA.pickup.address.raw).toBe('44220 San Pablo Ave')
    expect(legA.fundingSource).toBe('Medi-Cal')
    expect(legA.linkedTripRecordId).toBe(legB.id)

    expect(legB.leg).toBe('B')
    expect(legB.tripId).toBe('580570-B')
    expect(legB.id).toBe('580570-B')
    expect(legB.driverName).toBe('Felix Encarnacion')
    expect(legB.linkedTripRecordId).toBe(legA.id)
  })

  it('produces a single trip per row when headers do not repeat', () => {
    const headerRow = ['Trip ID', 'Member Name', 'Pick-up Address', 'Pickup Time', 'Drop-Off Address']
    const { fields, hasTwoLegGroups } = suggestFieldMapping(headerRow)
    expect(hasTwoLegGroups).toBe(false)

    const profile: ColumnMappingProfile = {
      id: 'test2',
      headerSignature: headerRow,
      fields,
      hasTwoLegGroups,
      createdAt: new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    }

    const row = ['123', 'Jane Doe', '1 Main St', '06:20', '2 Second St']
    const trips = applyMapping([row], profile, reference)
    expect(trips).toHaveLength(1)
    expect(trips[0].memberName).toBe('Jane Doe')
    expect(trips[0].pickup.requestedTime).toBeDefined()
  })

  it('generic "ColumnN" headers default to ignore', () => {
    const { fields } = suggestFieldMapping(['Column1', 'Column2'])
    expect(fields.every((f) => f.canonicalField === 'ignore')).toBe(true)
  })
})
