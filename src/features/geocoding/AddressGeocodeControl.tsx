import { useState } from 'react'
import { searchAddressCached } from '../../services/geocodeCache'
import type { GeocodeCandidate } from '../../services/geocodeClient'
import type { Address, GeoPoint } from '../../types/trip'
import { ManualPinPicker } from './ManualPinPicker'

interface AddressGeocodeControlProps {
  address: Address
  onResolve: (label: string, geo: GeoPoint) => void
  onFailed?: () => void
}

export function AddressGeocodeControl({ address, onResolve, onFailed }: AddressGeocodeControlProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [candidates, setCandidates] = useState<GeocodeCandidate[] | null>(null)
  const [query, setQuery] = useState(address.raw)
  const [pinning, setPinning] = useState(false)

  if (!address.raw) return null

  async function runSearch(q: string) {
    setLoading(true)
    setCandidates(null)
    const results = await searchAddressCached(q)
    setCandidates(results)
    setLoading(false)
    if (results.length === 0) onFailed?.()
  }

  function handleOpen() {
    setQuery(address.raw)
    setOpen(true)
    setPinning(false)
    void runSearch(address.raw)
  }

  function handlePick(label: string, geo: GeoPoint) {
    onResolve(label, geo)
    setOpen(false)
    setCandidates(null)
  }

  function handleManualPin(geo: GeoPoint) {
    onResolve(address.raw, geo)
    setOpen(false)
    setPinning(false)
    setCandidates(null)
  }

  const resolved = address.geocodeStatus === 'resolved'

  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={handleOpen}
        className={
          resolved
            ? 'text-xs text-gray-400 underline decoration-dotted hover:text-gray-600'
            : 'text-xs font-medium text-amber-700 underline decoration-dotted hover:text-amber-900'
        }
      >
        {resolved
          ? 'Not right? Fix match'
          : address.geocodeStatus === 'failed'
            ? 'No match — search again'
            : 'Needs address match'}
      </button>

      {open && (
        <div className="mt-1 rounded border border-gray-200 bg-gray-50 p-2 text-xs">
          {pinning ? (
            <>
              <ManualPinPicker
                initialCenter={candidates?.[0]?.geo}
                onConfirm={handleManualPin}
              />
              <button
                type="button"
                onClick={() => setPinning(false)}
                className="mt-1 text-gray-500 underline hover:text-gray-700"
              >
                Back to search
              </button>
            </>
          ) : (
            <>
              {/* A <form> here would be illegal HTML when this control renders inside
                  DriverProfileForm's own <form> (nested forms aren't allowed) — plain elements +
                  Enter-to-search instead. */}
              <div className="mb-1.5 flex gap-1">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void runSearch(query)
                    }
                  }}
                  className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs"
                  placeholder="Edit and re-search…"
                />
                <button
                  type="button"
                  onClick={() => void runSearch(query)}
                  className="shrink-0 rounded bg-gray-700 px-2 py-1 text-xs font-medium text-white hover:bg-gray-800"
                >
                  Search
                </button>
              </div>

              {loading && <p className="text-gray-500">Searching…</p>}
              {!loading && candidates && candidates.length === 0 && (
                <p className="text-gray-500">
                  No match found. Try dropping the unit/apartment number, search a cross street, or
                  drop a pin yourself on the map below.
                </p>
              )}
              {!loading && candidates && candidates.length > 0 && (
                <ul className="space-y-1">
                  {candidates.map((c, i) => (
                    <li key={i}>
                      <button
                        type="button"
                        onClick={() => handlePick(c.label, c.geo)}
                        className="w-full rounded px-1.5 py-1 text-left text-gray-700 hover:bg-blue-100"
                      >
                        {c.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!loading && (
                <p className="mt-1.5 border-t border-gray-200 pt-1.5 text-[11px] text-gray-400">
                  Searches send only this address text to geocoding.geo.census.gov (a free US
                  government service), falling back to OpenStreetMap's Nominatim if that finds no
                  match — never the member name, phone, or any other trip detail.
                </p>
              )}

              {!loading && (
                <button
                  type="button"
                  onClick={() => setPinning(true)}
                  className="mt-1.5 text-blue-700 underline hover:text-blue-900"
                >
                  None of these — pin it on the map myself
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
