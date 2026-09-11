import { useDriversStore } from '../../store/driversStore'

export function DriverListPanel() {
  const drivers = useDriversStore((s) => s.drivers)
  const removeDriver = useDriversStore((s) => s.removeDriver)

  if (drivers.length === 0) {
    return <p className="text-sm text-gray-400">No drivers added yet.</p>
  }

  return (
    <ul className="space-y-2">
      {drivers.map((driver) => (
        <li
          key={driver.id}
          className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
        >
          <div>
            <p className="text-sm font-semibold text-gray-900">{driver.name}</p>
            <p className="text-xs text-gray-500">{driver.phone}</p>
            <p className="text-xs text-gray-500">
              Garage: {driver.garageAddress.raw || 'Not set'}
              {driver.garageAddress.geocodeStatus !== 'resolved' && driver.garageAddress.raw && (
                <span className="ml-1 text-amber-600">(not located yet)</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => removeDriver(driver.id)}
            className="text-xs font-medium text-red-600 hover:text-red-800"
          >
            Remove
          </button>
        </li>
      ))}
    </ul>
  )
}
