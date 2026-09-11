import { create } from 'zustand'

interface SequenceOverrideState {
  /** driverId -> ordered list of stop keys ("tripId:kind"), from dispatcher drag-to-reorder. */
  overrides: Record<string, string[]>
  setOrder: (driverId: string, orderedKeys: string[]) => void
  clearOrder: (driverId: string) => void
}

/** In-memory only, like trip data — resets on reload, never persisted. */
export const useSequenceOverrideStore = create<SequenceOverrideState>((set) => ({
  overrides: {},

  setOrder: (driverId, orderedKeys) =>
    set((state) => ({ overrides: { ...state.overrides, [driverId]: orderedKeys } })),

  clearOrder: (driverId) =>
    set((state) => {
      const { [driverId]: _removed, ...rest } = state.overrides
      return { overrides: rest }
    }),
}))
