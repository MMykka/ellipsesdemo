import { useEffect, useState } from 'react'
import { AddressGeocodeControl } from '../geocoding/AddressGeocodeControl'
import { useDriversStore } from '../../store/driversStore'
import type { Driver } from '../../types/driver'
import type { Address, GeoPoint } from '../../types/trip'

function emptyAddress(raw: string): Address {
  return { raw, geocodeStatus: raw ? 'pending' : 'skipped' }
}

interface DriverProfileFormProps {
  /** When set, the form edits this driver in place instead of creating a new one. */
  editingDriver?: Driver
  /** Called after a successful save, or Cancel, while editing. */
  onDoneEditing?: () => void
}

export function DriverProfileForm({ editingDriver, onDoneEditing }: DriverProfileFormProps) {
  const addDriver = useDriversStore((s) => s.addDriver)
  const updateDriver = useDriversStore((s) => s.updateDriver)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [garageRaw, setGarageRaw] = useState('')
  const [garageAddress, setGarageAddress] = useState<Address>(emptyAddress(''))

  useEffect(() => {
    setName(editingDriver?.name ?? '')
    setPhone(editingDriver?.phone ?? '')
    setGarageRaw(editingDriver?.garageAddress.raw ?? '')
    setGarageAddress(editingDriver?.garageAddress ?? emptyAddress(''))
  }, [editingDriver])

  function handleGarageRawChange(value: string) {
    setGarageRaw(value)
    setGarageAddress(emptyAddress(value))
  }

  function handleResolve(label: string, geo: GeoPoint) {
    setGarageAddress({ raw: label, geo, geocodeStatus: 'resolved' })
  }

  function resetFields() {
    setName('')
    setPhone('')
    setGarageRaw('')
    setGarageAddress(emptyAddress(''))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    if (editingDriver) {
      updateDriver(editingDriver.id, {
        name: name.trim(),
        phone: phone.trim() || undefined,
        garageAddress,
      })
      onDoneEditing?.()
      return
    }

    addDriver({
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: phone.trim() || undefined,
      garageAddress,
      active: true,
    })
    resetFields()
  }

  function handleCancel() {
    resetFields()
    onDoneEditing?.()
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{editingDriver ? 'Edit Driver' : 'Add Driver'}</h3>
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
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {editingDriver ? 'Save Changes' : 'Add Driver'}
        </button>
        {editingDriver && (
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
