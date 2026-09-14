import { describe, expect, it } from 'vitest'
import { parseDelimitedText } from '../parseDelimitedText'

describe('parseDelimitedText', () => {
  it('parses a plain comma-separated file', () => {
    const csv = 'Trip ID,Member Name,Pick-up Address\n101,Jane Doe,123 Main St\n102,John Smith,456 Oak Ave\n'
    const { headerRow, rows } = parseDelimitedText(csv)
    expect(headerRow).toEqual(['Trip ID', 'Member Name', 'Pick-up Address'])
    expect(rows).toEqual([
      ['101', 'Jane Doe', '123 Main St'],
      ['102', 'John Smith', '456 Oak Ave'],
    ])
  })

  it('handles quoted fields with embedded commas and escaped quotes', () => {
    const csv = 'Name,Notes\n"Doe, Jane","Said ""hello"" at pickup"\n'
    const { rows } = parseDelimitedText(csv)
    expect(rows).toEqual([['Doe, Jane', 'Said "hello" at pickup']])
  })

  it('handles a newline embedded inside a quoted field', () => {
    const csv = 'Name,Notes\nJane,"Line one\nLine two"\n'
    const { rows } = parseDelimitedText(csv)
    expect(rows).toEqual([['Jane', 'Line one\nLine two']])
  })

  it('auto-detects a tab delimiter', () => {
    const tsv = 'Trip ID\tMember Name\n101\tJane Doe\n'
    const { headerRow, rows } = parseDelimitedText(tsv)
    expect(headerRow).toEqual(['Trip ID', 'Member Name'])
    expect(rows).toEqual([['101', 'Jane Doe']])
  })

  it('auto-detects a semicolon delimiter (common in European CSV exports)', () => {
    const csv = 'Trip ID;Member Name\n101;Jane Doe\n'
    const { headerRow, rows } = parseDelimitedText(csv)
    expect(headerRow).toEqual(['Trip ID', 'Member Name'])
    expect(rows).toEqual([['101', 'Jane Doe']])
  })

  it('strips a UTF-8 BOM if present', () => {
    const csv = '﻿Trip ID,Member Name\n101,Jane Doe\n'
    const { headerRow } = parseDelimitedText(csv)
    expect(headerRow).toEqual(['Trip ID', 'Member Name'])
  })

  it('fills blank headers with Column<n>', () => {
    const csv = 'Trip ID,,Pick-up Address\n101,x,123 Main St\n'
    const { headerRow } = parseDelimitedText(csv)
    expect(headerRow).toEqual(['Trip ID', 'Column2', 'Pick-up Address'])
  })

  it('drops fully blank rows and represents missing cells as null', () => {
    const csv = 'Trip ID,Member Name,Notes\n101,Jane Doe\n\n102,,\n'
    const { rows } = parseDelimitedText(csv)
    expect(rows).toEqual([
      ['101', 'Jane Doe', null],
      ['102', null, null],
    ])
  })

  it('handles CRLF line endings', () => {
    const csv = 'Trip ID,Member Name\r\n101,Jane Doe\r\n'
    const { rows } = parseDelimitedText(csv)
    expect(rows).toEqual([['101', 'Jane Doe']])
  })

  it('handles a file with no trailing newline', () => {
    const csv = 'Trip ID,Member Name\n101,Jane Doe'
    const { rows } = parseDelimitedText(csv)
    expect(rows).toEqual([['101', 'Jane Doe']])
  })

  it('returns empty headerRow/rows for empty input', () => {
    expect(parseDelimitedText('')).toEqual({ headerRow: [], rows: [] })
  })
})
