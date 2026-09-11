import clsx from 'clsx'
import type { TimingStatus } from '../../domain/feasibility/classifyTiming'

const STATUS_STYLES: Record<string, string> = {
  Finished: 'bg-blue-600 text-white',
  Assigned: 'bg-indigo-600 text-white',
  EnRoute: 'bg-amber-500 text-white',
  OnScene: 'bg-amber-600 text-white',
  Onboard: 'bg-amber-700 text-white',
  Cancelled: 'bg-red-600 text-white',
  NoShow: 'bg-red-500 text-white',
  Scheduled: 'bg-gray-500 text-white',
}

export function StatusPill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold',
        className ?? 'bg-gray-700 text-white',
      )}
    >
      {label}
    </span>
  )
}

export function TripStatusBadge({ status }: { status: string }) {
  return <StatusPill label={status} className={STATUS_STYLES[status] ?? 'bg-gray-700 text-white'} />
}

export type TimingFlag = TimingStatus

export function TimingBadge({ flag }: { flag: TimingFlag }) {
  const style =
    flag === 'Late'
      ? 'text-red-600'
      : flag === 'Early'
        ? 'text-green-600'
        : 'text-gray-500'
  return <span className={clsx('text-xs font-medium', style)}>({flag})</span>
}
