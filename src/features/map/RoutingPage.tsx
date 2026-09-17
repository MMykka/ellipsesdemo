import { useState } from 'react'
import { DispatchTable } from '../dispatchTable/DispatchTable'
import { DriverListPanel } from '../drivers/DriverListPanel'
import { DriverPicker } from '../drivers/DriverPicker'
import { DriverProfileForm } from '../drivers/DriverProfileForm'
import { useSelectionStore } from '../../store/selectionStore'
import { useTripsStore } from '../../store/tripsStore'
import { MapView } from './MapView'
import { TripAssignPanel } from './TripAssignPanel'
import { useDriverRoute } from './useDriverRoute'

export function RoutingPage() {
  const selectedDriverId = useSelectionStore((s) => s.selectedDriverId)
  const setPreviewTrip = useSelectionStore((s) => s.setPreviewTrip)
  const route = useDriverRoute(selectedDriverId)
  const previewTripName = useTripsStore((s) => s.trips.find((t) => t.id === route?.previewTripId)?.memberName)
  const [manageOpen, setManageOpen] = useState(false)

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-900">Routing</h1>
          <DriverPicker />
        </div>
        <button
          type="button"
          onClick={() => setManageOpen((v) => !v)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {manageOpen ? 'Hide driver setup' : 'Manage drivers'}
        </button>
      </div>

      {manageOpen && (
        <div className="mb-6 grid grid-cols-1 gap-6 rounded-lg border border-gray-200 bg-gray-50 p-4 lg:grid-cols-2">
          <DriverProfileForm />
          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-900">Drivers</h2>
            <DriverListPanel />
          </div>
        </div>
      )}

      <div className="flex items-start gap-4">
        <TripAssignPanel />
        <div className="min-w-0 flex-1">
          {!selectedDriverId || !route ? (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
              Select a driver above to see their assigned stops on the map.
            </div>
          ) : (
            <>
              {route.previewTripId && (
                <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span>
                    Previewing <strong>{previewTripName ?? 'this trip'}</strong> on this driver's route — nothing
                    is saved yet.
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewTrip(undefined)}
                    className="shrink-0 font-medium underline hover:no-underline"
                  >
                    Clear preview
                  </button>
                </div>
              )}
              <MapView route={route} />
            </>
          )}
        </div>
      </div>

      {/* Full-width below the trip list/map row (rather than sharing that row's cramped right
          column) so the table has room to show every column, the Unassign button included,
          without needing a horizontal scroll. */}
      {selectedDriverId && route && (
        <>
          <DispatchTable route={route} />
          <p className="mt-2 text-xs text-gray-400">
            Distance/time are estimates (straight-line distance, not real road routing — see
            docs/OFFLINE_SETUP.md). Drag rows to reorder the route; times recompute automatically.
          </p>
        </>
      )}
    </div>
  )
}
