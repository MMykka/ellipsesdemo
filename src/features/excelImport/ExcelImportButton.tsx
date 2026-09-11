import { useRef, useState } from 'react'
import { fnv1aHash } from '../../lib/hash'
import { geocodeAllPending } from '../geocoding/geocodeAllPending'
import { useMappingStore } from '../../store/mappingStore'
import { useTripsStore } from '../../store/tripsStore'
import type { ColumnMappingProfile, FieldMappingEntry } from '../../types/columnMapping'
import type { Trip } from '../../types/trip'
import { applyMapping } from './applyMapping'
import { ColumnMapperModal } from './ColumnMapperModal'
import { suggestFieldMapping } from './legGroupDetection'
import { parseWorkbook, type ParsedWorkbook } from './parseWorkbook'

export function ExcelImportButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<ParsedWorkbook | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)

  const findByHeaderRow = useMappingStore((s) => s.findByHeaderRow)
  const saveProfile = useMappingStore((s) => s.saveProfile)
  const replaceAll = useTripsStore((s) => s.replaceAll)
  const setAddressGeo = useTripsStore((s) => s.setAddressGeo)
  const setAddressFailed = useTripsStore((s) => s.setAddressFailed)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)
    setIsParsing(true)
    try {
      const parsed = await parseWorkbook(file)
      if (parsed.rows.length === 0) {
        setError('No data rows found in the first sheet of that file.')
        return
      }

      const existingProfile = findByHeaderRow(parsed.headerRow)
      if (existingProfile) {
        await importWithProfile(parsed, existingProfile)
      } else {
        setPending(parsed)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read that Excel file.')
    } finally {
      setIsParsing(false)
    }
  }

  async function importWithProfile(parsed: ParsedWorkbook, profile: ColumnMappingProfile) {
    const trips = applyMapping(parsed.rows, profile)
    replaceAll(trips)
    saveProfile({ ...profile, lastUsedAt: new Date().toISOString() })
    await autoGeocode(trips)
  }

  async function autoGeocode(trips: Trip[]) {
    setIsGeocoding(true)
    try {
      await geocodeAllPending(trips, { setAddressGeo, setAddressFailed })
    } finally {
      setIsGeocoding(false)
    }
  }

  async function handleMappingConfirm(fields: FieldMappingEntry[], hasTwoLegGroups: boolean) {
    if (!pending) return
    const now = new Date().toISOString()
    const profile: ColumnMappingProfile = {
      id: fnv1aHash(pending.headerRow.join('␟')),
      headerSignature: pending.headerRow,
      fields,
      hasTwoLegGroups,
      createdAt: now,
      lastUsedAt: now,
    }
    await importWithProfile(pending, profile)
    setPending(null)
  }

  const suggestion = pending ? suggestFieldMapping(pending.headerRow) : null
  const busy = isParsing || isGeocoding

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isParsing ? 'Reading file…' : isGeocoding ? 'Locating addresses…' : 'Import Excel'}
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {pending && suggestion && (
        <ColumnMapperModal
          headerRow={pending.headerRow}
          initialFields={suggestion.fields}
          initialHasTwoLegGroups={suggestion.hasTwoLegGroups}
          onConfirm={handleMappingConfirm}
          onCancel={() => setPending(null)}
        />
      )}
    </>
  )
}
