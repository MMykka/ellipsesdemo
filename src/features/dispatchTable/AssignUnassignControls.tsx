import { useTripsStore } from '../../store/tripsStore'

export function UnassignButton({ tripId }: { tripId: string }) {
  const assignDriver = useTripsStore((s) => s.assignDriver)

  return (
    <button
      type="button"
      onClick={() => assignDriver(tripId, undefined)}
      className="text-xs font-medium text-red-600 hover:text-red-800"
      title="Remove this trip from the driver's route"
    >
      Unassign
    </button>
  )
}
