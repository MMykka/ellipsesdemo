import { useState } from 'react'
import { tripDisplayDateTime, tripSortTimestamp } from '../../domain/time/tripSortTime'
import { formatDateTime } from '../../lib/format'
import { useDriversStore } from '../../store/driversStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useTripsStore } from '../../store/tripsStore'

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="8.5" cy="8.5" r="5.5" stroke="currentColor" strokeWidth="1.6" />
      <line x1="17" y1="17" x2="13.1" y2="13.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/**
 * All imported trips, sorted by time, with a one-click "+" to assign a trip to whichever driver
 * is currently selected in the DriverPicker above, and a magnifying-glass button to preview the
 * trip on that driver's route (map + dispatch table) without actually assigning it. Lives on the
 * Routing page so a dispatcher can build a driver's route without leaving the map.
 */
export function TripAssignPanel() {
  const trips = useTripsStore((s) => s.trips)
  const assignDriver = useTripsStore((s) => s.assignDriver)
  const drivers = useDriversStore((s) => s.drivers)
  const selectedDriverId = useSelectionStore((s) => s.selectedDriverId)
  const previewTripId = useSelectionStore((s) => s.previewTripId)
  const setPreviewTrip = useSelectionStore((s) => s.setPreviewTrip)
  const [search, setSearch] = useState('')

  const selectedDriverName = drivers.find((d) => d.id === selectedDriverId)?.name
  const query = search.trim().toLowerCase()
  // Once a trip is assigned to a driver it belongs on that driver's route, not in this
  // pick-list — it reappears here automatically (this list is store-driven) if unassigned.
  const unassignedTrips = trips.filter((trip) => !trip.assignedDriverId)
  const sortedTrips = unassignedTrips
    .filter((trip) => !query || trip.memberName.toLowerCase().includes(query))
    .sort((a, b) => tripSortTimestamp(a) - tripSortTimestamp(b))

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-gray-900">All Trips</h2>
        <p className="text-xs text-gray-500">
          {selectedDriverId
            ? `Click 🔍 to preview on ${selectedDriverName ?? 'the selected driver'}, + to assign`
            : 'Select a driver above to enable assigning'}
        </p>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name…"
          className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
        />
      </div>
      <div className="max-h-[70vh] divide-y divide-gray-100 overflow-y-auto">
        {trips.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-gray-400">No trips imported yet.</p>
        )}
        {trips.length > 0 && unassignedTrips.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-gray-400">All imported trips are assigned.</p>
        )}
        {unassignedTrips.length > 0 && sortedTrips.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-gray-400">No trips match "{search}".</p>
        )}
        {sortedTrips.map((trip) => {
          const isPreviewed = previewTripId === trip.id

          return (
            <div
              key={trip.id}
              className={`flex items-center justify-between gap-2 px-3 py-2 ${isPreviewed ? 'bg-amber-50' : ''}`}
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-gray-800">{trip.memberName}</p>
                <p className="truncate text-xs text-gray-500">{formatDateTime(tripDisplayDateTime(trip))}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={!selectedDriverId}
                  onClick={() => setPreviewTrip(isPreviewed ? undefined : trip.id)}
                  title={
                    !selectedDriverId
                      ? 'Select a driver first'
                      : isPreviewed
                        ? 'Stop previewing'
                        : `Preview on ${selectedDriverName ?? 'this driver'} without assigning`
                  }
                  aria-pressed={isPreviewed}
                  className={`flex h-6 w-6 items-center justify-center rounded-full border text-sm leading-none disabled:opacity-30 disabled:hover:bg-transparent ${
                    isPreviewed
                      ? 'border-amber-400 bg-amber-100 text-amber-700 hover:bg-amber-200'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <SearchIcon />
                </button>
                <button
                  type="button"
                  disabled={!selectedDriverId}
                  onClick={() => {
                    if (!selectedDriverId) return
                    assignDriver(trip.id, selectedDriverId)
                    if (isPreviewed) setPreviewTrip(undefined)
                  }}
                  title={!selectedDriverId ? 'Select a driver first' : `Assign to ${selectedDriverName ?? 'this driver'}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-sm font-bold leading-none text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  +
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
