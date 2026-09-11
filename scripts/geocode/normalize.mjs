export function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Unit/apartment/suite designators: real-world addresses often carry these plus a unit number
// (e.g. "APT 5"), but our address index only has street-level housenumbers — an OSM address
// point/building rarely carries per-unit tagging. Left in, the unit number becomes a query token
// the index can never satisfy, so an otherwise-correct address matches zero candidates.
const UNIT_WORDS = new Set([
  'apt', 'apartment', 'unit', 'ste', 'suite', 'fl', 'floor', 'bldg', 'building', 'rm', 'room',
])

function stripUnitTokens(tokens) {
  const kept = []
  for (let i = 0; i < tokens.length; i++) {
    if (UNIT_WORDS.has(tokens[i])) {
      if (/^\d+$/.test(tokens[i + 1] ?? '')) i++ // also skip the unit number right after it
      continue
    }
    kept.push(tokens[i])
  }
  return kept
}

// Addresses frequently arrive with a trailing country name (e.g. "..., USA") that our
// region-scoped index has no tag for. Only strip from the *end* of the token list, so a
// legitimate "us"/"america" appearing mid-address (e.g. a street name) is left alone.
function stripTrailingCountry(tokens) {
  const result = [...tokens]
  if (result.length >= 2 && result[result.length - 2] === 'united' && result[result.length - 1] === 'states') {
    result.splice(-2, 2)
  } else if (result.length >= 1 && ['usa', 'america'].includes(result[result.length - 1])) {
    result.pop()
  }
  return result
}

/**
 * Builds an FTS5 MATCH expression from the query's tokens. Real-world input addresses routinely
 * carry a word our region-scoped index has no way to satisfy (a unit/apartment number, "USA", a
 * misspelling, an abbreviation the source data doesn't use) — requiring every token to match
 * (AND) means one stray word zeroes out an otherwise-correct address. So non-numeric tokens
 * (street words, city, state) are OR'd, letting bm25 ranking put addresses matching more of them
 * first. But purely-numeric tokens (the house number, and a zip code if present) are much
 * stronger discriminators than any single word — on a large real-world index (millions of rows),
 * OR-ing everything means a query almost always matches thousands of rows and nothing is ever
 * unambiguous, which defeats bulk auto-resolve. Numeric tokens are therefore required (AND); the
 * UI still always shows candidates for the dispatcher to confirm rather than auto-trusting a
 * single result, so this only sharpens precision — it doesn't remove the human check.
 */
export function toMatchExpression(query) {
  const rawTokens = normalize(query).split(' ').filter(Boolean)
  const tokens = stripTrailingCountry(stripUnitTokens(rawTokens))
  if (tokens.length === 0) return undefined

  const required = tokens.filter((t) => /^\d+$/.test(t))
  const optional = tokens.filter((t) => !/^\d+$/.test(t))

  const requiredExpr = required.map((t) => `${t}*`).join(' AND ')
  const optionalExpr = optional.map((t) => `${t.replace(/"/g, '')}*`).join(' OR ')

  if (requiredExpr && optionalExpr) return `${requiredExpr} AND (${optionalExpr})`
  return requiredExpr || optionalExpr
}
