import { useState } from 'react'
import { AddressGeocodeControl } from '../geocoding/AddressGeocodeControl'
import { useDriversStore } from '../../store/driversStore'
import type { Address, GeoPoint } from '../../types/trip'

function emptyAddress(raw: string): Address {
  return { raw, geocodeStatus: raw ? 'pending' : 'skipped' }
}

export function DriverProfileForm() {
  const addDriver = useDriversStore((s) => s.addDriver)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [garageRaw, setGarageRaw] = useState('')
  const [garageAddress, setGarageAddress] = useState<Address>(emptyAddress(''))

  function handleGarageRawChange(value: string) {
    setGarageRaw(value)
    setGarageAddress(emptyAddress(value))
  }

  function handleResolve(label: string, geo: GeoPoint) {
    setGarageAddress({ raw: label, geo, geocodeStatus: 'resolved' })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    addDriver({
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: phone.trim() || undefined,
      garageAddress,
      active: true,
    })
    setName('')
    setPhone('')
    setGarageRaw('')
    setGarageAddress(emptyAddress(''))
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">Add Driver</h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-gray-600">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600">
          Phone
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="text-xs text-gray-600 sm:col-span-2">
          Garage Address
          <input
            value={garageRaw}
            onChange={(e) => handleGarageRawChange(e.target.value)}
            placeholder="Street address, City, State"
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <AddressGeocodeControl address={garageAddress} onResolve={handleResolve} />
          {garageAddress.geocodeStatus === 'resolved' && (
            <p className="mt-1 text-xs text-green-700">✓ Located: {garageAddress.raw}</p>
          )}
        </label>
      </div>
      <button
        type="submit"
        className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        Add Driver
      </button>
    </form>
  )
}
