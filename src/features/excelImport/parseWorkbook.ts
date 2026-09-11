import ExcelJS from 'exceljs'

export interface ParsedWorkbook {
  headerRow: string[]
  /** Each row is an array aligned to headerRow, raw cell values (string | number | Date | null). */
  rows: unknown[][]
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

export async function parseWorkbook(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer()
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
