import { create } from 'zustand'
import { readJson, writeJson } from '../lib/storage/localStorage'
import type { Driver } from '../types/driver'

const STORAGE_KEY = 'nemt-dispatch:drivers'

interface DriversState {
  drivers: Driver[]
  addDriver: (driver: Driver) => void
  updateDriver: (id: string, patch: Partial<Driver>) => void
  removeDriver: (id: string) => void
}

function persist(drivers: Driver[]) {
  writeJson(STORAGE_KEY, drivers)
}

export const useDriversStore = create<DriversState>((set, get) => ({
  drivers: readJson<Driver[]>(STORAGE_KEY, []),

  addDriver: (driver) => {
    const drivers = [...get().drivers, driver]
    persist(drivers)
    set({ drivers })
  },

  updateDriver: (id, patch) => {
    const drivers = get().drivers.map((d) => (d.id === id ? { ...d, ...patch } : d))
    persist(drivers)
    set({ drivers })
  },

  removeDriver: (id) => {
    const drivers = get().drivers.filter((d) => d.id !== id)
    persist(drivers)
    set({ drivers })
  },
}))
