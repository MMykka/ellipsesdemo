import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { tripDisplayDateTime } from '../../domain/time/tripSortTime'
import { stopKey } from '../map/buildDriverStops'
import type { DriverRoute } from '../map/useDriverRoute'
import { formatDateTime, formatMiles, formatTime } from '../../lib/format'
import { useSelectionStore } from '../../store/selectionStore'
import { useTripsStore } from '../../store/tripsStore'
import { TimingBadge, type TimingFlag } from '../trips/StatusBadge'
import { UnassignButton } from './AssignUnassignControls'
import { DISPATCH_TABLE_COLUMNS } from './columns'
import type { SequencedStop } from '../../types/routing'

interface DispatchTableProps {
  route: DriverRoute
}

export function DispatchTable({ route }: DispatchTableProps) {
  const trips = useTripsStore((s) => s.trips)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  if (route.stops.length === 0) {
    return (
      <div className="mt-4 rounded-lg border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
        No trips assigned to this driver yet. Assign one from its card on the Trips page.
      </div>
    )
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const keys = route.stops.map((s) => stopKey(s.tripId, s.kind))
    const oldIndex = keys.indexOf(String(active.id))
    const newIndex = keys.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = [...keys]
    reordered.splice(oldIndex, 1)
    reordered.splice(newIndex, 0, String(active.id))
    route.reorder(reordered)
  }

  const items = route.stops.map((s) => stopKey(s.tripId, s.kind))

  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
      {/* DndContext injects a non-table accessibility element, so it must wrap the whole table
          rather than live inside it (a <div> is not valid inside <table>/<thead>/<tbody>). */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <table className="w-full min-w-[1100px] text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50 text-gray-500">
            <tr>
              {DISPATCH_TABLE_COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-2 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <tbody>
              {route.stops.map((stop) => (
                <DispatchRow
                  key={stopKey(stop.tripId, stop.kind)}
                  stop={stop}
                  trip={trips.find((t) => t.id === stop.tripId)}
                  driverId={route.driverId}
                />
              ))}
            </tbody>
          </SortableContext>
        </table>
      </DndContext>
    </div>
  )
}

function DispatchRow({
  stop,
  trip,
  driverId,
}: {
  stop: SequencedStop
  trip: ReturnType<typeof useTripsStore.getState>['trips'][number] | undefined
  driverId: string
}) {
  const key = stopKey(stop.tripId, stop.kind)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: key,
    disabled: stop.isPreview,
  })
  const assignDriver = useTripsStore((s) => s.assignDriver)
  const setPreviewTrip = useSelectionStore((s) => s.setPreviewTrip)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const address = trip ? (stop.kind === 'pickup' ? trip.pickup.address.raw : trip.dropoff.address.raw) : ''

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={
        stop.isPreview
          ? 'border-b border-amber-100 bg-amber-50 last:border-0'
          : 'border-b border-gray-100 last:border-0 hover:bg-gray-50'
      }
    >
      <td className="px-3 py-2 text-gray-400">
        {stop.isPreview ? (
          <span title="Assign this trip to enable reordering">⠿</span>
        ) : (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none px-1 active:cursor-grabbing"
            title="Drag to reorder"
          >
            ⠿
          </button>
        )}
      </td>
      <td className="px-3 py-2 font-semibold text-gray-700">{stop.sequenceNumber}</td>
      <td className="px-3 py-2 text-gray-900">
        {stop.memberName}
        {stop.isPreview && (
          <span className="ml-2 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
            Preview
          </span>
        )}
      </td>
      <td className="px-3 py-2 text-gray-600">
        {trip ? formatDateTime(tripDisplayDateTime(trip)) : '—'}
      </td>
      <td className="px-3 py-2">
        <span
          className={
            stop.kind === 'pickup' ? 'font-medium text-green-700' : 'font-medium text-red-700'
          }
        >
          {stop.kind === 'pickup' ? 'Pickup' : 'Dropoff'}
        </span>
      </td>
      <td className="px-3 py-2 text-gray-600">{stop.spaceType || '—'}</td>
      <td className="px-3 py-2 text-gray-600">{formatTime(stop.targetTime)}</td>
      <td className="px-3 py-2 text-gray-600">{formatTime(stop.arriveTime)}</td>
      <td className="px-3 py-2">
        {stop.status === 'Unknown' ? (
          <span className="text-gray-400">—</span>
        ) : (
          <TimingBadge flag={stop.status as TimingFlag} />
        )}
      </td>
      <td className="px-3 py-2 text-gray-600">
        {formatMiles(stop.travelMiles)} · {Math.round(stop.travelMinutes)} min
      </td>
      <td className="px-3 py-2 text-gray-600">{formatMiles(stop.arriveDistanceMiles)}</td>
      <td className="px-3 py-2 text-gray-600">{stop.loadUnloadMinutes} min</td>
      <td className="px-3 py-2 text-gray-600">{trip?.fundingSource || '—'}</td>
      <td className="px-3 py-2 text-gray-600">{trip?.phone1 || '—'}</td>
      <td className="max-w-[220px] truncate px-3 py-2 text-gray-600" title={address}>
        {address || '—'}
      </td>
      <td className="px-3 py-2">
        {stop.isPreview ? (
          <button
            type="button"
            onClick={() => {
              assignDriver(stop.tripId, driverId)
              setPreviewTrip(undefined)
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
            title="Assign this trip to the driver"
          >
            Assign
          </button>
        ) : (
          <UnassignButton tripId={stop.tripId} />
        )}
      </td>
    </tr>
  )
}
