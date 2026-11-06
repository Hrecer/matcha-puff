import type { TaskQuadrant } from '@matcha-puff/pomodoro-core'

export interface QuadrantMeta {
  value: TaskQuadrant
  short: string
  name: string
  hint: string
  /** 标题/数字文字色 */
  text: string
  /** 卡片左条 */
  stripe: string
  /** Q 徽章 */
  badge: string
}

/** 沿用原插件的四色：玫瑰、琥珀、天蓝、中性灰 */
export const QUADRANTS: readonly QuadrantMeta[] = [
  {
    value: 1,
    short: 'Q1',
    name: '重要且紧急',
    hint: '马上做',
    text: 'text-q1',
    stripe: 'bg-q1',
    badge: 'border-transparent bg-q1 text-white',
  },
  {
    value: 2,
    short: 'Q2',
    name: '重要不紧急',
    hint: '安排时间做',
    text: 'text-q2',
    stripe: 'bg-q2',
    badge: 'border-transparent bg-q2 text-white',
  },
  {
    value: 3,
    short: 'Q3',
    name: '不重要但紧急',
    hint: '尽量委托',
    text: 'text-q3',
    stripe: 'bg-q3',
    badge: 'border-transparent bg-q3 text-white',
  },
  {
    value: 4,
    short: 'Q4',
    name: '不重要不紧急',
    hint: '可以不做',
    text: 'text-q4',
    stripe: 'bg-q4',
    badge: 'border-transparent bg-q4 text-white',
  },
]

export const DEFAULT_QUADRANT: TaskQuadrant = 2

export function normalizeQuadrant(value?: number | null): TaskQuadrant {
  return value === 1 || value === 2 || value === 3 || value === 4 ? value : DEFAULT_QUADRANT
}

export function quadrantMetaOf(value?: number | null): QuadrantMeta {
  return QUADRANTS.find((item) => item.value === normalizeQuadrant(value)) ?? QUADRANTS[1]!
}

export const QUADRANT_OPTIONS = QUADRANTS.map((item) => ({
  value: String(item.value),
  label: `${item.short} ${item.name}`,
}))
