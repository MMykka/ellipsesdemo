import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import { formatTime } from '../../lib/format'
import { fetchRoadRouteCached } from '../../services/routingCache'
import { stopKey } from './buildDriverStops'
import { buildMapStyle } from './mapStyle'
import {
  createGarageMarkerElement,
  createStopMarkerElement,
  createStopPopupContent,
  setStopMarkerEnlarged,
} from './markers/markerFactory'
import { ensurePmtilesProtocolRegistered } from './pmtilesProtocol'
import type { DriverRoute } from './useDriverRoute'

ensurePmtilesProtocolRegistered()

// Continental US, used as the initial camera when there's nothing yet to fit bounds to.
const CONTINENTAL_US_CENTER: [number, number] = [-98.5, 39.5]
const CONTINENTAL_US_ZOOM = 3.3

const PMTILES_URL = import.meta.env.VITE_PMTILES_URL ?? `${window.location.origin}/tiles/region.pmtiles`

// Two layers rather than one: a leg whose real road route hasn't resolved yet (or failed) renders
// dashed on one source, a resolved one renders solid on the other — lets several legs be
// highlighted at once, each independently upgrading in place as its own OSRM lookup resolves.
const HIGHLIGHT_STRAIGHT_SOURCE_ID = 'highlighted-legs-straight'
const HIGHLIGHT_STRAIGHT_LAYER_ID = 'highlighted-legs-straight-layer'
const HIGHLIGHT_ROAD_SOURCE_ID = 'highlighted-legs-road'
const HIGHLIGHT_ROAD_LAYER_ID = 'highlighted-legs-road-layer'

interface LegLineFeature {
  type: 'Feature'
  properties: Record<string, never>
  geometry: { type: 'LineString'; coordinates: [number, number][] }
}

interface MapViewProps {
  route: DriverRoute | undefined
  /** Stop keys (see buildDriverStops#stopKey) whose pins should render enlarged — any number can
   * be enlarged at once, toggled by clicking a stop's # in the dispatch table, independent of
   * highlightedStopKeys. */
  enlargedStopKeys?: Set<string>
  /** Stop keys whose estimated travel leg (from the previous point) draws as a blue line — any
   * number can be highlighted at once, toggled by clicking a stop's name in the dispatch table,
   * independent of enlargedStopKeys. */
  highlightedStopKeys?: Set<string>
}

export function MapView({ route, enlargedStopKeys, highlightedStopKeys }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const stopMarkersRef = useRef<Map<string, Marker>>(new Map())
  // Per-leg render state, keyed by the destination stop's key — persists across effect runs so a
  // leg already upgraded to a real road route doesn't revert to a straight line just because a
  // sibling leg was toggled on/off.
  const legStateRef = useRef<Map<string, { coordinates: [number, number][]; isRoadRoute: boolean }>>(new Map())

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    mapRef.current = new MapLibreMap({
      container: containerRef.current,
      style: buildMapStyle(PMTILES_URL),
      center: CONTINENTAL_US_CENTER,
      zoom: CONTINENTAL_US_ZOOM,
      attributionControl: { compact: true },
    })
    mapRef.current.addControl(new NavigationControl(), 'top-right')
    mapRef.current.on('error', (e) => console.error('MapLibre error:', e.error))

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    for (const marker of markersRef.current) marker.remove()
    markersRef.current = []
    stopMarkersRef.current = new Map()

    if (!route) return

    const bounds = new LngLatBounds()
    let hasPoints = false

    if (route.garageGeo) {
      const marker = new Marker({ element: createGarageMarkerElement() })
        .setLngLat([route.garageGeo.lng, route.garageGeo.lat])
        .addTo(map)
      markersRef.current.push(marker)
      bounds.extend([route.garageGeo.lng, route.garageGeo.lat])
      hasPoints = true
    }

    for (const stop of route.stops) {
      const marker = new Marker({
        element: createStopMarkerElement(stop.sequenceNumber, stop.kind, stop.isPreview),
      })
        .setLngLat([stop.geo.lng, stop.geo.lat])
        .setPopup(
          new Popup({ offset: 16 }).setDOMContent(
            createStopPopupContent({
              sequenceNumber: stop.sequenceNumber,
              kind: stop.kind,
              memberName: stop.memberName,
              arriveTimeLabel: formatTime(stop.arriveTime),
              status: stop.status,
              isPreview: stop.isPreview,
            }),
          ),
        )
        .addTo(map)
      markersRef.current.push(marker)
      stopMarkersRef.current.set(stopKey(stop.tripId, stop.kind), marker)
      bounds.extend([stop.geo.lng, stop.geo.lat])
      hasPoints = true
    }

    if (hasPoints) {
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 500 })
    }
  }, [route])

  // Grows every enlarged stop's pin (any number at once) — independent of the travel-line
  // highlight below. Also re-runs on `route` changes (e.g. a drag reorder rebuilds markers from
  // scratch) so enlarged pins don't silently reset to normal size.
  useEffect(() => {
    for (const [key, marker] of stopMarkersRef.current) {
      setStopMarkerEnlarged(marker.getElement(), enlargedStopKeys?.has(key) ?? false)
    }
  }, [route, enlargedStopKeys])

  // Draws the path connecting the selected stops, in blue: selecting two or more stops (any number,
  // any position — the garage is never a selectable endpoint) connects them pairwise in route order,
  // so selecting stops 1 and 3 (skipping 2) draws one direct leg from 1 to 3, while selecting 1, 2,
  // and 3 draws two legs (1-2 and 2-3). Each leg renders as a straight-line estimate immediately
  // (for instant feedback), then upgrades in place to its actual road path as OSRM's free public
  // routing demo (router.project-osrm.org — no API key, coordinates only, see routingClient.ts)
  // resolves it — independently per leg, so one leg's lookup finishing doesn't wait on another's.
  // Falls back to the straight line if a lookup fails; nothing else in the app (ETAs, feasibility
  // status, export) depends on this — it's a map visual aid only.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    let cancelled = false

    const setLayer = (sourceId: string, layerId: string, features: LegLineFeature[], dashed: boolean) => {
      if (map.getLayer(layerId)) map.removeLayer(layerId)
      if (map.getSource(sourceId)) map.removeSource(sourceId)
      if (features.length === 0) return

      map.addSource(sourceId, { type: 'geojson', data: { type: 'FeatureCollection', features } })
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
          'line-color': '#2563eb',
          'line-width': 4,
          ...(dashed ? { 'line-dasharray': [2, 1.5] } : {}),
        },
      })
    }

    const render = () => {
      const straightFeatures: LegLineFeature[] = []
      const roadFeatures: LegLineFeature[] = []
      for (const state of legStateRef.current.values()) {
        const feature: LegLineFeature = {
          type: 'Feature',
          properties: {},
          geometry: { type: 'LineString', coordinates: state.coordinates },
        }
        ;(state.isRoadRoute ? roadFeatures : straightFeatures).push(feature)
      }
      setLayer(HIGHLIGHT_STRAIGHT_SOURCE_ID, HIGHLIGHT_STRAIGHT_LAYER_ID, straightFeatures, true)
      setLayer(HIGHLIGHT_ROAD_SOURCE_ID, HIGHLIGHT_ROAD_LAYER_ID, roadFeatures, false)
    }

    // Pairs up the selected stops in route order (not click order), regardless of whether they're
    // physically adjacent — selecting non-adjacent stops draws a direct leg between just those two.
    // Keyed by both endpoints so a leg is correctly dropped/reseeded if which stop feeds into it
    // changes (e.g. deselecting stop 2 turns leg "2->3" into leg "1->3").
    const selectedLegs = () => {
      if (!route) return []
      const keys = highlightedStopKeys ?? new Set<string>()
      const selectedIndexes = route.stops
        .map((s, index) => ({ index, key: stopKey(s.tripId, s.kind) }))
        .filter(({ key }) => keys.has(key))
        .map(({ index }) => index)

      const legs: { legKey: string; fromGeo: (typeof route.stops)[number]['geo']; toGeo: (typeof route.stops)[number]['geo'] }[] = []
      for (let i = 1; i < selectedIndexes.length; i++) {
        const from = route.stops[selectedIndexes[i - 1]]
        const to = route.stops[selectedIndexes[i]]
        legs.push({
          legKey: `${stopKey(from.tripId, from.kind)}->${stopKey(to.tripId, to.kind)}`,
          fromGeo: from.geo,
          toGeo: to.geo,
        })
      }
      return legs
    }

    const run = async () => {
      const legs = selectedLegs()
      const activeLegKeys = new Set(legs.map((l) => l.legKey))

      // Drop state for legs no longer part of the current selection.
      for (const legKey of [...legStateRef.current.keys()]) {
        if (!activeLegKeys.has(legKey)) legStateRef.current.delete(legKey)
      }
      // Seed newly-selected legs with their straight-line estimate right away.
      for (const leg of legs) {
        if (legStateRef.current.has(leg.legKey)) continue
        legStateRef.current.set(leg.legKey, {
          coordinates: [
            [leg.fromGeo.lng, leg.fromGeo.lat],
            [leg.toGeo.lng, leg.toGeo.lat],
          ],
          isRoadRoute: false,
        })
      }
      render()

      // Upgrade each not-yet-resolved leg to its real road route independently.
      await Promise.all(
        legs.map(async (leg) => {
          const state = legStateRef.current.get(leg.legKey)
          if (!state || state.isRoadRoute) return
          const roadCoordinates = await fetchRoadRouteCached(leg.fromGeo, leg.toGeo)
          if (cancelled || !roadCoordinates) return
          legStateRef.current.set(leg.legKey, { coordinates: roadCoordinates, isRoadRoute: true })
          render()
        }),
      )
    }

    if (map.isStyleLoaded()) void run()
    else map.once('load', () => void run())

    return () => {
      cancelled = true
    }
  }, [route, highlightedStopKeys])

  return <div ref={containerRef} className="h-[600px] w-full rounded-lg border border-gray-200" />
}
