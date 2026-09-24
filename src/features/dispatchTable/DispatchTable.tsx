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
import { useState } from 'react'
import { tripDisplayDateTime } from '../../domain/time/tripSortTime'
import { stopKey } from '../map/buildDriverStops'
import type { DriverRoute } from '../map/useDriverRoute'
import { formatDateTime, formatMiles } from '../../lib/format'
import { useDriversStore } from '../../store/driversStore'
import { useSelectionStore } from '../../store/selectionStore'
import { useTripsStore } from '../../store/tripsStore'
import { UnassignButton } from './AssignUnassignControls'
import { DISPATCH_TABLE_COLUMNS } from './columns'
import { exportDispatchTableToExcel } from './exportDispatchTable'
import type { SequencedStop } from '../../types/routing'

interface DispatchTableProps {
  route: DriverRoute
  /** Stop keys (see buildDriverStops#stopKey) whose pins are enlarged on the map — any number at
   * once, see MapView. */
  enlargedStopKeys?: Set<string>
  onToggleEnlarge?: (stopKey: string) => void
  /** Stop keys whose estimated travel legs are highlighted blue on the map — any number at once,
   * see MapView. */
  highlightedStopKeys?: Set<string>
  onToggleHighlight?: (stopKey: string) => void
}

export function DispatchTable({
  route,
  enlargedStopKeys,
  onToggleEnlarge,
  highlightedStopKeys,
  onToggleHighlight,
}: DispatchTableProps) {
  const trips = useTripsStore((s) => s.trips)
  const driverName = useDriversStore((s) => s.drivers.find((d) => d.id === route.driverId)?.name) ?? 'Driver'
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const [isExporting, setIsExporting] = useState(false)

  const assignedStopCount = route.stops.filter((s) => !s.isPreview).length

  async function handleExport() {
    setIsExporting(true)
    try {
      await exportDispatchTableToExcel(driverName, route.stops, trips)
    } finally {
      setIsExporting(false)
    }
  }

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
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-end">
        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={isExporting || assignedStopCount === 0}
          title="Export this driver's assigned stops as an Excel file"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {isExporting ? 'Exporting…' : 'Export to Excel'}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
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
                    isEnlarged={enlargedStopKeys?.has(stopKey(stop.tripId, stop.kind)) ?? false}
                    onToggleEnlarge={onToggleEnlarge}
                    isHighlighted={highlightedStopKeys?.has(stopKey(stop.tripId, stop.kind)) ?? false}
                    onToggleHighlight={onToggleHighlight}
                  />
                ))}
              </tbody>
            </SortableContext>
          </table>
        </DndContext>
      </div>
    </div>
  )
}

function DispatchRow({
  stop,
  trip,
  driverId,
  isEnlarged,
  onToggleEnlarge,
  isHighlighted,
  onToggleHighlight,
}: {
  stop: SequencedStop
  trip: ReturnType<typeof useTripsStore.getState>['trips'][number] | undefined
  driverId: string
  isEnlarged: boolean
  onToggleEnlarge?: (stopKey: string) => void
  isHighlighted: boolean
  onToggleHighlight?: (stopKey: string) => void
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

  function toggleEnlarge() {
    onToggleEnlarge?.(key)
  }

  function toggleHighlight() {
    onToggleHighlight?.(key)
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={
        stop.isPreview
          ? 'border-b border-amber-100 bg-amber-50 last:border-0'
          : `border-b border-gray-100 last:border-0 hover:bg-gray-50 ${
              isEnlarged || isHighlighted ? 'bg-blue-50' : ''
            }`
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
      <td className="px-3 py-2">
        <button
          type="button"
          onClick={toggleEnlarge}
          title="Grow this stop's pin on the map — useful when stops overlap"
          className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
            isEnlarged ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-200'
          }`}
        >
          {stop.sequenceNumber}
        </button>
      </td>
      <td className="px-3 py-2 text-gray-900">
        <button
          type="button"
          onClick={toggleHighlight}
          title="Highlight this stop's estimated travel leg on the map"
          className={`text-left hover:underline ${isHighlighted ? 'font-semibold text-blue-700' : ''}`}
        >
          {stop.memberName}
        </button>
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
      <td className="px-3 py-2 text-gray-600">
        {formatMiles(stop.travelMiles)} · {Math.round(stop.travelMinutes)} min
      </td>
      <td className="px-3 py-2 text-gray-600">{trip?.fundingSource || '—'}</td>
      <td className="max-w-[220px] truncate px-3 py-2 text-gray-600" title={address}>
        {address || '—'}
      </td>
      <td className="max-w-[220px] truncate px-3 py-2 text-gray-600" title={trip?.notes}>
        {trip?.notes || '—'}
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
