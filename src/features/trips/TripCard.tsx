import { classifyTiming } from '../../domain/feasibility/classifyTiming'
import { tripDisplayDateTime } from '../../domain/time/tripSortTime'
import { formatDateTime, formatMiles, formatTime } from '../../lib/format'
import { AddressGeocodeControl } from '../geocoding/AddressGeocodeControl'
import { useDriversStore } from '../../store/driversStore'
import { useTripsStore } from '../../store/tripsStore'
import type { Trip } from '../../types/trip'
import { StatusPill, TimingBadge, TripStatusBadge } from './StatusBadge'

export function TripCard({ trip }: { trip: Trip }) {
  const drivers = useDriversStore((s) => s.drivers)
  const setAddressGeo = useTripsStore((s) => s.setAddressGeo)
  const setAddressFailed = useTripsStore((s) => s.setAddressFailed)
  const assignDriver = useTripsStore((s) => s.assignDriver)

  const pickupTiming = classifyTiming(trip.pickup.onSceneAt, trip.pickup.requestedTime)
  const dropoffTiming = classifyTiming(trip.dropoff.finishedAt, trip.dropoff.apptTime)

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-blue-800">{trip.memberName}</h3>
          <p className="text-xs text-gray-500">
            {trip.id}
            {tripDisplayDateTime(trip) && <> · {formatDateTime(tripDisplayDateTime(trip))}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <TripStatusBadge status={trip.status} />
          {trip.spaceType && <StatusPill label={trip.spaceType} className="bg-gray-700 text-white" />}
          {trip.fundingSource && (
            <StatusPill label={trip.fundingSource} className="bg-purple-700 text-white" />
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-green-500" />
          <div className="flex-1">
            <p className="text-gray-800">{trip.pickup.address.raw || 'No pickup address'}</p>
            <p className="text-xs text-gray-500">
              {formatTime(trip.pickup.requestedTime)}
              {trip.pickup.onSceneAt && (
                <>
                  {' '}
                  · On scene {formatTime(trip.pickup.onSceneAt)}
                  {pickupTiming && <> <TimingBadge flag={pickupTiming} /></>}
                </>
              )}
            </p>
            <AddressGeocodeControl
              address={trip.pickup.address}
              onResolve={(label, geo) => setAddressGeo(trip.id, 'pickup', label, geo)}
              onFailed={() => setAddressFailed(trip.id, 'pickup')}
            />
          </div>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
          <div className="flex-1">
            <p className="text-gray-800">{trip.dropoff.address.raw || 'No dropoff address'}</p>
            <p className="text-xs text-gray-500">
              {formatTime(trip.dropoff.apptTime)}
              {trip.dropoff.finishedAt && (
                <>
                  {' '}
                  · Finished {formatTime(trip.dropoff.finishedAt)}
                  {dropoffTiming && <> <TimingBadge flag={dropoffTiming} /></>}
                </>
              )}
            </p>
            <AddressGeocodeControl
              address={trip.dropoff.address}
              onResolve={(label, geo) => setAddressGeo(trip.id, 'dropoff', label, geo)}
              onFailed={() => setAddressFailed(trip.id, 'dropoff')}
            />
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
        {trip.mileage !== undefined && <span>{formatMiles(trip.mileage)}</span>}
        {trip.phone1 && <span>{trip.phone1}</span>}
        {trip.phone2 && <span>{trip.phone2}</span>}
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-xs">
        <label className="text-gray-500">Driver:</label>
        <select
          value={trip.assignedDriverId ?? ''}
          onChange={(e) => assignDriver(trip.id, e.target.value || undefined)}
          className="rounded border border-gray-300 px-1.5 py-0.5 text-xs"
        >
          <option value="">
            {trip.driverName ? `Unassigned (imported: ${trip.driverName})` : 'Unassigned'}
          </option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {trip.notes && (
        <div className="mt-3 border-t border-gray-100 pt-2 text-xs text-gray-600">
          <span className="font-semibold">Notes: </span>
          {trip.notes}
        </div>
      )}
    </div>
  )
}
