import { dayKeyOf } from '@matcha-puff/pomodoro-core'

export interface PlanEntry {
  id: string
  title: string
  desc: string
  rootId: string
  rootTitle: string
  /** 从顶层任务到父任务的名字串；顶层叶子为空 */
  path: string
  start: number
  end: number
  complete: boolean
}

/** 顶层任务可手选的颜色：都是压低饱和度的深色，白字角标和浅底块都能用 */
export const TASK_COLOR_OPTIONS = [
  { value: '#5f7f4f', name: '橄榄绿' },
  { value: '#4f7f79', name: '松石绿' },
  { value: '#5c6f96', name: '雾蓝' },
  { value: '#8a5f6f', name: '豆沙' },
  { value: '#6f5f96', name: '紫灰' },
  { value: '#96704f', name: '赭石' },
  { value: '#4f8a6a', name: '青绿' },
  { value: '#7f5f4f', name: '棕褐' },
  { value: '#5f6f7f', name: '石板灰蓝' },
] as const

/** 没手动指定颜色（以及习惯、无归属会话）统一用这个灰 */
export const UNSET_TASK_COLOR = '#7f8480'

export function displayTaskColor(color?: string): string {
  return color || UNSET_TASK_COLOR
}

export function keyOf(input: number | Date): string {
  const key = dayKeyOf(input)
  return `${key.year}-${key.month}-${key.day}`
}

export function dateFromKey(key: string): Date {
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)))
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export function weekdayLabel(date: Date): string {
  return `周${WEEKDAYS[(date.getDay() + 6) % 7]}`
}

export function clockText(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60, Math.round(minutes)))
  if (clamped === 24 * 60) return '24:00'
  return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`
}

export function minutesText(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`
}

export function minutesShort(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const rest = minutes % 60
  return rest === 0 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 60)}h${rest}m`
}

export function rangeText(start: number, end: number): string {
  if (!start || !end) return '时间不定'
  const left = new Date(start)
  const right = new Date(end)
  return `${left.getFullYear()}/${left.getMonth() + 1}/${left.getDate()} → ${right.getFullYear()}/${right.getMonth() + 1}/${right.getDate()}`
}
