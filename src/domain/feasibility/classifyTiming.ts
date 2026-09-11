export type TimingStatus = 'Late' | 'Early' | 'On Time'

export interface TimingThresholds {
  lateMinutes: number
  earlyMinutes: number
}

export const DEFAULT_TIMING_THRESHOLDS: TimingThresholds = {
  lateMinutes: 10,
  earlyMinutes: 10,
}

/**
 * Classifies a time (either an actual recorded timestamp or a computed ETA) against a target
 * time. Shared between TripCard's historical badges (actual finishedAt/onSceneAt vs the
 * scheduled time) and the dispatch table's predictive badges (estimated arrival vs the target
 * time for a not-yet-happened stop) — both are "how does this time compare to the target," just
 * fed different inputs.
 */
export function classifyTiming(
  actualOrEstimated: string | Date | undefined,
  target: string | Date | undefined,
  thresholds: TimingThresholds = DEFAULT_TIMING_THRESHOLDS,
): TimingStatus | undefined {
  if (!actualOrEstimated || !target) return undefined

  const actualMs = new Date(actualOrEstimated).getTime()
  const targetMs = new Date(target).getTime()
  if (Number.isNaN(actualMs) || Number.isNaN(targetMs)) return undefined

  const diffMinutes = (actualMs - targetMs) / 60000

  if (diffMinutes > thresholds.lateMinutes) return 'Late'
  if (diffMinutes < -thresholds.earlyMinutes) return 'Early'
  return 'On Time'
}
