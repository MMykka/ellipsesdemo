export type CanonicalField =
  | 'tripId'
  | 'memberName'
  | 'pickupAddress'
  | 'pickupTime'
  | 'tripDateTime'
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
  { value: 'tripDateTime', label: 'Trip Date/Time' },
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
  /**
   * Stamped with MAPPING_LOGIC_VERSION (legGroupDetection.ts) when the profile is saved. A
   * profile from an older version (or missing this field entirely, for profiles saved before it
   * existed) is never silently reused — see that constant's comment for why.
   */
  mappingVersion: number
}
