import { useTripsStore } from '../../store/tripsStore'
import { ExcelImportButton } from '../excelImport/ExcelImportButton'
import { GeocodeAllButton } from '../geocoding/GeocodeAllButton'
import { TripCard } from './TripCard'

export function TripsPage() {
  const trips = useTripsStore((s) => s.trips)
  const lastImportedAt = useTripsStore((s) => s.lastImportedAt)
  const clear = useTripsStore((s) => s.clear)

  return (
    <div className="mx-auto max-w-7xl px-6 py-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Trips</h1>
          <p className="text-sm text-gray-500">
            {trips.length > 0
              ? `${trips.length} trip${trips.length === 1 ? '' : 's'} imported${
                  lastImportedAt ? ` at ${new Date(lastImportedAt).toLocaleTimeString()}` : ''
                }`
              : 'Import a daily Excel export to get started.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExcelImportButton />
          <GeocodeAllButton />
          {trips.length > 0 && (
            <button
              type="button"
              onClick={clear}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {trips.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-12 text-center text-gray-400">
          No trips yet. Click "Import Excel" to load today's schedule.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  )
}
