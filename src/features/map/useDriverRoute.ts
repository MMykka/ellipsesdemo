import { useMemo } from 'react'
import { computeSequence } from '../../domain/feasibility/computeSequence'
import { useDriversStore } from '../../store/driversStore'
import { useSequenceOverrideStore } from '../../store/sequenceOverrideStore'
import { useTripsStore } from '../../store/tripsStore'
import type { SequencedStop } from '../../types/routing'
import { buildDriverStops } from './buildDriverStops'

export interface DriverRoute {
  driverId: string
  garageGeo?: { lat: number; lng: number }
  stops: SequencedStop[]
  reorder: (orderedStopKeys: string[]) => void
}

export function useDriverRoute(driverId: string | undefined): DriverRoute | undefined {
  const driver = useDriversStore((s) => (driverId ? s.drivers.find((d) => d.id === driverId) : undefined))
  const trips = useTripsStore((s) => s.trips)
  const manualOrder = useSequenceOverrideStore((s) => (driverId ? s.overrides[driverId] : undefined))
  const setOrder = useSequenceOverrideStore((s) => s.setOrder)

  return useMemo(() => {
    if (!driverId) return undefined

    const stops = buildDriverStops(trips, driverId, manualOrder)
    const sequenced = computeSequence(driver?.garageAddress.geo, stops, { shiftStart: new Date() })

    return {
      driverId,
      garageGeo: driver?.garageAddress.geo,
      stops: sequenced,
      reorder: (orderedStopKeys: string[]) => setOrder(driverId, orderedStopKeys),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shiftStart intentionally uses "now" at render time, not a dependency
  }, [driverId, driver, trips, manualOrder, setOrder])
}
