import type { CycleState, PomodoroConfig, RestKind } from './types'

/** 距上次完成超过这个间隔，视为新的一段专注（避免隔天开机第一个番茄就长休） */
export const NEW_SITTING_GAP_MS = 4 * 60 * 60 * 1000

/**
 * 长休判定：完成数达到间隔整数倍时给长休。
 *
 * 必须要求 completed > 0：否则 `0 % 4 === 0` 会把第一次手动休息判成长休。
 */
export function nextRestKind(completed: number, interval: number): RestKind {
  if (completed <= 0 || interval <= 0) return 'short'
  return completed % interval === 0 ? 'long' : 'short'
}

export function isNewSitting(
  lastCompletedAt: number | null,
  now: number,
  gapMs = NEW_SITTING_GAP_MS,
): boolean {
  if (lastCompletedAt === null) return false
  return now - lastCompletedAt > gapMs
}

/** 开始一次专注前的计数：间隔过久就重新起一段 */
export function beginCycle(
  cycle: CycleState,
  now: number,
  gapMs = NEW_SITTING_GAP_MS,
): CycleState {
  return isNewSitting(cycle.lastCompletedAt, now, gapMs)
    ? { completed: 0, lastCompletedAt: null }
    : { ...cycle }
}

/** 完成一个番茄：计数 +1 */
export function completeCycle(cycle: CycleState, now: number): CycleState {
  return { completed: cycle.completed + 1, lastCompletedAt: now }
}

/** 长休结束后开启新的一段；短休不影响计数 */
export function afterRest(cycle: CycleState, kind: RestKind): CycleState {
  if (kind === 'long') {
    return { completed: 0, lastCompletedAt: cycle.lastCompletedAt }
  }
  return { ...cycle }
}

export function restMinutes(config: PomodoroConfig, kind: RestKind): number {
  return kind === 'long' ? config.longRestTime : config.restTime
}
