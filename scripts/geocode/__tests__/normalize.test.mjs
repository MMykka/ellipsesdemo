import { describe, expect, it } from 'vitest'
import { toMatchExpression } from '../normalize.mjs'

describe('toMatchExpression', () => {
  it('requires numeric tokens (house number, zip) via AND, ORs the rest', () => {
    expect(toMatchExpression('44220 San Pablo Ave, Apt 5, Palm Desert, CA 92260')).toBe(
      '44220* AND 92260* AND (san* OR pablo* OR ave* OR palm* OR desert* OR ca*)',
    )
  })

  it('strips a trailing country name', () => {
    expect(toMatchExpression('82900 Ave 42, Indio, CA 92203, USA')).toBe(
      '82900* AND 42* AND 92203* AND (ave* OR indio* OR ca*)',
    )
  })

  it('leaves an address with no noise words unchanged aside from tokenizing', () => {
    expect(toMatchExpression('82900 Ave 42, Indio, CA 92203')).toBe(
      '82900* AND 42* AND 92203* AND (ave* OR indio* OR ca*)',
    )
  })

  it('handles suite/unit/floor variants', () => {
    expect(toMatchExpression('1 Main St Suite 200')).toBe('1* AND (main* OR st*)')
    expect(toMatchExpression('1 Main St Unit B')).toBe('1* AND (main* OR st* OR b*)') // non-numeric unit id is kept as a token
  })

  it('is all-required when every token is numeric', () => {
    expect(toMatchExpression('90210')).toBe('90210*')
  })

  it('is all-optional when no token is numeric', () => {
    expect(toMatchExpression('Main Street')).toBe('main* OR street*')
  })

  it('returns undefined for empty/whitespace-only input', () => {
    expect(toMatchExpression('   ')).toBeUndefined()
  })
})
