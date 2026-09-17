import { useDriversStore } from '../../store/driversStore'

interface DriverListPanelProps {
  editingDriverId?: string
  onEdit?: (driverId: string) => void
}

export function DriverListPanel({ editingDriverId, onEdit }: DriverListPanelProps) {
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
          className={`flex items-center justify-between rounded-lg border p-3 ${
            driver.id === editingDriverId ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'
          }`}
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
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={() => onEdit?.(driver.id)}
              className="text-xs font-medium text-blue-600 hover:text-blue-800"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => removeDriver(driver.id)}
              className="text-xs font-medium text-red-600 hover:text-red-800"
            >
              Remove
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
