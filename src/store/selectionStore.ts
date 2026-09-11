import { create } from 'zustand'

interface SelectionState {
  selectedDriverId?: string
  selectDriver: (driverId: string | undefined) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedDriverId: undefined,
  selectDriver: (driverId) => set({ selectedDriverId: driverId }),
}))
