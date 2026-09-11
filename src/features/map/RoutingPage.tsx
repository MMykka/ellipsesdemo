import { useState } from 'react'
import { DispatchTable } from '../dispatchTable/DispatchTable'
import { DriverListPanel } from '../drivers/DriverListPanel'
import { DriverPicker } from '../drivers/DriverPicker'
import { DriverProfileForm } from '../drivers/DriverProfileForm'
import { useSelectionStore } from '../../store/selectionStore'
import { MapView } from './MapView'
import { useDriverRoute } from './useDriverRoute'

export function RoutingPage() {
  const selectedDriverId = useSelectionStore((s) => s.selectedDriverId)
  const route = useDriverRoute(selectedDriverId)
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

      {!selectedDriverId || !route ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
          Select a driver above to see their assigned stops on the map.
        </div>
      ) : (
        <>
          <MapView route={route} />
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
