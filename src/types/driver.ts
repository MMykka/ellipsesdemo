import type { Address } from './trip'

export interface Driver {
  id: string
  name: string
  phone?: string
  garageAddress: Address
  active: boolean
}
