import ExcelJS from 'exceljs'
import { tripDisplayDateTime } from '../../domain/time/tripSortTime'
import { formatDateTime, formatMiles } from '../../lib/format'
import type { SequencedStop } from '../../types/routing'
import type { Trip } from '../../types/trip'

/** Strips characters that are illegal (or awkward) in filenames on Windows/macOS/Linux. */
function sanitizeForFilename(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ') || 'Driver'
}

function exportDateStamp(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Exports a driver's assigned stops as an .xlsx file — the same columns shown in the dispatch
 * table (DISPATCH_TABLE_COLUMNS), plus the driver's name, since the file leaves the app and needs
 * to stand on its own. Preview stops (not actually assigned, see buildDriverStops) are excluded.
 */
export async function exportDispatchTableToExcel(
  driverName: string,
  stops: SequencedStop[],
  trips: Trip[],
): Promise<void> {
  const assignedStops = stops.filter((stop) => !stop.isPreview)

  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('Route')

  sheet.columns = [
    { header: '#', key: 'seq', width: 6 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Trip Date/Time', key: 'tripDateTime', width: 18 },
    { header: 'Stop', key: 'stop', width: 10 },
    { header: 'Space Type', key: 'spaceType', width: 12 },
    { header: 'Travel', key: 'travel', width: 18 },
    { header: 'Funding Source', key: 'fundingSource', width: 16 },
    { header: 'Address', key: 'address', width: 36 },
    { header: 'Notes', key: 'notes', width: 30 },
    { header: 'Driver', key: 'driver', width: 20 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const stop of assignedStops) {
    const trip = trips.find((t) => t.id === stop.tripId)
    const address = trip ? (stop.kind === 'pickup' ? trip.pickup.address.raw : trip.dropoff.address.raw) : ''

    sheet.addRow({
      seq: stop.sequenceNumber,
      name: stop.memberName,
      tripDateTime: trip ? formatDateTime(tripDisplayDateTime(trip)) : '—',
      stop: stop.kind === 'pickup' ? 'Pickup' : 'Dropoff',
      spaceType: stop.spaceType || '—',
      travel: `${formatMiles(stop.travelMiles)} · ${Math.round(stop.travelMinutes)} min`,
      fundingSource: trip?.fundingSource || '—',
      address: address || '—',
      notes: trip?.notes || '—',
      driver: driverName,
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${sanitizeForFilename(driverName)} ${exportDateStamp(new Date())} ROUTEDEMO.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
