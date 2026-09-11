import { Map as MapLibreMap, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState } from 'react'
import { buildMapStyle } from '../map/mapStyle'
import { ensurePmtilesProtocolRegistered } from '../map/pmtilesProtocol'
import type { GeoPoint } from '../../types/trip'

ensurePmtilesProtocolRegistered()

const PMTILES_URL = import.meta.env.VITE_PMTILES_URL ?? `${window.location.origin}/tiles/region.pmtiles`

// Fallback center when there's no better hint (Southern California, matching this tool's
// example operating region) — used only until the dispatcher pans/zooms to the right spot.
const DEFAULT_CENTER: [number, number] = [-116.8, 33.9]
const DEFAULT_ZOOM = 9

interface ManualPinPickerProps {
  initialCenter?: GeoPoint
  onConfirm: (geo: GeoPoint) => void
}

export function ManualPinPicker({ initialCenter, onConfirm }: ManualPinPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markerRef = useRef<Marker | null>(null)
  const [picked, setPicked] = useState<GeoPoint | undefined>(undefined)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: buildMapStyle(PMTILES_URL),
      center: initialCenter ? [initialCenter.lng, initialCenter.lat] : DEFAULT_CENTER,
      zoom: initialCenter ? 15 : DEFAULT_ZOOM,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.on('click', (e) => {
      const geo = { lat: e.lngLat.lat, lng: e.lngLat.lng }
      setPicked(geo)
      if (markerRef.current) {
        markerRef.current.setLngLat(e.lngLat)
      } else {
        markerRef.current = new Marker({ color: '#2563eb' }).setLngLat(e.lngLat).addTo(map)
      }
    })

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the first mount's initialCenter should seed the camera
  }, [])

  return (
    <div className="mt-1">
      <p className="mb-1 text-gray-500">Click the map to drop a pin at the right spot.</p>
      <div ref={containerRef} className="h-56 w-full rounded border border-gray-300" />
      <button
        type="button"
        disabled={!picked}
        onClick={() => picked && onConfirm(picked)}
        className="mt-1.5 w-full rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {picked ? `Use this location (${picked.lat.toFixed(5)}, ${picked.lng.toFixed(5)})` : 'Click the map first'}
      </button>
    </div>
  )
}
