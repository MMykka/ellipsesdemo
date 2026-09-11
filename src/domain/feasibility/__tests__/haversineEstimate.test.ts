import { describe, expect, it } from 'vitest'
import { estimateTravel, haversineDistanceKm } from '../haversineEstimate'

describe('haversineDistanceKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineDistanceKm({ lat: 33.7, lng: -116.3 }, { lat: 33.7, lng: -116.3 })).toBe(0)
  })

  it('computes a known real-world distance within reasonable tolerance', () => {
    // LA City Hall to San Diego City Hall — great-circle distance is ~179 km
    const laCityHall = { lat: 34.0537, lng: -118.2428 }
    const sdCityHall = { lat: 32.7157, lng: -117.1611 }
    const km = haversineDistanceKm(laCityHall, sdCityHall)
    expect(km).toBeGreaterThan(170)
    expect(km).toBeLessThan(190)
  })

  it('is symmetric', () => {
    const a = { lat: 34.05, lng: -118.24 }
    const b = { lat: 33.72, lng: -116.37 }
    expect(haversineDistanceKm(a, b)).toBeCloseTo(haversineDistanceKm(b, a), 10)
  })
})

describe('estimateTravel', () => {
  it('returns zero for identical points', () => {
    const est = estimateTravel({ lat: 1, lng: 1 }, { lat: 1, lng: 1 })
    expect(est.distanceMiles).toBe(0)
    expect(est.minutes).toBe(0)
  })

  it('applies the road curvature factor and average speed to derive minutes', () => {
    const a = { lat: 33.7175, lng: -116.3739 }
    const b = { lat: 33.7206, lng: -116.2189 }
    const options = { roadCurvatureFactor: 1.5, averageSpeedKmh: 60 }
    const est = estimateTravel(a, b, options)

    const straightKm = haversineDistanceKm(a, b)
    const expectedMinutes = ((straightKm * 1.5) / 60) * 60
    expect(est.minutes).toBeCloseTo(expectedMinutes, 5)
    expect(est.distanceMiles).toBeGreaterThan(0)
  })

  it('a higher curvature factor or lower speed increases estimated minutes', () => {
    const a = { lat: 33.7175, lng: -116.3739 }
    const b = { lat: 34.0537, lng: -118.2428 }
    const base = estimateTravel(a, b, { roadCurvatureFactor: 1.3, averageSpeedKmh: 40 })
    const slower = estimateTravel(a, b, { roadCurvatureFactor: 1.3, averageSpeedKmh: 20 })
    const curvier = estimateTravel(a, b, { roadCurvatureFactor: 2.0, averageSpeedKmh: 40 })
    expect(slower.minutes).toBeGreaterThan(base.minutes)
    expect(curvier.minutes).toBeGreaterThan(base.minutes)
  })
})
