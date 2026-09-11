import { useDriversStore } from '../../store/driversStore'
import { useSelectionStore } from '../../store/selectionStore'

export function DriverPicker() {
  const drivers = useDriversStore((s) => s.drivers)
  const selectedDriverId = useSelectionStore((s) => s.selectedDriverId)
  const selectDriver = useSelectionStore((s) => s.selectDriver)

  return (
    <select
      data-testid="driver-picker"
      value={selectedDriverId ?? ''}
      onChange={(e) => selectDriver(e.target.value || undefined)}
      className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900"
    >
      <option value="">Select a driver…</option>
      {drivers.map((d) => (
        <option key={d.id} value={d.id}>
          {d.name}
        </option>
      ))}
    </select>
  )
}
