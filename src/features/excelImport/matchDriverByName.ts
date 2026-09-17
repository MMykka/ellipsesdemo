import type { Driver } from '../../types/driver'

function normalize(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * Finds the roster driver whose name matches (case/whitespace-insensitive) the driver name from an
 * imported trip's "Driver Name" column, so a trip that was already assigned to a driver in the
 * source export lands on that same driver here instead of showing up unassigned. Returns undefined
 * (leaving the trip unassigned) when there's no name, or no roster driver matches it.
 */
export function matchDriverByName(driverName: string | undefined, drivers: Driver[]): string | undefined {
  if (!driverName) return undefined
  const target = normalize(driverName)
  return drivers.find((d) => normalize(d.name) === target)?.id
}
