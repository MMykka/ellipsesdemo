export type CanonicalField =
  | 'tripId'
  | 'memberName'
  | 'pickupAddress'
  | 'pickupTime'
  | 'dropoffAddress'
  | 'apptTime'
  | 'phone1'
  | 'phone2'
  | 'spaceType'
  | 'mileage'
  | 'driverName'
  | 'fundingSource'
  | 'notes'
  | 'status'
  | 'onSceneAt'
  | 'onboardAt'
  | 'finishedAt'
  | 'cancelledAt'
  | 'cancelledReason'
  | 'fare'
  | 'ignore'

export const CANONICAL_FIELDS: { value: CanonicalField; label: string }[] = [
  { value: 'tripId', label: 'Trip ID' },
  { value: 'memberName', label: 'Member Name' },
  { value: 'pickupAddress', label: 'Pickup Address' },
  { value: 'pickupTime', label: 'Pickup Time' },
  { value: 'dropoffAddress', label: 'Dropoff Address' },
  { value: 'apptTime', label: 'Appointment / Dropoff Time' },
  { value: 'phone1', label: 'Phone 1' },
  { value: 'phone2', label: 'Phone 2' },
  { value: 'spaceType', label: 'Space Type / Level of Service' },
  { value: 'mileage', label: 'Mileage' },
  { value: 'driverName', label: 'Driver Name' },
  { value: 'fundingSource', label: 'Funding Source' },
  { value: 'notes', label: 'Notes / Dispatch Notes' },
  { value: 'status', label: 'Status' },
  { value: 'onSceneAt', label: 'On Scene At' },
  { value: 'onboardAt', label: 'Member Onboard At' },
  { value: 'finishedAt', label: 'Finished At' },
  { value: 'cancelledAt', label: 'Cancelled At' },
  { value: 'cancelledReason', label: 'Cancelled Reason' },
  { value: 'fare', label: 'Fare' },
  { value: 'ignore', label: '— Ignore this column —' },
]

export type LegGroup = 'A' | 'B' | 'shared'

export interface FieldMappingEntry {
  rawColumnKey: string
  rawColumnLabel: string
  canonicalField: CanonicalField
  legGroup: LegGroup
}

export interface ColumnMappingProfile {
  id: string
  headerSignature: string[]
  fields: FieldMappingEntry[]
  hasTwoLegGroups: boolean
  createdAt: string
  lastUsedAt: string
}
