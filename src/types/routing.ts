import type { GeoPoint, TripLeg } from './trip'
import type { TimingStatus } from '../domain/feasibility/classifyTiming'

export interface Stop {
  sequenceNumber: number
  tripId: string
  leg: TripLeg
  kind: 'pickup' | 'dropoff'
  memberName: string
  spaceType: string
  geo: GeoPoint
  targetTime?: string
}

export interface SequencedStop extends Stop {
  /** Estimated travel distance/time from the previous point (garage, or the prior stop). */
  travelMiles: number
  travelMinutes: number
  /** ISO timestamps computed by walking the route in order from the shift start. */
  arriveTime: string
  performStart: string
  performEnd: string
  /** Cumulative miles from the garage through this stop. */
  arriveDistanceMiles: number
  loadUnloadMinutes: number
  status: TimingStatus | 'Unknown'
}
