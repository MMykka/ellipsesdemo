import { create } from 'zustand'

interface SelectionState {
  selectedDriverId?: string
  selectDriver: (driverId: string | undefined) => void
  /** Trip being previewed on the selected driver's route without actually being assigned. */
  previewTripId?: string
  setPreviewTrip: (tripId: string | undefined) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedDriverId: undefined,
  selectDriver: (driverId) => set({ selectedDriverId: driverId, previewTripId: undefined }),
  previewTripId: undefined,
  setPreviewTrip: (tripId) => set({ previewTripId: tripId }),
}))
