import { layers, LIGHT } from '@protomaps/basemaps'
import type { StyleSpecification } from 'maplibre-gl'

const SOURCE_NAME = 'basemap'

/**
 * Builds the MapLibre style for the offline regional PMTiles source. No `glyphs`/`sprite` URL is
 * configured — Protomaps' hosted glyph/sprite assets require internet access, which would break
 * full offline operation. Verified (see the map-tile smoke test) that maplibre-gl v6 still renders
 * text labels using local system fonts with no glyphs source configured, and issues zero external
 * network requests, so labels work offline for free; only custom sprite icons would need
 * self-hosting if a future style change actually needs them.
 */
export function buildMapStyle(pmtilesUrl: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      [SOURCE_NAME]: {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution:
          '<a href="https://protomaps.com">Protomaps</a> © <a href="https://openstreetmap.org">OpenStreetMap</a>',
      },
    },
    layers: layers(SOURCE_NAME, LIGHT, { lang: 'en' }),
  }
}
