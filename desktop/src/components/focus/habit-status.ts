/**
 * 习惯状态的统一视觉语言：详情月历与卡片 7 格条共用同一组颜色。
 *
 * 取舍：状态一律用实心色块，不再用空心/虚线区分——
 * 今天该做但没做、以及未来的该做日，都属于待做。
 * 完成 = 浅青实心、未完成 = 灰粉实心、待做 = 灰蓝实心、请假 = 藕紫实心。
 * 四个状态都在同一档低饱和里做色相偏转：青、粉、蓝、紫彼此接近又不刺眼。
 */
import type { HabitDayViewState } from '@matcha-puff/pomodoro-core'

export const HABIT_DONE_CHIP = 'bg-[#74a39e]'
export const HABIT_MISSED_CHIP = 'bg-[#b58a98]'
export const HABIT_FUTURE_CHIP = 'bg-[#7f94ae]'
/** 请假用藕紫区分：既不是“没做”，也不是“计划中” */
export const HABIT_EXCUSED_CHIP = 'bg-[#9c8aa6]'

/** 月历格右下角的状态色块；null 表示休息，不需要标记 */
export function habitDayChipClass(state: HabitDayViewState, due: boolean): string | null {
  if (state === 'done') return HABIT_DONE_CHIP
  if (state === 'missed') return HABIT_MISSED_CHIP
  if (state === 'excused') return HABIT_EXCUSED_CHIP
  // 今天该做但还没做，和未来该做日是同一类：待做
  if (state === 'pending' || (state === 'future' && due)) return HABIT_FUTURE_CHIP
  return null
}

/** 卡片 7 格条：整格就是同一块实心颜色，与月历的小色块同源 */
export function habitWeekTileClass(state: HabitDayViewState): string {
  if (state === 'done') return 'border border-transparent bg-[#74a39e]'
  if (state === 'missed') return 'border border-transparent bg-[#b58a98]'
  if (state === 'future') return 'border border-transparent bg-[#7f94ae]'
  if (state === 'excused') return 'border border-transparent bg-[#9c8aa6]'
  // 待做只在今天出现：同为灰蓝实心
  if (state === 'pending') return 'border border-transparent bg-[#7f94ae]'
  return 'border border-foreground/[0.08] bg-transparent'
}
