export interface ParsedDelimitedText {
  headerRow: string[]
  rows: (string | null)[][]
}

const CANDIDATE_DELIMITERS = [',', ';', '\t'] as const

/** Picks whichever candidate delimiter appears most often in the header line. */
function detectDelimiter(firstLine: string): string {
  let best: string = ','
  let bestCount = -1
  for (const delimiter of CANDIDATE_DELIMITERS) {
    const count = firstLine.split(delimiter).length - 1
    if (count > bestCount) {
      best = delimiter
      bestCount = count
    }
  }
  return best
}

/** RFC 4180-style parse: quoted fields, "" as an escaped quote, embedded delimiters/newlines inside quotes. */
function parseRows(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let fieldStarted = false

  const pushField = () => {
    row.push(field)
    field = ''
    fieldStarted = false
  }
  const pushRow = () => {
    pushField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"' && field === '' && !fieldStarted) {
      inQuotes = true
      fieldStarted = true
      continue
    }
    if (char === delimiter) {
      pushField()
      continue
    }
    if (char === '\r') continue
    if (char === '\n') {
      pushRow()
      continue
    }
    field += char
    fieldStarted = true
  }

  // Trailing field/row with no final newline.
  if (field !== '' || row.length > 0) pushRow()

  return rows.filter((r) => !(r.length === 1 && r[0] === ''))
}

/** Turns a header cell into a stable label, filling blanks with "Column<n>" (matches the xlsx path). */
function headerLabel(value: string, columnIndex: number): string {
  const text = value.trim()
  return text || `Column${columnIndex}`
}

/**
 * Parses CSV/TSV (or other delimited text) content into the same shape parseWorkbook produces
 * for .xlsx files. Delimiter is auto-detected from the header line unless explicitly provided.
 */
export function parseDelimitedText(text: string, delimiter?: string): ParsedDelimitedText {
  // Strip a UTF-8 BOM if present — common in CSV exports from Windows/Excel.
  const content = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  const firstLineEnd = content.search(/\r\n|\r|\n/)
  const firstLine = firstLineEnd === -1 ? content : content.slice(0, firstLineEnd)
  const resolvedDelimiter = delimiter ?? detectDelimiter(firstLine)

  const allRows = parseRows(content, resolvedDelimiter)
  if (allRows.length === 0) {
    return { headerRow: [], rows: [] }
  }

  const [rawHeaderRow, ...rawRows] = allRows
  const columnCount = Math.max(rawHeaderRow.length, ...rawRows.map((r) => r.length), 0)

  const headerRow = Array.from({ length: columnCount }, (_, i) =>
    headerLabel(rawHeaderRow[i] ?? '', i + 1),
  )

  const rows = rawRows
    .filter((r) => r.some((cell) => cell.trim() !== ''))
    .map((r) => Array.from({ length: columnCount }, (_, i) => (r[i] ?? '').trim() || null))

  return { headerRow, rows }
}
