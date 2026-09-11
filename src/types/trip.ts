export type TripLeg = 'A' | 'B'

export type TripStatus =
  | 'Scheduled'
  | 'Assigned'
  | 'EnRoute'
  | 'OnScene'
  | 'Onboard'
  | 'Finished'
  | 'Cancelled'
  | 'NoShow'

export interface GeoPoint {
  lat: number
  lng: number
}

export type GeocodeStatus = 'pending' | 'resolved' | 'failed' | 'skipped'

export interface Address {
  raw: string
  geo?: GeoPoint
  geocodeStatus: GeocodeStatus
}

export interface TripPickup {
  address: Address
  requestedTime?: string
  onSceneAt?: string
  onboardAt?: string
}

export interface TripDropoff {
  address: Address
  apptTime?: string
  finishedAt?: string
}

export interface Trip {
  id: string
  tripId: string
  leg: TripLeg
  linkedTripRecordId?: string
  memberName: string
  phone1?: string
  phone2?: string
  pickup: TripPickup
  dropoff: TripDropoff
  spaceType: string
  mileage?: number
  fare?: number
  driverName?: string
  assignedDriverId?: string
  fundingSource?: string
  notes?: string
  status: TripStatus
  cancelledAt?: string
  cancelledReason?: string
  sourceRowIndex: number
  importedAt: string
}
