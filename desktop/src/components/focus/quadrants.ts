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
    text: 'text-rose-600 dark:text-rose-400',
    stripe: 'bg-rose-500/80',
    badge: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  {
    value: 2,
    short: 'Q2',
    name: '重要不紧急',
    hint: '安排时间做',
    text: 'text-amber-600 dark:text-amber-400',
    stripe: 'bg-amber-500/80',
    badge: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  {
    value: 3,
    short: 'Q3',
    name: '不重要但紧急',
    hint: '尽量委托',
    text: 'text-sky-600 dark:text-sky-400',
    stripe: 'bg-sky-500/80',
    badge: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  {
    value: 4,
    short: 'Q4',
    name: '不重要不紧急',
    hint: '可以不做',
    text: 'text-muted-foreground',
    stripe: 'bg-foreground/25',
    badge: 'border-border/60 bg-foreground/[0.04] text-muted-foreground',
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
