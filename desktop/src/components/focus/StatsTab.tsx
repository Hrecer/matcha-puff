import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Flame,
  LineChart,
  Repeat,
  RotateCcw,
  Target,
} from 'lucide-react'
import {
  createSummary,
  flattenTaskTree,
  monthlyActiveDays,
  monthlySecondsWithToday,
  secondsToMinutes,
  isSameDay,
  statisticOfDay,
} from '@matcha-puff/pomodoro-core'
import type { TaskNode } from '@matcha-puff/pomodoro-core'
import { Button } from '@/components/ui/button'
import { SectionTitle } from '@/components/ui/section-title'
import { TodayFocusDonut, type TodayFocusItem } from '@/components/focus/TodayFocusDonut'
import { UNSET_TASK_COLOR, displayTaskColor } from '@/components/focus/calendar-utils'
import { cn } from 'cn'
import { useFocusData } from '@/lib/focus-data'
import { jumpTo } from '@/lib/focus-jump'

function humanDuration(seconds: number): string {
  const minutes = secondsToMinutes(seconds)
  if (minutes < 60) return `${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} 小时` : `${hours} 小时 ${rest} 分钟`
}

function compactMinutes(seconds: number): string {
  const minutes = secondsToMinutes(seconds)
  return minutes >= 60 ? `${(minutes / 60).toFixed(1)}h` : `${minutes}m`
}

/** 三列并排后趋势卡很窄，12 个月的数值用整数小时才不会互相压住 */
function compactHours(seconds: number): string {
  const minutes = secondsToMinutes(seconds)
  return minutes >= 60 ? `${Math.round(minutes / 60)}h` : `${minutes}m`
}

type TrendMode = 'year' | 'month' | 'week'

type TrendChartKind = 'bar' | 'line'

const TREND_MODES: { value: TrendMode; label: string; title: string }[] = [
  { value: 'week', label: '周', title: '按周看每天' },
  { value: 'month', label: '月', title: '按月看每天' },
  { value: 'year', label: '年', title: '按年看 12 个月' },
]

// 页内切走再回来保留当前口径、年月周位置与图表类型；整页重启时模块重新初始化，自动回到本周 + 柱状图
const initialTrendDate = new Date()
const trendMemory: {
  mode: TrendMode
  chart: TrendChartKind
  year: number
  month: Date
  week: Date
} = {
  mode: 'week',
  chart: 'bar',
  year: initialTrendDate.getFullYear(),
  month: new Date(initialTrendDate),
  week: new Date(initialTrendDate),
}

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']

/** 专注节奏的四个时段：深夜跨过零点，按会话开始时刻归入 */
const RHYTHM_SLOTS = [
  { label: '上午', range: '06–12' },
  { label: '下午', range: '12–18' },
  { label: '傍晚', range: '18–22' },
  { label: '深夜', range: '22–06' },
] as const

function rhythmSlotOf(hour: number): number {
  if (hour >= 6 && hour < 12) return 0
  if (hour >= 12 && hour < 18) return 1
  if (hour >= 18 && hour < 22) return 2
  return 3
}

/** 四个时段用同一套自然色区分；单靠绿色深浅在细条上根本看不出来 */
const RHYTHM_COLORS = ['#3f6b3a', '#7a9a5e', '#b58a55', '#6d7f8b']

function startOfMonday(date: Date): Date {
  const monday = new Date(date)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

interface TrendPoint {
  key: string
  label: string
  seconds: number
  isCurrent: boolean
  title: string
}

export function StatsTab() {
  const { statistics, summary: stored, roots, inbox, habits, sessions, ready } = useFocusData()
  // 任务树不再有「顶层」这一层身份，这里统计整棵树的节点数
  const flatTasks = useMemo(() => flattenTaskTree(roots), [roots])
  const taskCount = flatTasks.length
  const now = new Date()
  // 三个趋势口径各有一个游标，页内状态保存在模块里，切换页签不会丢
  const [trendMode, setTrendMode] = useState<TrendMode>(trendMemory.mode)
  const [chartKind, setChartKind] = useState<TrendChartKind>(trendMemory.chart)
  const [activeRhythm, setActiveRhythm] = useState<number | null>(null)
  const [yearCursor, setYearCursor] = useState(trendMemory.year)
  const [monthCursor, setMonthCursor] = useState<Date>(() => new Date(trendMemory.month))
  const [weekCursor, setWeekCursor] = useState<Date>(() => new Date(trendMemory.week))

  useEffect(() => {
    trendMemory.mode = trendMode
    trendMemory.chart = chartKind
    trendMemory.year = yearCursor
    trendMemory.month = monthCursor
    trendMemory.week = weekCursor
  }, [trendMode, chartKind, yearCursor, monthCursor, weekCursor])

  const liveSummary = stored ?? createSummary()

  const habitIds = useMemo(() => new Set(habits.map((node) => node.habit.id)), [habits])
  const habitColorMap = useMemo(
    () => new Map(habits.map((node) => [node.habit.id, node.habit.color])),
    [habits],
  )

  // 颜色只认顶层任务手选的那一支，子任务向下继承；没选色统一用未设色灰
  const taskColorMap = useMemo(() => {
    const map = new Map<string, string>()
    const walk = (node: TaskNode, inherited: string) => {
      map.set(node.task.id, inherited)
      node.children.forEach((child) => walk(child, inherited))
    }
    roots.forEach((root) => {
      const base = displayTaskColor(root.task.color)
      map.set(root.task.id, base)
      root.children.forEach((child) => walk(child, base))
    })
    return map
  }, [roots])

  const months = useMemo(
    () => monthlySecondsWithToday(statistics, liveSummary, String(yearCursor)),
    [statistics, liveSummary, yearCursor],
  )
  const activeDays = useMemo(
    () => monthlyActiveDays(statistics, liveSummary, yearCursor),
    [statistics, liveSummary, yearCursor],
  )

  const allMinutes = secondsToMinutes(liveSummary.allPomodoroTime)
  const archivedDays = statistics.filter((record) => (record.pomodoroTime || 0) > 0).length
  const todayArchived = statistics.some((record) => isSameDay(
    new Date(Number(record.year), Number(record.month) - 1, Number(record.day)),
    now,
  ))
  const todayStat = statisticOfDay(statistics, liveSummary, now)
  // 今天尚未归档时单独补一天，避免「今天刚专注完」却显示 0 天
  const activeDayCount = archivedDays + (!todayArchived && (todayStat?.pomodoroTime ?? 0) > 0 ? 1 : 0)
  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)
  const dayStartMs = dayStart.getTime()
  const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000

  // 会话按结束时刻归属「今天」，和今日汇总（summary）的口径一致；
  // 跨零点的会话整段算在结束后那一天，时段仍按开始时刻归入
  const rhythm = useMemo(() => {
    const seconds = [0, 0, 0, 0]
    for (const session of sessions) {
      if (session.end < dayStartMs || session.end >= dayEndMs || session.seconds <= 0) continue
      const index = rhythmSlotOf(new Date(session.start).getHours())
      seconds[index] = (seconds[index] ?? 0) + session.seconds
    }
    return seconds
  }, [sessions, dayStartMs, dayEndMs])
  const rhythmTotal = rhythm.reduce((sum, value) => sum + value, 0)
  const currentRhythmSlot = rhythmSlotOf(now.getHours())
  const rhythmPeak = rhythm.indexOf(Math.max(...rhythm))

  const todayTasks = flatTasks.filter(({ node }) => {
    if (node.isContainer) return false
    if (!node.startDate || !node.endDate || node.endDate < node.startDate) return false
    return node.startDate < dayEndMs && node.endDate >= dayStartMs
  })
  const doneTasksToday = todayTasks.filter(({ node }) => node.complete).length
  const dueHabitsToday = habits.filter((node) => node.due)
  const doneHabitsToday = dueHabitsToday.filter((node) => node.state === 'done').length
  const taskTotal = todayTasks.length
  const habitTotal = dueHabitsToday.length
  const doneItems = doneTasksToday + doneHabitsToday
  const totalItems = taskTotal + habitTotal
  const itemPercent = totalItems > 0 ? Math.min(100, Math.round((doneItems / totalItems) * 100)) : 0

  const todayDonutItems = useMemo<TodayFocusItem[]>(() => {
    const tasks = [...(todayStat?.tasks ?? [])]
      .filter((task) => task.value > 0)
      .sort((a, b) => b.value - a.value)
    const items: TodayFocusItem[] = tasks.map((task) => ({
      id: task.id,
      name: task.name,
      seconds: task.value,
      color: displayTaskColor(taskColorMap.get(task.id) ?? habitColorMap.get(task.id)),
      kind: habitIds.has(task.id)
        ? ('habit' as const)
        : taskColorMap.has(task.id)
          ? ('task' as const)
          : undefined,
    }))
    const sum = items.reduce((total, item) => total + item.seconds, 0)
    const focus = todayStat?.pomodoroTime ?? 0
    if (focus - sum > 60) {
      items.push({ id: '__rest__', name: '未归属', seconds: focus - sum, color: UNSET_TASK_COLOR })
    }
    return items
  }, [todayStat, taskColorMap, habitColorMap, habitIds])

  const monthYear = monthCursor.getFullYear()
  const monthIndex = monthCursor.getMonth()
  const weekStart = startOfMonday(weekCursor)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)

  const canGoNext =
    trendMode === 'year'
      ? yearCursor < now.getFullYear()
      : trendMode === 'month'
        ? monthYear < now.getFullYear() || (monthYear === now.getFullYear() && monthIndex < now.getMonth())
        : weekStart.getTime() < startOfMonday(now).getTime()

  const shiftPeriod = (dir: -1 | 1) => {
    if (trendMode === 'year') {
      setYearCursor((prev) => prev + dir)
    } else if (trendMode === 'month') {
      setMonthCursor((prev) => {
        const next = new Date(prev)
        next.setDate(1)
        next.setMonth(prev.getMonth() + dir)
        return next
      })
    } else {
      setWeekCursor((prev) => {
        const next = new Date(prev)
        next.setDate(prev.getDate() + dir * 7)
        return next
      })
    }
  }

  const resetTrend = () => {
    setChartKind('bar')
    if (trendMode === 'year') setYearCursor(now.getFullYear())
    else if (trendMode === 'month') setMonthCursor(new Date())
    else setWeekCursor(new Date())
  }
  const trendResetLabel = trendMode === 'year' ? '回到今年' : trendMode === 'month' ? '回到本月' : '回到本周'

  const periodLabel =
    trendMode === 'year'
      ? String(yearCursor)
      : trendMode === 'month'
        ? `${monthYear} 年 ${monthIndex + 1} 月`
        : `${weekStart.getMonth() + 1}/${weekStart.getDate()}–${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`

  const trendPoints: TrendPoint[] = (() => {
    if (trendMode === 'year') {
      return months.map((seconds, index) => ({
        key: `year-${yearCursor}-${index}`,
        label: String(index + 1),
        seconds,
        isCurrent: yearCursor === now.getFullYear() && index === now.getMonth(),
        title: `${index + 1} 月 · ${seconds > 0 ? humanDuration(seconds) : '无记录'} · ${activeDays[index] ?? 0} 天`,
      }))
    }
    if (trendMode === 'month') {
      const daysInMonth = new Date(monthYear, monthIndex + 1, 0).getDate()
      return Array.from({ length: daysInMonth }, (_, index) => {
        const date = new Date(monthYear, monthIndex, index + 1)
        const stat = statisticOfDay(statistics, liveSummary, date, now)
        const seconds = stat?.pomodoroTime ?? 0
        return {
          key: `month-${monthYear}-${monthIndex}-${index}`,
          label: String(index + 1),
          seconds,
          isCurrent: isSameDay(date, now),
          title: `${monthIndex + 1}/${index + 1} · ${seconds > 0 ? humanDuration(seconds) : '无记录'} · ${stat?.pomodoroCount ?? 0} 个番茄`,
        }
      })
    }
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(weekStart)
      date.setDate(weekStart.getDate() + index)
      const stat = statisticOfDay(statistics, liveSummary, date, now)
      const seconds = stat?.pomodoroTime ?? 0
      return {
        key: `week-${weekStart.getTime()}-${index}`,
        label: WEEKDAY_LABELS[index]!,
        seconds,
        isCurrent: isSameDay(date, now),
        title: `${date.getMonth() + 1}/${date.getDate()} 周${WEEKDAY_LABELS[index]} · ${seconds > 0 ? humanDuration(seconds) : '无记录'} · ${stat?.pomodoroCount ?? 0} 个番茄`,
      }
    })
  })()

  if (!ready) {
    return <p className="px-1 pt-2 text-xs text-muted-foreground">正在读取统计…</p>
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 pt-2">
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Overview label="累计番茄" value={String(liveSummary?.allPomodoroCount ?? 0)} unit="个" icon={Target} />
        <Overview label="累计专注" value={String(allMinutes)} unit="分钟" icon={Clock3} />
        <Overview label="有记录天数" value={String(activeDayCount)} unit="天" icon={Flame} />
        <Overview
          label="任务"
          value={`${taskCount}`}
          unit={`进行中 · ${inbox.length} 已完成`}
          icon={CalendarRange}
        />
        <Overview label="习惯" value={String(habits.length)} unit="个" icon={Repeat} />
      </section>

      <div className="grid grid-cols-1 gap-x-2 gap-y-3 lg:grid-cols-5">
        <section className="glass order-1 flex flex-col rounded-panel p-4 lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <div className="flex items-center justify-between gap-2">
            <SectionTitle>今日完成度</SectionTitle>
            <span className="font-mono text-[13px] tabular-nums text-primary">{itemPercent}%</span>
          </div>
          <div className="mt-3">
            <p className="font-mono text-[34px] leading-none tabular-nums text-foreground">
              {doneItems}
              <span className="text-[15px] text-muted-foreground"> / {totalItems}</span>
              <span className="ml-1.5 font-sans text-[11px] font-normal text-muted-foreground">项</span>
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-foreground/8">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500"
                style={{ width: `${itemPercent}%` }}
              />
            </div>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 pt-5">
            <div>
              <p className="text-[10.5px] text-muted-foreground">任务</p>
              <p className="mt-1 font-mono text-[14px] leading-none tabular-nums text-foreground">
                {doneTasksToday} / {taskTotal}
              </p>
            </div>
            <div>
              <p className="text-[10.5px] text-muted-foreground">习惯</p>
              <p className="mt-1 font-mono text-[14px] leading-none tabular-nums text-foreground">
                {doneHabitsToday} / {habitTotal}
              </p>
            </div>
          </div>
          <p className="mt-3 text-[10.5px] text-muted-foreground">
            {totalItems <= 0 ? '今天没有要完成的任务或习惯' : doneItems >= totalItems ? '今日目标已达成' : `还差 ${totalItems - doneItems} 项`}
          </p>
        </section>

        {/* 跨两行的容器尺寸不变；内部再拆成「环形图」和「专注节奏」两块 */}
        <div className="order-3 flex min-h-0 flex-col gap-3 lg:col-span-3 lg:col-start-3 lg:row-span-2 lg:row-start-1">
          <section className="glass flex shrink-0 flex-col overflow-hidden rounded-panel p-4">
            <SectionTitle>时间花在哪</SectionTitle>
            <div className="mt-2 shrink-0">
              <TodayFocusDonut
                items={todayDonutItems}
                focusSeconds={todayStat?.pomodoroTime ?? 0}
                onJump={jumpTo}
              />
            </div>
          </section>

          <section className="glass flex min-h-0 flex-1 flex-col rounded-panel p-4">
            <SectionTitle trailing={rhythmTotal > 0 ? `今天 · ${humanDuration(rhythmTotal)}` : '今天'}>
              专注节奏
            </SectionTitle>

            <div className="relative mt-2.5 h-2.5">
              <div className="flex h-full gap-[3px] overflow-hidden rounded-full bg-foreground/8">
                {RHYTHM_SLOTS.map((slot, index) => {
                  const seconds = rhythm[index] ?? 0
                  if (seconds <= 0) return null
                  const percent = (seconds / rhythmTotal) * 100
                  return (
                    <div
                      key={slot.label}
                      className={cn(
                        'h-full pointer-events-none transition-[filter,box-shadow] duration-150 first:rounded-l-full last:rounded-r-full',
                        activeRhythm === index &&
                          'brightness-110 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]',
                      )}
                      style={{ width: `${percent}%`, backgroundColor: RHYTHM_COLORS[index] }}
                    />
                  )
                })}
              </div>
              {/* 透明热区比 10px 的条子高，细条也容易悬停 */}
              <div
                className="absolute inset-x-0 -top-2 bottom-0"
                onPointerLeave={() => setActiveRhythm(null)}
                onPointerMove={(event) => {
                  if (rhythmTotal <= 0) return
                  const rect = event.currentTarget.getBoundingClientRect()
                  const ratio = Math.min(0.9999, Math.max(0, (event.clientX - rect.left) / rect.width))
                  let acc = 0
                  for (let index = 0; index < RHYTHM_SLOTS.length; index += 1) {
                    acc += (rhythm[index] ?? 0) / rhythmTotal
                    if (ratio < acc) {
                      setActiveRhythm(index)
                      return
                    }
                  }
                  setActiveRhythm(RHYTHM_SLOTS.length - 1)
                }}
              />
            </div>

            <div className="mt-1.5 grid grid-cols-4 gap-2">
              {RHYTHM_SLOTS.map((slot, index) => {
                const seconds = rhythm[index] ?? 0
                const isNow = index === currentRhythmSlot
                const active = activeRhythm === index
                const percent = rhythmTotal > 0 ? Math.round((seconds / rhythmTotal) * 100) : 0
                return (
                  <div
                    key={slot.label}
                    className="min-w-0"
                  >
                    <p
                      className={cn(
                        'flex items-center gap-1.5 whitespace-nowrap text-[12px] leading-none',
                        isNow
                          ? 'text-primary'
                          : active
                            ? 'font-semibold text-foreground'
                            : 'text-foreground/70',
                      )}
                    >
                      <span
                        className={cn(
                          'size-2 shrink-0 rounded-full transition-shadow',
                          active && 'ring-2 ring-primary/25',
                        )}
                        style={{ backgroundColor: RHYTHM_COLORS[index] }}
                        aria-hidden
                      />
                      {slot.label}
                      {isNow ? (
                        <span className="rounded-[3px] bg-primary/10 px-1 py-[1px] text-[9.5px] font-medium leading-none text-primary">
                          此刻
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-1.5 flex items-baseline gap-1.5 whitespace-nowrap">
                      <span className="font-mono text-[14px] font-medium leading-none tabular-nums text-foreground">
                        {compactMinutes(seconds)}
                      </span>
                      <span className="text-[12px] font-medium leading-none tabular-nums text-foreground/60">
                        {percent}%
                      </span>
                    </p>
                  </div>
                )
              })}
            </div>

            <p className="mt-auto pt-1 text-[12px] leading-5 text-foreground/70">
              {activeRhythm !== null ? (
                <>
                  <span className="font-medium text-foreground">
                    {RHYTHM_SLOTS[activeRhythm]?.label} {RHYTHM_SLOTS[activeRhythm]?.range}
                  </span>
                  {' · '}
                  {compactMinutes(rhythm[activeRhythm] ?? 0)} · 占今天{' '}
                  {rhythmTotal > 0 ? Math.round(((rhythm[activeRhythm] ?? 0) / rhythmTotal) * 100) : 0}%
                </>
              ) : rhythmTotal > 0 ? (
                <>
                  最专注：
                  <span className="font-medium text-foreground">
                    {RHYTHM_SLOTS[rhythmPeak]?.label} {RHYTHM_SLOTS[rhythmPeak]?.range}
                  </span>
                  {' · '}
                  {compactMinutes(rhythm[rhythmPeak] ?? 0)} · 占今天{' '}
                  {Math.round(((rhythm[rhythmPeak] ?? 0) / rhythmTotal) * 100)}%
                </>
              ) : (
                '今天还没有专注记录，开始计时后会出现在这里'
              )}
            </p>
          </section>
        </div>

        <section className="glass order-2 flex flex-col rounded-panel p-4 lg:col-span-2 lg:col-start-1 lg:row-start-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <SectionTitle>趋势</SectionTitle>
              <div className="flex shrink-0 items-center gap-0.5 rounded-md bg-foreground/[0.05] p-0.5">
                {TREND_MODES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTrendMode(item.value)}
                    title={item.title}
                    className={cn(
                      'cursor-pointer rounded-[4px] px-1 py-0.5 text-[10px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40',
                      trendMode === item.value
                        ? 'bg-primary/15 text-primary'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-1">
                <div
                  className="flex items-center gap-0.5 rounded-md bg-foreground/[0.05] p-0.5"
                  role="group"
                  aria-label="图表类型"
                >
                  {(
                    [
                      { value: 'bar', label: '柱状图', Icon: BarChart3 },
                      { value: 'line', label: '折线图', Icon: LineChart },
                    ] as const
                  ).map(({ value, label, Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setChartKind(value)}
                      title={label}
                      aria-label={label}
                      aria-pressed={chartKind === value}
                      className={cn(
                        'cursor-pointer rounded-[4px] p-0.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40',
                        chartKind === value
                          ? 'bg-primary/15 text-primary'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon className="size-3" aria-hidden />
                    </button>
                  ))}
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={trendResetLabel}
                  title={trendResetLabel}
                  onClick={resetTrend}
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-end gap-1">
              <Button size="icon-xs" variant="ghost" aria-label="上一段" onClick={() => shiftPeriod(-1)}>
                <ChevronLeft className="size-3.5" aria-hidden />
              </Button>
              <span className="whitespace-nowrap text-[10.5px] tabular-nums text-foreground">{periodLabel}</span>
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="下一段"
                disabled={!canGoNext}
                onClick={() => shiftPeriod(1)}
              >
                <ChevronRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>

          <TrendChart
            kind={chartKind}
            points={trendPoints}
            valueMode={trendPoints.length > 12 ? 'none' : trendPoints.length === 12 ? 'hours' : 'compact'}
          />
        </section>
      </div>
    </div>
  )
}

function Overview({
  label,
  value,
  unit,
  icon: Icon,
}: {
  label: string
  value: string
  unit: string
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="glass rounded-panel px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Icon className="size-2.5" aria-hidden />
        {label}
      </p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1 font-mono text-[18px] leading-5 tabular-nums text-foreground">
        <span>{value}</span>
        <span className="whitespace-nowrap font-sans text-[9.5px] font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}

function TrendChart({
  kind,
  points,
  valueMode,
}: {
  kind: TrendChartKind
  points: TrendPoint[]
  valueMode: 'compact' | 'hours' | 'none'
}) {
  const max = Math.max(1, ...points.map((point) => point.seconds))
  const total = points.reduce((sum, point) => sum + point.seconds, 0)
  const dense = points.length > 12
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const active = points.find((point) => point.key === activeKey) ?? null
  // 切换口径/翻页/换图表后清掉上一次的悬停读数
  useEffect(() => {
    setActiveKey(null)
  }, [points, kind])

  // 点落在每列正中：与下面的横轴刻度、上面的悬停列严格对齐
  const xPercent = (index: number) => ((index + 0.5) / Math.max(1, points.length)) * 100
  const linePath = points
    .map((point, index) => {
      const x = xPercent(index) * 10
      const y = 100 - (point.seconds / max) * 100
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  const areaPath = points.length > 0 ? `${linePath} L1000,100 L0,100 Z` : ''
  const activeIndex = points.findIndex((point) => point.key === activeKey)
  const currentIndex = points.findIndex((point) => point.isCurrent)

  return (
    <div className="mt-3">
      {/* 136 = 112 柱区 + 24 数值抬头；数值绝对定位在各自柱顶上方，不占布局 */}
      <div className="relative h-[136px]">
        {kind === 'bar' ? (
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 flex h-[112px] items-end border-b border-foreground/10',
              dense ? 'gap-0.5' : 'gap-1',
            )}
            onPointerLeave={() => setActiveKey(null)}
          >
            {points.map((point) => {
              const height = point.seconds > 0 ? Math.max(4, Math.round((point.seconds / max) * 100)) : 0
              const on = point.key === activeKey
              return (
                <div
                  key={point.key}
                  className="relative flex h-full min-w-0 flex-1 items-end"
                  onPointerEnter={() => setActiveKey(point.key)}
                >
                  {point.seconds > 0 ? (
                    <>
                      {valueMode !== 'none' ? (
                        <span
                          className={cn(
                            'absolute inset-x-0 -translate-y-1 text-center font-mono leading-none tabular-nums text-muted-foreground',
                            valueMode === 'hours' ? 'text-[8px]' : 'text-[9.5px]',
                          )}
                          style={{ bottom: `${height}%` }}
                        >
                          {valueMode === 'hours' ? compactHours(point.seconds) : compactMinutes(point.seconds)}
                        </span>
                      ) : null}
                      <div
                        className={cn(
                          'w-full rounded-t-[3px] transition-colors',
                          point.isCurrent
                            ? on
                              ? 'bg-primary/80'
                              : 'bg-primary'
                            : on
                              ? 'bg-primary/65'
                              : 'bg-primary/45',
                        )}
                        style={{ height: `${height}%` }}
                      />
                    </>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div
            className="absolute inset-x-0 bottom-0 h-[112px] border-b border-foreground/10"
            onPointerLeave={() => setActiveKey(null)}
          >
            <svg
              className="absolute inset-0 size-full overflow-visible text-primary"
              viewBox="0 0 1000 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <path d={areaPath} fill="currentColor" opacity={0.1} />
              <path
                d={linePath}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            {currentIndex >= 0 ? (
              <span
                className="pointer-events-none absolute inset-y-0 border-l border-dashed border-primary/25"
                style={{ left: `${xPercent(currentIndex)}%` }}
              />
            ) : null}
            {active && activeIndex >= 0 ? (
              <span
                className="pointer-events-none absolute inset-y-0 border-l border-dashed border-primary/35"
                style={{ left: `${xPercent(activeIndex)}%` }}
              />
            ) : null}
            {points.map((point, index) => {
              const on = point.key === activeKey
              // 月视图 30/31 个点太密，只留今天与悬停点，避免一排碎点糊成线
              if (dense && !on && !point.isCurrent) return null
              return (
                <span
                  key={point.key}
                  className={cn(
                    'pointer-events-none absolute -translate-x-1/2 translate-y-1/2 rounded-full transition-all',
                    on
                      ? 'size-2.5 bg-primary ring-2 ring-primary/20'
                      : point.isCurrent
                        ? 'size-2 bg-primary ring-2 ring-background'
                        : 'size-1.5 bg-primary/50',
                  )}
                  style={{ left: `${xPercent(index)}%`, bottom: `${(point.seconds / max) * 100}%` }}
                />
              )
            })}
            <div className="absolute inset-0 z-10 flex">
              {points.map((point) => (
                <div
                  key={point.key}
                  className="h-full min-w-0 flex-1"
                  onPointerEnter={() => setActiveKey(point.key)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className={cn('mt-1.5 flex h-3 items-center', dense ? 'gap-0.5' : 'gap-1')}>
        {points.map((point, index) => {
          const day = Number(point.label)
          const lastDay = dense ? Number(points[points.length - 1]?.label) : Number.NaN
          // 末尾的 31 与 30 只隔一格，会叠字；末位优先，挤在一起的 30 自动让位
          // 当前这一天/月永远显示刻度，并单独着色，替代压在折线上的文字标签
          const showLabel =
            point.isCurrent ||
            !dense ||
            index === 0 ||
            index === points.length - 1 ||
            (Number.isFinite(day) && day % 5 === 0 && !(Number.isFinite(lastDay) && Math.abs(day - lastDay) <= 1))
          return (
            <span
              key={point.key}
              className={cn(
                'flex-1 whitespace-nowrap text-center text-[9px] leading-none',
                point.isCurrent ? 'font-semibold text-primary' : 'text-muted-foreground',
              )}
            >
              {showLabel ? point.label : ''}
            </span>
          )
        })}
      </div>
      {/* 固定读数行：悬停信息显示在这里，不再弹出浮层挡住柱子 */}
      <div className="mt-1.5 flex h-4 items-center text-[9.5px] leading-none text-muted-foreground">
        <span className="min-w-0 truncate" title={active?.title}>
          {active ? active.title : `合计 ${humanDuration(total)}`}
        </span>
      </div>
    </div>
  )
}
