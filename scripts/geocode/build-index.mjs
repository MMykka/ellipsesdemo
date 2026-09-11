#!/usr/bin/env node
/**
 * Builds a local SQLite address-search index from OSM address features, produced ahead of time
 * from a regional .osm.pbf extract via pbf2json (newline-delimited JSON) — or from a GeoJSON file,
 * also supported. See docs/OFFLINE_SETUP.md for the exact one-time commands.
 *
 * Usage: node scripts/geocode/build-index.mjs <input.jsonl|input.geojson> [output.sqlite]
 */
import Database from 'better-sqlite3'
import { createReadStream, existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { createInterface } from 'node:readline'
import { normalize } from './normalize.mjs'

const inputPath = process.argv[2]
const outputPath = process.argv[3] ?? 'offline-data/geocode-index.sqlite'

if (!inputPath) {
  console.error('Usage: node scripts/geocode/build-index.mjs <input.jsonl|input.geojson> [output.sqlite]')
  process.exit(1)
}

function centroidOfRing(ring) {
  let x = 0
  let y = 0
  for (const [lon, lat] of ring) {
    x += lon
    y += lat
  }
  return [x / ring.length, y / ring.length]
}

/** Returns [lon, lat] for a GeoJSON geometry, or undefined if it can't be reduced to a point. */
function pointFromGeoJsonGeometry(geometry) {
  if (!geometry) return undefined
  if (geometry.type === 'Point') return geometry.coordinates
  if (geometry.type === 'Polygon') return centroidOfRing(geometry.coordinates[0])
  if (geometry.type === 'MultiPolygon') return centroidOfRing(geometry.coordinates[0][0])
  return undefined
}

/**
 * Normalizes one parsed JSON line/object — either a GeoJSON Feature, or a pbf2json node/way
 * record — into a common { properties, point: [lon, lat] } shape, or undefined if it can't be
 * reduced to a usable point.
 */
function normalizeRecord(obj) {
  if (obj.type === 'Feature') {
    const point = pointFromGeoJsonGeometry(obj.geometry)
    if (!point) return undefined
    return { properties: obj.properties ?? {}, point }
  }

  // pbf2json node: { id, type: 'node', lat, lon, tags }
  if (obj.type === 'node' && obj.tags) {
    if (!Number.isFinite(obj.lat) || !Number.isFinite(obj.lon)) return undefined
    return { properties: obj.tags, point: [obj.lon, obj.lat] }
  }

  // pbf2json way: { id, type: 'way', tags, centroid: { lat, lon } (strings) }
  if (obj.type === 'way' && obj.tags) {
    const lat = Number(obj.centroid?.lat)
    const lon = Number(obj.centroid?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined
    return { properties: obj.tags, point: [lon, lat] }
  }

  return undefined
}

function buildLabel(props) {
  const parts = [
    [props['addr:housenumber'], props['addr:street']].filter(Boolean).join(' '),
    props['addr:unit'] ? `Unit ${props['addr:unit']}` : undefined,
    props['addr:city'],
    [props['addr:state'], props['addr:postcode']].filter(Boolean).join(' '),
  ].filter(Boolean)
  return parts.join(', ')
}

const dir = dirname(outputPath)
if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })

const db = new Database(outputPath)
db.pragma('journal_mode = WAL')

db.exec(`
  DROP TABLE IF EXISTS addresses;
  DROP TABLE IF EXISTS addresses_fts;

  CREATE TABLE addresses (
    id INTEGER PRIMARY KEY,
    housenumber TEXT,
    street TEXT,
    unit TEXT,
    city TEXT,
    state TEXT,
    postcode TEXT,
    label TEXT NOT NULL,
    lat REAL NOT NULL,
    lon REAL NOT NULL
  );

  CREATE VIRTUAL TABLE addresses_fts USING fts5(search_text, content='');
`)

const insertAddress = db.prepare(`
  INSERT INTO addresses (id, housenumber, street, unit, city, state, postcode, label, lat, lon)
  VALUES (@id, @housenumber, @street, @unit, @city, @state, @postcode, @label, @lat, @lon)
`)
const insertFts = db.prepare(`INSERT INTO addresses_fts (rowid, search_text) VALUES (?, ?)`)

const insertBatch = db.transaction((rows) => {
  for (const row of rows) {
    insertAddress.run(row)
    insertFts.run(row.id, normalize(row.label))
  }
})

// Both pbf2json output (one JSON object per line) and osmium's geojsonseq output are
// line-delimited. Fall back to whole-file JSON.parse for a single GeoJSON FeatureCollection.
async function* readRecords(path) {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }) })
  let buffer = ''
  let sawLine = false

  for await (const line of rl) {
    // eslint-disable-next-line no-control-regex -- stripping the RS (0x1e) separator used by geojsonseq
    const trimmed = line.trim().replace(/^\x1e/, '')
    if (!trimmed) continue
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const obj = JSON.parse(trimmed)
        const record = normalizeRecord(obj)
        if (record) {
          sawLine = true
          yield record
          continue
        }
        if (obj.type === 'Feature' || obj.type === 'node' || obj.type === 'way') {
          sawLine = true // recognized but unusable (e.g. no address point) — still not a parse failure
          continue
        }
      } catch {
        // not a standalone JSON line — fall through to whole-file buffering below
      }
    }
    buffer += line + '\n'
  }

  if (!sawLine && buffer.trim()) {
    const parsed = JSON.parse(buffer)
    const features = parsed.type === 'FeatureCollection' ? parsed.features : [parsed]
    for (const f of features) {
      const record = normalizeRecord(f)
      if (record) yield record
    }
  }
}

let id = 0
let kept = 0
let batch = []

for await (const { properties: props, point } of readRecords(inputPath)) {
  if (!props['addr:housenumber'] || !props['addr:street']) continue
  const [lon, lat] = point
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue

  id += 1
  batch.push({
    id,
    housenumber: props['addr:housenumber'],
    street: props['addr:street'],
    unit: props['addr:unit'] ?? null,
    city: props['addr:city'] ?? null,
    state: props['addr:state'] ?? null,
    postcode: props['addr:postcode'] ?? null,
    label: buildLabel(props),
    lat,
    lon,
  })
  kept += 1

  if (batch.length >= 5000) {
    insertBatch(batch)
    batch = []
  }
}
if (batch.length > 0) insertBatch(batch)

db.close()
console.log(`Indexed ${kept} addresses into ${outputPath}`)
