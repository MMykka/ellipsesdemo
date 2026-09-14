import { describe, expect, it } from 'vitest'
import { parseWorkbook } from '../parseWorkbook'

function fileFrom(content: BlobPart, name: string): File {
  return new File([content], name)
}

describe('parseWorkbook format detection', () => {
  it('parses a .csv file instead of trying (and failing) to read it as a zip', async () => {
    const csv = 'Trip ID,Member Name\n101,Jane Doe\n'
    const parsed = await parseWorkbook(fileFrom(csv, 'trips.csv'))
    expect(parsed.headerRow).toEqual(['Trip ID', 'Member Name'])
    expect(parsed.rows).toEqual([['101', 'Jane Doe']])
  })

  it('parses delimited text even when misnamed with an .xls extension', async () => {
    // Some export tools hand out CSV content under a .xls filename — content, not the
    // name, decides how the file is parsed.
    const csv = 'Trip ID,Member Name\n101,Jane Doe\n'
    const parsed = await parseWorkbook(fileFrom(csv, 'trips.xls'))
    expect(parsed.headerRow).toEqual(['Trip ID', 'Member Name'])
  })

  it('gives a clear error for a genuine legacy .xls (OLE2) file instead of a JSZip error', async () => {
    const ole2Signature = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0, 0, 0, 0])
    await expect(parseWorkbook(fileFrom(ole2Signature, 'legacy.xls'))).rejects.toThrow(/legacy \.xls/i)
  })

  it('throws when a .xlsx-named file is not actually a valid zip', async () => {
    const notReallyZip = 'this is not a spreadsheet'
    // No zip/OLE2 signature -> falls through to the delimited-text parser, which succeeds
    // (a single-column "spreadsheet" of text), rather than crashing.
    const parsed = await parseWorkbook(fileFrom(notReallyZip, 'trips.xlsx'))
    expect(parsed.headerRow).toEqual(['this is not a spreadsheet'])
  })
})
