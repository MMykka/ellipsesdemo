import { useRef, useState } from 'react'
import { fnv1aHash } from '../../lib/hash'
import { geocodeAllPending } from '../geocoding/geocodeAllPending'
import { useDriversStore } from '../../store/driversStore'
import { useMappingStore } from '../../store/mappingStore'
import { useTripsStore } from '../../store/tripsStore'
import type { ColumnMappingProfile, FieldMappingEntry } from '../../types/columnMapping'
import type { Trip } from '../../types/trip'
import { applyMapping } from './applyMapping'
import { ColumnMapperModal } from './ColumnMapperModal'
import { MAPPING_LOGIC_VERSION, suggestFieldMapping } from './legGroupDetection'
import { matchDriverByName } from './matchDriverByName'
import { parseWorkbook, type ParsedWorkbook } from './parseWorkbook'

interface PendingFile {
  fileName: string
  parsed: ParsedWorkbook
}

/** Unique per file within a batch, so two files that both lack a Trip ID column don't produce the
 * same row-position fallback id and silently overwrite each other's trips on import. */
function makeBatchTag(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}-`
}

export function ExcelImportButton() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<PendingFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [forceRemap, setForceRemap] = useState(false)

  const findByHeaderRow = useMappingStore((s) => s.findByHeaderRow)
  const saveProfile = useMappingStore((s) => s.saveProfile)
  const addTrips = useTripsStore((s) => s.addTrips)
  const setAddressGeo = useTripsStore((s) => s.setAddressGeo)
  const setAddressFailed = useTripsStore((s) => s.setAddressFailed)
  const drivers = useDriversStore((s) => s.drivers)

  // Remaining files still to process in the current batch — mutated directly rather than kept in
  // state since nothing needs to re-render off its contents, only off whether `pending` is set.
  const queueRef = useRef<File[]>([])
  const skipCachedProfileRef = useRef(false)
  const errorsRef = useRef<string[]>([])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length === 0) return

    queueRef.current = files
    skipCachedProfileRef.current = forceRemap
    setForceRemap(false)
    errorsRef.current = []
    setError(null)
    await runQueue()
  }

  /** Processes queued files one at a time until the queue is empty or a file needs manual column
   * mapping, in which case it stops and resumes from handleMappingConfirm/handleMappingCancel once
   * the dispatcher deals with that file's modal. */
  async function runQueue() {
    setIsParsing(true)
    try {
      while (queueRef.current.length > 0) {
        const file = queueRef.current.shift()!
        let parsed: ParsedWorkbook
        try {
          parsed = await parseWorkbook(file)
        } catch (err) {
          errorsRef.current.push(`${file.name}: ${err instanceof Error ? err.message : 'Failed to read that file.'}`)
          continue
        }
        if (parsed.rows.length === 0) {
          errorsRef.current.push(`${file.name}: No data rows found.`)
          continue
        }

        const cachedProfile = skipCachedProfileRef.current ? undefined : findByHeaderRow(parsed.headerRow)
        // A profile saved under an older mapping-logic version may map columns the old (buggy) way;
        // treat it as not cached so the mapper re-suggests fresh instead of silently reapplying it.
        const existingProfile =
          cachedProfile?.mappingVersion === MAPPING_LOGIC_VERSION ? cachedProfile : undefined
        if (existingProfile) {
          await importWithProfile(parsed, existingProfile)
        } else {
          setPending({ fileName: file.name, parsed })
          return
        }
      }
      finishQueue()
    } finally {
      setIsParsing(false)
    }
  }

  function finishQueue() {
    if (errorsRef.current.length > 0) setError(errorsRef.current.join(' '))
  }

  async function importWithProfile(parsed: ParsedWorkbook, profile: ColumnMappingProfile) {
    const rawTrips = applyMapping(parsed.rows, profile, new Date(), makeBatchTag())
    // The source export's "Driver Name" column often already carries an assignment — if it names
    // someone in our driver roster, land the trip on them here too instead of leaving it
    // unassigned and making the dispatcher redo work the export already did.
    const trips = rawTrips.map((trip) => ({
      ...trip,
      assignedDriverId: matchDriverByName(trip.driverName, drivers),
    }))
    addTrips(trips)
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
      id: fnv1aHash(pending.parsed.headerRow.join('␟')),
      headerSignature: pending.parsed.headerRow,
      fields,
      hasTwoLegGroups,
      createdAt: now,
      lastUsedAt: now,
      mappingVersion: MAPPING_LOGIC_VERSION,
    }
    await importWithProfile(pending.parsed, profile)
    setPending(null)
    await runQueue()
  }

  async function handleMappingCancel() {
    setPending(null)
    await runQueue()
  }

  const suggestion = pending ? suggestFieldMapping(pending.parsed.headerRow, pending.parsed.rows) : null
  const busy = isParsing || isGeocoding

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls,.csv,.tsv,.txt"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        title="Select one or more files to import — trips add to what's already imported, they don't replace it"
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isParsing ? 'Reading file…' : isGeocoding ? 'Locating addresses…' : 'Import File(s)'}
      </button>
      <button
        type="button"
        onClick={() => {
          setForceRemap(true)
          inputRef.current?.click()
        }}
        disabled={busy}
        className="ml-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        title="Re-select file(s) and choose column mappings again, even if this file layout was imported before"
      >
        Remap Columns…
      </button>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {pending && suggestion && (
        <ColumnMapperModal
          headerRow={pending.parsed.headerRow}
          initialFields={suggestion.fields}
          initialHasTwoLegGroups={suggestion.hasTwoLegGroups}
          onConfirm={handleMappingConfirm}
          onCancel={() => void handleMappingCancel()}
        />
      )}
    </>
  )
}
