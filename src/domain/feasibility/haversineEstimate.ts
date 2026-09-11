import type { GeoPoint } from '../../types/trip'

const EARTH_RADIUS_KM = 6371
const KM_TO_MILES = 0.621371

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

export function haversineDistanceKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const lat1 = toRadians(a.lat)
  const lat2 = toRadians(b.lat)

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

export interface TravelEstimateOptions {
  /** Straight-line distance is multiplied by this to approximate real road distance. */
  roadCurvatureFactor: number
  /** Assumed average driving speed, used to convert estimated road distance into time. */
  averageSpeedKmh: number
}

export const DEFAULT_TRAVEL_ESTIMATE_OPTIONS: TravelEstimateOptions = {
  roadCurvatureFactor: 1.3,
  averageSpeedKmh: 40,
}

export interface TravelEstimate {
  distanceMiles: number
  minutes: number
}

/**
 * Estimates road distance/time between two points without a real routing engine — a deliberate
 * trade-off to avoid the Docker dependency real routing (OSRM) would need. Straight-line distance
 * is inflated by a curvature factor to approximate actual road distance, then converted to time
 * via an assumed average speed. This is clearly an estimate, not a live routing result — least
 * accurate around water/mountains/highway-limited terrain — and is the one number in the dispatch
 * table dispatchers should sanity-check against local knowledge rather than trust blindly.
 */
export function estimateTravel(
  a: GeoPoint,
  b: GeoPoint,
  options: TravelEstimateOptions = DEFAULT_TRAVEL_ESTIMATE_OPTIONS,
): TravelEstimate {
  const straightLineKm = haversineDistanceKm(a, b)
  const roadKm = straightLineKm * options.roadCurvatureFactor
  const minutes = (roadKm / options.averageSpeedKmh) * 60
  return { distanceMiles: roadKm * KM_TO_MILES, minutes }
}
