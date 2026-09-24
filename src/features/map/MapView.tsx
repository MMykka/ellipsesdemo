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

  // Draws every highlighted stop's travel leg in blue, any number at once: each leg's straight-line
  // estimate immediately (for instant feedback), then upgraded in place to its actual road path as
  // OSRM's free public routing demo (router.project-osrm.org — no API key, coordinates only, see
  // routingClient.ts) resolves it — independently per leg, so one leg's lookup finishing doesn't
  // wait on another's. Falls back to the straight line if a lookup fails; nothing else in the app
  // (ETAs, feasibility status, export) depends on this — it's a map visual aid only.
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
      const keys = highlightedStopKeys ?? new Set<string>()
      const straightFeatures: LegLineFeature[] = []
      const roadFeatures: LegLineFeature[] = []
      for (const key of keys) {
        const state = legStateRef.current.get(key)
        if (!state) continue
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

    const legEndpoints = (key: string) => {
      if (!route) return undefined
      const index = route.stops.findIndex((s) => stopKey(s.tripId, s.kind) === key)
      if (index === -1) return undefined
      const fromGeo = index === 0 ? route.garageGeo : route.stops[index - 1].geo
      if (!fromGeo) return undefined
      return { fromGeo, toGeo: route.stops[index].geo }
    }

    const run = async () => {
      const keys = [...(highlightedStopKeys ?? [])]

      // Drop state for legs no longer selected.
      for (const key of [...legStateRef.current.keys()]) {
        if (!keys.includes(key)) legStateRef.current.delete(key)
      }
      // Seed newly-selected legs with their straight-line estimate right away.
      for (const key of keys) {
        if (legStateRef.current.has(key)) continue
        const endpoints = legEndpoints(key)
        if (!endpoints) continue
        legStateRef.current.set(key, {
          coordinates: [
            [endpoints.fromGeo.lng, endpoints.fromGeo.lat],
            [endpoints.toGeo.lng, endpoints.toGeo.lat],
          ],
          isRoadRoute: false,
        })
      }
      render()

      // Upgrade each not-yet-resolved leg to its real road route independently.
      await Promise.all(
        keys.map(async (key) => {
          const state = legStateRef.current.get(key)
          if (!state || state.isRoadRoute) return
          const endpoints = legEndpoints(key)
          if (!endpoints) return
          const roadCoordinates = await fetchRoadRouteCached(endpoints.fromGeo, endpoints.toGeo)
          if (cancelled || !roadCoordinates) return
          legStateRef.current.set(key, { coordinates: roadCoordinates, isRoadRoute: true })
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
