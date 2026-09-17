import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef } from 'react'
import { formatTime } from '../../lib/format'
import { buildMapStyle } from './mapStyle'
import { createGarageMarkerElement, createStopMarkerElement, createStopPopupContent } from './markers/markerFactory'
import { ensurePmtilesProtocolRegistered } from './pmtilesProtocol'
import type { DriverRoute } from './useDriverRoute'

ensurePmtilesProtocolRegistered()

// Continental US, used as the initial camera when there's nothing yet to fit bounds to.
const CONTINENTAL_US_CENTER: [number, number] = [-98.5, 39.5]
const CONTINENTAL_US_ZOOM = 3.3

const PMTILES_URL = import.meta.env.VITE_PMTILES_URL ?? `${window.location.origin}/tiles/region.pmtiles`

interface MapViewProps {
  route: DriverRoute | undefined
}

export function MapView({ route }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])

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
      bounds.extend([stop.geo.lng, stop.geo.lat])
      hasPoints = true
    }

    if (hasPoints) {
      map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 500 })
    }
  }, [route])

  return <div ref={containerRef} className="h-[600px] w-full rounded-lg border border-gray-200" />
}
