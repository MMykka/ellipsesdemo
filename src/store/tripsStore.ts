import { create } from 'zustand'
import type { GeoPoint, Trip } from '../types/trip'

export type AddressSlot = 'pickup' | 'dropoff'

interface TripsState {
  trips: Trip[]
  lastImportedAt?: string
  replaceAll: (trips: Trip[]) => void
  updateTrip: (id: string, patch: Partial<Trip>) => void
  assignDriver: (tripId: string, driverId: string | undefined) => void
  setAddressGeo: (tripId: string, slot: AddressSlot, label: string, geo: GeoPoint) => void
  setAddressFailed: (tripId: string, slot: AddressSlot) => void
  clear: () => void
}

export const useTripsStore = create<TripsState>((set) => ({
  trips: [],
  lastImportedAt: undefined,

  replaceAll: (trips) => set({ trips, lastImportedAt: new Date().toISOString() }),

  updateTrip: (id, patch) =>
    set((state) => ({
      trips: state.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),

  assignDriver: (tripId, driverId) =>
    set((state) => ({
      trips: state.trips.map((t) => (t.id === tripId ? { ...t, assignedDriverId: driverId } : t)),
    })),

  setAddressGeo: (tripId, slot, label, geo) =>
    set((state) => ({
      trips: state.trips.map((t) => {
        if (t.id !== tripId) return t
        const address = { raw: label, geo, geocodeStatus: 'resolved' as const }
        return slot === 'pickup'
          ? { ...t, pickup: { ...t.pickup, address } }
          : { ...t, dropoff: { ...t.dropoff, address } }
      }),
    })),

  setAddressFailed: (tripId, slot) =>
    set((state) => ({
      trips: state.trips.map((t) => {
        if (t.id !== tripId) return t
        const failed = { ...t[slot].address, geocodeStatus: 'failed' as const }
        return slot === 'pickup'
          ? { ...t, pickup: { ...t.pickup, address: failed } }
          : { ...t, dropoff: { ...t.dropoff, address: failed } }
      }),
    })),

  clear: () => set({ trips: [], lastImportedAt: undefined }),
}))
