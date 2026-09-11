import { useState } from 'react'
import { useTripsStore } from '../../store/tripsStore'
import { geocodeAllPending, type GeocodeAllResult } from './geocodeAllPending'

export function GeocodeAllButton() {
  const trips = useTripsStore((s) => s.trips)
  const setAddressGeo = useTripsStore((s) => s.setAddressGeo)
  const setAddressFailed = useTripsStore((s) => s.setAddressFailed)
  const [running, setRunning] = useState(false)
  const [lastResult, setLastResult] = useState<GeocodeAllResult | null>(null)

  const pendingCount = trips.reduce((n, t) => {
    return (
      n +
      (t.pickup.address.geocodeStatus === 'pending' ? 1 : 0) +
      (t.dropoff.address.geocodeStatus === 'pending' ? 1 : 0)
    )
  }, 0)

  async function handleClick() {
    setRunning(true)
    setLastResult(null)
    const result = await geocodeAllPending(trips, { setAddressGeo, setAddressFailed })
    setLastResult(result)
    setRunning(false)
  }

  if (trips.length === 0) return null

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={running || pendingCount === 0}
        className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {running ? 'Geocoding…' : `Geocode All${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
      </button>
      {lastResult && (
        <span className="text-xs text-gray-500">
          {lastResult.resolved} resolved
          {lastResult.bestGuess > 0 ? `, ${lastResult.bestGuess} best guess (check these)` : ''}
          {lastResult.failed > 0 ? `, ${lastResult.failed} still no match — fix on the card` : ''}
        </span>
      )}
    </div>
  )
}
