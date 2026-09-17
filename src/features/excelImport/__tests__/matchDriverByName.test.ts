import { describe, expect, it } from 'vitest'
import { matchDriverByName } from '../matchDriverByName'
import type { Driver } from '../../../types/driver'

function makeDriver(id: string, name: string): Driver {
  return { id, name, garageAddress: { raw: '', geocodeStatus: 'skipped' }, active: true }
}

describe('matchDriverByName', () => {
  const drivers = [makeDriver('d1', 'Felix Encarnacion'), makeDriver('d2', 'Jane Doe')]

  it('matches on exact name', () => {
    expect(matchDriverByName('Felix Encarnacion', drivers)).toBe('d1')
  })

  it('matches case- and whitespace-insensitively', () => {
    expect(matchDriverByName('  felix   encarnacion ', drivers)).toBe('d1')
    expect(matchDriverByName('JANE DOE', drivers)).toBe('d2')
  })

  it('returns undefined when no driver matches', () => {
    expect(matchDriverByName('Someone Else', drivers)).toBeUndefined()
  })

  it('returns undefined for an empty/undefined name', () => {
    expect(matchDriverByName(undefined, drivers)).toBeUndefined()
    expect(matchDriverByName('', drivers)).toBeUndefined()
  })
})
