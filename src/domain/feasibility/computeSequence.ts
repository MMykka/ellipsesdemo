import type { GeoPoint } from '../../types/trip'
import type { SequencedStop, Stop } from '../../types/routing'
import { classifyTiming, DEFAULT_TIMING_THRESHOLDS, type TimingThresholds } from './classifyTiming'
import { DEFAULT_TRAVEL_ESTIMATE_OPTIONS, estimateTravel, type TravelEstimateOptions } from './haversineEstimate'

/** Load/unload minutes by space type — a driver's dwell time at a stop before/after service. */
export const DEFAULT_SERVICE_DURATION_BY_TYPE: Record<string, number> = {
  AMB: 3,
  Ambulatory: 3,
  WAV: 8,
  Wheelchair: 8,
  Stretcher: 10,
  Bariatric: 12,
}
const DEFAULT_SERVICE_MINUTES = 5

export interface ComputeSequenceOptions {
  shiftStart: Date
  serviceDurationByType?: Record<string, number>
  travelOptions?: TravelEstimateOptions
  timingThresholds?: TimingThresholds
}

/**
 * Walks a driver's stops in the given order, computing estimated travel time/distance from the
 * previous point (garage, or the prior stop), arrival time, service (load/unload) time, and a
 * Late/On Time/Early classification against each stop's target time. Pure function — the caller
 * controls stop order (default time-sorted, or a dispatcher's manual drag-to-reorder), and no
 * network calls are made (see haversineEstimate.ts for why).
 */
export function computeSequence(
  garageGeo: GeoPoint | undefined,
  stops: Stop[],
  options: ComputeSequenceOptions,
): SequencedStop[] {
  const serviceDurationByType = options.serviceDurationByType ?? DEFAULT_SERVICE_DURATION_BY_TYPE
  const travelOptions = options.travelOptions ?? DEFAULT_TRAVEL_ESTIMATE_OPTIONS
  const thresholds = options.timingThresholds ?? DEFAULT_TIMING_THRESHOLDS

  let currentTimeMs = options.shiftStart.getTime()
  let currentPoint = garageGeo
  let cumulativeMiles = 0

  const result: SequencedStop[] = []

  for (const stop of stops) {
    let travelMiles = 0
    let travelMinutes = 0
    if (currentPoint) {
      const estimate = estimateTravel(currentPoint, stop.geo, travelOptions)
      travelMiles = estimate.distanceMiles
      travelMinutes = estimate.minutes
    }

    const arriveMs = currentTimeMs + travelMinutes * 60_000
    const arriveDistanceMiles = cumulativeMiles + travelMiles

    // Pickups can't start before the requested time opens (the driver waits if early);
    // dropoffs just begin service on arrival.
    const earliestAllowedMs = stop.kind === 'pickup' && stop.targetTime ? new Date(stop.targetTime).getTime() : undefined
    const performStartMs = earliestAllowedMs ? Math.max(arriveMs, earliestAllowedMs) : arriveMs

    const loadUnloadMinutes = serviceDurationByType[stop.spaceType] ?? DEFAULT_SERVICE_MINUTES
    const performEndMs = performStartMs + loadUnloadMinutes * 60_000

    const status = classifyTiming(new Date(arriveMs), stop.targetTime, thresholds) ?? 'Unknown'

    result.push({
      ...stop,
      travelMiles,
      travelMinutes,
      arriveTime: new Date(arriveMs).toISOString(),
      performStart: new Date(performStartMs).toISOString(),
      performEnd: new Date(performEndMs).toISOString(),
      arriveDistanceMiles,
      loadUnloadMinutes,
      status,
    })

    currentTimeMs = performEndMs
    currentPoint = stop.geo
    cumulativeMiles = arriveDistanceMiles
  }

  return result
}
