import { MatchClock, MatchStatus } from '../types/domain'

export function getLiveElapsedSeconds(clock: MatchClock, now = new Date()): number {
  if (
    (clock.status === MatchStatus.FIRST_HALF || clock.status === MatchStatus.SECOND_HALF) &&
    clock.startedAt
  ) {
    const startedAt = new Date(clock.startedAt).getTime()
    const current = now.getTime()
    return clock.elapsedSeconds + Math.max(0, Math.floor((current - startedAt) / 1000))
  }

  return clock.elapsedSeconds
}

export function formatMatchTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
