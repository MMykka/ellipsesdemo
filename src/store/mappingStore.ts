import { create } from 'zustand'
import { readJson, writeJson } from '../lib/storage/localStorage'
import type { ColumnMappingProfile } from '../types/columnMapping'

const STORAGE_KEY = 'nemt-dispatch:column-mapping-profiles'

interface MappingState {
  profiles: ColumnMappingProfile[]
  findByHeaderRow: (headerRow: string[]) => ColumnMappingProfile | undefined
  saveProfile: (profile: ColumnMappingProfile) => void
}

function persist(profiles: ColumnMappingProfile[]) {
  writeJson(STORAGE_KEY, profiles)
}

function signatureKey(headerRow: string[]) {
  return headerRow.join('␟')
}

export const useMappingStore = create<MappingState>((set, get) => ({
  profiles: readJson<ColumnMappingProfile[]>(STORAGE_KEY, []),

  findByHeaderRow: (headerRow) => {
    const key = signatureKey(headerRow)
    return get().profiles.find((p) => signatureKey(p.headerSignature) === key)
  },

  saveProfile: (profile) => {
    const others = get().profiles.filter((p) => p.id !== profile.id)
    const profiles = [...others, profile]
    persist(profiles)
    set({ profiles })
  },
}))
