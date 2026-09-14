import ExcelJS from 'exceljs'
import { parseDelimitedText } from './parseDelimitedText'

export interface ParsedWorkbook {
  headerRow: string[]
  /** Each row is an array aligned to headerRow, raw cell values (string | number | Date | null). */
  rows: unknown[][]
}

/** Zip local-file-header signature ("PK\x03\x04") — .xlsx/.xlsm are zip archives. */
function isZipFile(bytes: Uint8Array): boolean {
  return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

/** OLE2 compound-file signature — the format legacy .xls (pre-2007 Excel) uses. Not supported. */
function isLegacyOleFile(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  )
}

function decodeText(bytes: Uint8Array): string {
  return new TextDecoder('utf-8').decode(bytes)
}

/** Turns a header cell's value into a stable string label, filling blanks with "Column<n>". */
function headerLabel(value: ExcelJS.CellValue, columnIndex: number): string {
  if (value === null || value === undefined) return `Column${columnIndex}`
  const text = cellValueToPlainText(value).trim()
  return text || `Column${columnIndex}`
}

function cellValueToPlainText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString()
    if ('text' in value && typeof (value as { text?: unknown }).text === 'string') {
      return (value as { text: string }).text
    }
    if ('richText' in value) {
      return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('')
    }
    if ('result' in value) {
      return cellValueToPlainText((value as { result: ExcelJS.CellValue }).result)
    }
  }
  return String(value)
}

function cellValueToRaw(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === 'object') {
    if ('text' in value && typeof (value as { text?: unknown }).text === 'string') {
      return (value as { text: string }).text
    }
    if ('richText' in value) {
      return (value as { richText: { text: string }[] }).richText.map((r) => r.text).join('')
    }
    if ('result' in value) {
      return cellValueToRaw((value as { result: ExcelJS.CellValue }).result)
    }
    return String(value)
  }
  return value
}

async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedWorkbook> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(buffer)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) {
    throw new Error('The workbook has no sheets.')
  }

  const headerExcelRow = worksheet.getRow(1)
  const columnCount = Math.max(worksheet.columnCount, headerExcelRow.cellCount)

  const headerRow: string[] = []
  for (let col = 1; col <= columnCount; col++) {
    headerRow.push(headerLabel(headerExcelRow.getCell(col).value, col))
  }

  const rows: unknown[][] = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const isEmpty = row.actualCellCount === 0
    if (isEmpty) return
    const values: unknown[] = []
    for (let col = 1; col <= columnCount; col++) {
      values.push(cellValueToRaw(row.getCell(col).value))
    }
    rows.push(values)
  })

  return { headerRow, rows }
}

/**
 * Reads an imported trip export. Format is detected from the file's actual bytes (not its
 * extension/name) so a CSV that happens to be named ".xls", or vice versa, still works:
 * - zip signature (PK..)        -> .xlsx/.xlsm, parsed via ExcelJS
 * - OLE2 signature              -> legacy pre-2007 .xls — not supported, clear error instead of
 *                                   ExcelJS's cryptic "is this a zip file?" message
 * - anything else               -> treated as delimited text (CSV/TSV/semicolon-separated),
 *                                   delimiter auto-detected from the header line
 */
export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  if (isZipFile(bytes)) {
    return parseXlsx(buffer)
  }

  if (isLegacyOleFile(bytes)) {
    throw new Error(
      'This looks like a legacy .xls file (pre-2007 Excel format), which isn\'t supported. ' +
        'Re-save it as .xlsx or .csv and try again.',
    )
  }

  const text = decodeText(bytes)
  const { headerRow, rows } = parseDelimitedText(text)
  return { headerRow, rows }
}
