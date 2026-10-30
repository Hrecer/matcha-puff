import type { HabitCycle, HabitLog, HabitSchedule } from './types'

export const HABIT_CYCLE_LABELS: Record<HabitCycle, string> = {
  daily: '每天',
  workday: '工作日',
  holiday: '法定节假日',
  yearly: '每年',
  mon: '周一',
  tue: '周二',
  wed: '周三',
  thu: '周四',
  fri: '周五',
  sat: '周六',
  sun: '周日',
  monthStart: '每月第一天',
  monthEnd: '每月最后一天',
}

/** 周期选项顺序（表单下拉直接用） */
export const HABIT_CYCLE_ORDER: readonly HabitCycle[] = [
  'daily',
  'workday',
  'holiday',
  'yearly',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
  'monthStart',
  'monthEnd',
]

/**
 * 某一天在法定日历里的身份。由应用层查表得到（节假日表来自联网接口），
 * core 只做纯判断，不关心数据从哪来。
 */
export interface DayContext {
  /** 法定工作日：周一至周五且不是法定节假日，或调休补班日 */
  workday: boolean
  /** 法定节假日（国务院公布的放假日，不含普通周末） */
  statutoryHoliday: boolean
}

const WEEKDAY_CYCLE: Partial<Record<HabitCycle, number>> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}

/** 这个周期是不是要靠节假日表才能判断 */
export function needsCalendar(cycle: HabitCycle): boolean {
  return cycle === 'workday' || cycle === 'holiday'
}

/** 兼容旧调用：周期字符串等价于只有 cycle 的 schedule */
const scheduleOf = (input: HabitSchedule | HabitCycle): HabitSchedule =>
  typeof input === 'string' ? { cycle: input } : input

/** 年度日期在指定年份的有效日：2 月 29 日在平年退到 2 月 28 日 */
function annualDayOf(year: number, month: number, day: number): number {
  return Math.min(day, new Date(year, month, 0).getDate())
}

const validAnnual = (schedule: HabitSchedule): boolean =>
  schedule.anchorMonth !== undefined &&
  schedule.anchorDay !== undefined &&
  schedule.anchorMonth >= 1 &&
  schedule.anchorMonth <= 12 &&
  schedule.anchorDay >= 1 &&
  schedule.anchorDay <= 31

/** 今天是否该做这个习惯 */
export function isHabitDue(
  scheduleInput: HabitSchedule | HabitCycle,
  date: Date,
  day: DayContext,
): boolean {
  const schedule = scheduleOf(scheduleInput)
  const cycle = schedule.cycle
  if (cycle === 'daily') return true
  if (cycle === 'workday') return day.workday
  if (cycle === 'holiday') return day.statutoryHoliday
  if (cycle === 'monthStart') return date.getDate() === 1
  if (cycle === 'monthEnd') {
    return date.getDate() === new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  }
  if (cycle === 'yearly') {
    if (!validAnnual(schedule)) return false
    const month = schedule.anchorMonth!
    return (
      date.getMonth() + 1 === month &&
      date.getDate() === annualDayOf(date.getFullYear(), month, schedule.anchorDay!)
    )
  }
  return WEEKDAY_CYCLE[cycle] === date.getDay()
}

export function habitCycleLabel(cycle: HabitCycle): string {
  return HABIT_CYCLE_LABELS[cycle]
}

/** 习惯周期文案：年度习惯带上具体月/日，其余沿用周期名 */
export function habitScheduleLabel(schedule: HabitSchedule): string {
  if (schedule.cycle === 'yearly' && validAnnual(schedule)) {
    return `每年 ${schedule.anchorMonth}月${schedule.anchorDay}日`
  }
  return habitCycleLabel(schedule.cycle)
}

export function habitLogsOf(logs: readonly HabitLog[], habitId: string): HabitLog[] {
  return logs.filter((log) => log.habit === habitId).sort((a, b) => b.time - a.time)
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 某一天内成功完成的次数：区间是 `[dayStart, dayEnd)`。
 * 只认 success 的记录 —— 开始后中断的占位记录不算执行。
 */
export function habitSuccessCountOn(
  logs: readonly HabitLog[],
  habitId: string,
  dayStart: number,
  dayEnd: number = dayStart + DAY_MS,
): number {
  return logs.filter(
    (log) => log.habit === habitId && log.success && log.time >= dayStart && log.time < dayEnd,
  ).length
}

/** 习惯在某一天的三态：已完成 / 该做没做 / 今天不用做 */
export type HabitDayState = 'done' | 'pending' | 'off'

/**
 * 习惯在一天里的状态。全应用只此一处判断，卡片标识、筛选、四象限、日历都走它，
 * 免得「今日已完成」和「未完成」两套口径各自漂移。
 *
 * 今天不用做的一律是 off：即使当天额外做了一次，也不进「已完成」——
 * 那个筛选回答的是「今天的任务完成了没有」。
 */
export function habitDayState(due: boolean, doneCount: number): HabitDayState {
  if (!due) return 'off'
  return doneCount > 0 ? 'done' : 'pending'
}

/** 执行次数只算完成的那一刻；开始后中断的记录是 false，不计 */
export function completedHabitCount(logs: readonly HabitLog[], habitId: string): number {
  return logs.filter((log) => log.habit === habitId && log.success).length
}
