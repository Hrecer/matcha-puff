import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Check, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RotateCcw } from 'lucide-react'
import { createSummary, habitDayState, isHabitDue, statisticOfDay } from '@matcha-puff/pomodoro-core'
import type { FocusSession, TaskNode } from '@matcha-puff/pomodoro-core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { SlidingSegmented } from '@/components/ui/sliding'
import { DayBoard, type DayDetail } from '@/components/focus/DayBoard'
import { jumpTo } from '@/lib/focus-jump'
import { PlanGroupView } from '@/components/focus/PlanGroupView'
import {
  UNSET_TASK_COLOR,
  clockText,
  dateFromKey,
  displayTaskColor,
  keyOf,
  minutesShort,
  minutesText,
  weekdayLabel,
  type PlanEntry,
} from '@/components/focus/calendar-utils'
import { cn } from 'cn'
import { dayContextOf, ensureHolidayYear, useFocusData } from '@/lib/focus-data'

type CalendarView = 'day' | 'month' | 'year'

const VIEW_OPTIONS: { value: CalendarView; label: string }[] = [
  { value: 'day', label: '日' },
  { value: 'month', label: '月' },
  { value: 'year', label: '年' },
]

/**
 * 上次停在哪个视图 —— 只记在内存里（模块级变量）。
 *
 * 切到别的页签再回来，日历还停在上次的视图；重启应用时这个变量随进程一起没了，
 * 于是回到默认的日视图。刻意不走 localStorage：视图偏好不值得跨启动留存。
 */
let lastCalendarView: CalendarView | null = null

/**
 * 三个视图各自的游标（日 / 月 / 年），互不影响。
 * 和 lastCalendarView 一样只留在内存里：切页签回来还在原处，重启应用回今天。
 */
const cursorMemory: {
  day: Date | null
  month: { year: number; month: number } | null
  year: number | null
} = { day: null, month: null, year: null }

const EMPTY_SUMMARY = createSummary()

function dayOf(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function holidayOf(date: Date): 'holiday' | 'workday' | null {
  const context = dayContextOf(date)
  if (context.statutoryHoliday) return 'holiday'
  const weekend = date.getDay() === 0 || date.getDay() === 6
  return context.workday && weekend ? 'workday' : null
}

function groupPlans(plans: readonly PlanEntry[]) {
  const groups = new Map<string, { rootId: string; rootTitle: string; items: PlanEntry[] }>()
  for (const plan of plans) {
    const group = groups.get(plan.rootId) ?? { rootId: plan.rootId, rootTitle: plan.rootTitle, items: [] }
    group.items.push(plan)
    groups.set(plan.rootId, group)
  }
  return [...groups.values()]
}

/**
 * 专注日历：
 * - 日：顶部「全天」区放计划，按小时的时间轴画实际发生的专注会话；
 * - 月：每格直接列出专注、计划完成度与习惯执行，节假日/调休、逾期也在格子里；
 * - 年：12 个月汇总；
 * - 任意日期打开详情：专注、会话、习惯、按顶层任务分组的计划都在里面。
 *
 * 【为什么没有周视图】七列并排后每天只剩 ~90px：计划 chip 挤成「4 个 + 一串数字」，
 * 时间轴也窄到看不出块的长短 —— 既没有月的全局感，也没有日的细节，两头不占优。
 * 看一段时间的分布用月视图，看某一天几点做了什么点进日视图。
 */
export function PomodoroCalendar() {
  const { statistics, summary, roots, habits, sessions: storedSessions } = useFocusData()
  // 热更可能复用旧状态对象，兜一层，避免 sessions 暂时是 undefined
  const sessions = storedSessions ?? []
  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = now.getMonth()
  const liveSummary = useMemo(() => summary ?? EMPTY_SUMMARY, [summary])

  const [view, setView] = useState<CalendarView>(lastCalendarView ?? 'day')
  /**
   * 三个视图各自一个游标，不互相牵动：
   * 在年视图翻到 2025，月视图还停在原来那个月、日视图还停在原来那天 ——
   * 你只是"看了一下别的年份"，没道理把另外两个视图也一起搬走。
   * 切换视图时也不再互相同步；只有点 ↻ 才把**当前视图**拉回今天/本月/今年。
   */
  const [dayCursor, setDayCursor] = useState<Date>(() =>
    cursorMemory.day ? new Date(cursorMemory.day) : dayOf(now),
  )
  const [monthCursor, setMonthCursor] = useState(() =>
    cursorMemory.month ? { ...cursorMemory.month } : { year: nowYear, month: nowMonth },
  )
  const [yearCursor, setYearCursor] = useState<number>(() => cursorMemory.year ?? nowYear)

  // 每次变化都写回模块变量，供下次挂载（切页签回来）恢复
  useEffect(() => {
    cursorMemory.day = dayCursor
  }, [dayCursor])
  useEffect(() => {
    cursorMemory.month = monthCursor
  }, [monthCursor])
  useEffect(() => {
    cursorMemory.year = yearCursor
  }, [yearCursor])
  const [selected, setSelected] = useState<string | null>(null)

  /** 全部叶子的排期 + 每个任务归属的顶层任务（会话配色也用它） */
  const { planMap, rootOfTask } = useMemo(() => {
    const map = new Map<string, PlanEntry[]>()
    const rootOf = new Map<string, string>()
    const add = (start: number, end: number, entry: Omit<PlanEntry, 'start' | 'end'>) => {
      if (!start || !end || end < start) return
      const date = new Date(start)
      date.setHours(0, 0, 0, 0)
      const endDay = new Date(end)
      endDay.setHours(0, 0, 0, 0)
      for (let i = 0; i < 366 && date <= endDay; i += 1) {
        const key = keyOf(date)
        const list = map.get(key) ?? []
        list.push({ ...entry, start, end })
        map.set(key, list)
        date.setDate(date.getDate() + 1)
      }
    }

    const visit = (node: TaskNode, root: TaskNode, trail: string[]) => {
      rootOf.set(node.task.id, root.task.id)
      if (!node.isContainer) {
        add(node.startDate, node.endDate, {
          id: node.task.id,
          title: node.task.title,
          desc: node.task.desc,
          rootId: root.task.id,
          rootTitle: root.task.title,
          // 分组标题已经是根任务，路径里不再重复它，只留中间层级
          path: trail.slice(1).join(' / '),
          complete: node.complete,
        })
        return
      }
      node.children.forEach((child) => visit(child, root, [...trail, node.task.title]))
    }

    roots.forEach((root) => visit(root, root, []))
    return { planMap: map, rootOfTask: rootOf }
  }, [roots])

  const plansFor = (key: string): PlanEntry[] => planMap.get(key) ?? []

  /** 顶层任务 id → 手动颜色；子任务/未指定一律灰 */
  const rootColor = useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const root of roots) map.set(root.task.id, root.task.color)
    return map
  }, [roots])

  const colorOfRoot = (rootId: string): string =>
    displayTaskColor(rootColor.get(rootId))

  const habitColor = useMemo(
    () => new Map(habits.map((node) => [node.habit.id, node.habit.color])),
    [habits],
  )

  const colorOfTask = (taskId: string): string =>
    habitColor.has(taskId)
      ? displayTaskColor(habitColor.get(taskId))
      : colorOfRoot(rootOfTask.get(taskId) ?? taskId)

  const habitDayMap = useMemo(() => {
    const map = new Map<string, Map<string, { id: string; name: string; count: number }>>()
    for (const node of habits) {
      for (const log of node.logs) {
        if (!log.success) continue
        const key = keyOf(log.time)
        let day = map.get(key)
        if (!day) {
          day = new Map()
          map.set(key, day)
        }
        const row = day.get(node.habit.id) ?? { id: node.habit.id, name: node.habit.name, count: 0 }
        row.count += 1
        day.set(node.habit.id, row)
      }
    }
    return map
  }, [habits])

  const sessionDayMap = useMemo(() => {
    const map = new Map<string, FocusSession[]>()
    for (const session of sessions) {
      const key = keyOf(session.start)
      const list = map.get(key) ?? []
      list.push(session)
      map.set(key, list)
    }
    for (const list of map.values()) list.sort((a, b) => a.start - b.start)
    return map
  }, [sessions])

  const colorOfSession = (session: FocusSession): string => {
    // 未归属固定灰；习惯用自己手选的颜色；任务色跟随顶层任务
    if (session.task.type === 0) return UNSET_TASK_COLOR
    if (session.task.type === 1) return displayTaskColor(habitColor.get(session.task.id))
    return colorOfTask(session.task.id)
  }

  const focusOfDay = (key: string): { count: number; seconds: number } => {
    const stat = statisticOfDay(statistics, liveSummary, dateFromKey(key), now)
    return { count: stat?.pomodoroCount ?? 0, seconds: stat?.pomodoroTime ?? 0 }
  }

  const focusTasksOf = (key: string): { id: string; name: string; seconds: number }[] => {
    const stat = statisticOfDay(statistics, liveSummary, dateFromKey(key), now)
    return (stat?.tasks ?? []).map((task) => ({
      id: task.id,
      name: task.name,
      seconds: task.value,
    }))
  }

  const todayKey = keyOf(now)
  /**
   * 日视图这一天的全部数据，一次性算成 DayDetail 交给 DayBoard 铺卡片。
   *
   * 口径和「月视图点某天的弹窗」完全一致（专注 / 按任务时长 / 会话 / 习惯 / 计划分组），
   * 两个地方看同一天看到的是同一份东西，不会各算各的。
   */
  const boardDetail = useMemo<DayDetail>(() => {
    const date = dayOf(dayCursor)
    const key = keyOf(date)
    const context = dayContextOf(date)
    const plans = plansFor(key)
    const habitRows = habits.map((node) => {
      const executed = habitDayMap.get(key)?.get(node.habit.id)?.count ?? 0
      return {
        id: node.habit.id,
        name: node.habit.name,
        due: isHabitDue(node.habit, date, context),
        executed,
      }
    })
    return {
      date,
      key,
      todayKey,
      isToday: key === todayKey,
      holiday: holidayOf(date),
      focus: focusOfDay(key),
      tasks: focusTasksOf(key).map((task) => ({
        ...task,
        color: colorOfTask(task.id),
      })),
      sessions: sessionDayMap.get(key) ?? [],
      habits: {
        due: habitRows.filter((habit) => habit.due).length,
        // 和「已做」文案同一口径：只数该做且当天做过的，额外做的不进这个数
        doneDue: habitRows.filter((habit) => habitDayState(habit.due, habit.executed) === 'done')
          .length,
        // 当天的执行记录仍全量列出：先列当天该做的，再列额外做的，组内按次数降序
        done: habitRows
          .filter((habit) => habit.executed > 0)
          .sort((a, b) => {
            if (a.due !== b.due) return a.due ? -1 : 1
            return b.executed - a.executed
          })
          .map((habit) => ({
            id: habit.id,
            name: habit.name,
            count: habit.executed,
            extra: !habit.due,
          })),
        pending: habitRows.filter((habit) => habitDayState(habit.due, habit.executed) === 'pending'),
      },
      planGroups: groupPlans(plans),
      planDone: plans.filter((plan) => plan.complete).length,
      planTotal: plans.length,
      colorOfSession,
      colorOfRoot,
      onJumpTask: (taskId) => jumpTo(habitColor.has(taskId) ? 'habit' : 'task', taskId),
      onJumpHabit: (habitId) => jumpTo('habit', habitId),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayCursor, todayKey, planMap, habitDayMap, habits, habitColor, sessionDayMap, rootOfTask])

  // 节假日表按年懒加载：翻到哪一年就补哪一年，历史年份也能显示休/班
  useEffect(() => {
    const years = new Set<number>([monthCursor.year, dayCursor.getFullYear(), yearCursor])
    if (view === 'month') {
      const first = new Date(monthCursor.year, monthCursor.month, 1)
      const start = new Date(monthCursor.year, monthCursor.month, 1 - ((first.getDay() + 6) % 7))
      const end = new Date(start)
      end.setDate(start.getDate() + 41)
      years.add(start.getFullYear())
      years.add(end.getFullYear())
    }
    for (const year of years) void ensureHolidayYear(year)
  }, [view, monthCursor, dayCursor, yearCursor])

  const monthCells = useMemo(() => {
    const first = new Date(monthCursor.year, monthCursor.month, 1)
    const leading = (first.getDay() + 6) % 7
    const start = new Date(monthCursor.year, monthCursor.month, 1 - leading)
    // 固定 6 行：不会因为月份周数不同而改变整体高度
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const key = keyOf(date)
      const inMonth = date.getFullYear() === monthCursor.year && date.getMonth() === monthCursor.month
      if (!inMonth) {
        return {
          date,
          key,
          inMonth,
          plans: [] as PlanEntry[],
          count: 0,
          seconds: 0,
          holiday: holidayOf(date),
          habitCount: 0,
        }
      }
      const focus = focusOfDay(key)
      return {
        date,
        key,
        inMonth,
        plans: plansFor(key),
        count: focus.count,
        seconds: focus.seconds,
        holiday: holidayOf(date),
        habitCount: [...(habitDayMap.get(key)?.values() ?? [])].reduce((sum, row) => sum + row.count, 0),
      }
    })
  }, [monthCursor, statistics, liveSummary, planMap, habitDayMap, now])

  const monthTotal = useMemo(() => {
    const taskIds = new Set<string>()
    const doneIds = new Set<string>()
    let count = 0
    let seconds = 0
    let planDays = 0
    for (const cell of monthCells) {
      if (!cell.inMonth) continue
      count += cell.count
      seconds += cell.seconds
      if (cell.plans.length > 0) planDays += 1
      for (const plan of cell.plans) {
        taskIds.add(plan.id)
        if (plan.complete) doneIds.add(plan.id)
      }
    }
    return { count, seconds, planDone: doneIds.size, planTotal: taskIds.size, planDays }
  }, [monthCells])

  const yearMonths = useMemo(() => {
    const year = yearCursor
    const counts = Array.from({ length: 12 }, () => 0)
    const seconds = Array.from({ length: 12 }, () => 0)
    const active = Array.from({ length: 12 }, () => new Set<string>())
    const planTaskIds = Array.from({ length: 12 }, () => new Set<string>())
    const planDoneIds = Array.from({ length: 12 }, () => new Set<string>())
    const planDays = Array.from({ length: 12 }, () => 0)
    const todayKey = keyOf(now)

    for (const record of statistics) {
      if (record.year !== String(year)) continue
      const index = Number(record.month) - 1
      if (index < 0 || index >= 12) continue
      counts[index] = (counts[index] ?? 0) + (record.pomodoroCount || 0)
      seconds[index] = (seconds[index] ?? 0) + (record.pomodoroTime || 0)
      if ((record.pomodoroTime || 0) > 0) {
        active[index]!.add(`${record.year}-${record.month}-${record.day}`)
      }
    }

    if (year === nowYear && keyOf(liveSummary.update) === todayKey) {
      const index = nowMonth
      const archivedToday = statistics.some(
        (record) => `${record.year}-${record.month}-${record.day}` === todayKey,
      )
      if (!archivedToday) {
        counts[index] = (counts[index] ?? 0) + liveSummary.todayPomodoro
        seconds[index] = (seconds[index] ?? 0) + liveSummary.todayTime
      }
      if (liveSummary.todayTime > 0) active[index]!.add(todayKey)
    }

    const prefix = `${year}-`
    for (const [key, list] of planMap) {
      if (!key.startsWith(prefix)) continue
      const index = Number(key.slice(5, 7)) - 1
      if (index < 0 || index >= 12) continue
      planDays[index] = (planDays[index] ?? 0) + 1
      for (const plan of list) {
        planTaskIds[index]!.add(plan.id)
        if (plan.complete) planDoneIds[index]!.add(plan.id)
      }
    }

    return Array.from({ length: 12 }, (_, month) => ({
      month,
      count: counts[month] ?? 0,
      seconds: seconds[month] ?? 0,
      activeDays: active[month]!.size,
      planCount: planTaskIds[month]!.size,
      planDone: planDoneIds[month]!.size,
      planDays: planDays[month] ?? 0,
    }))
  }, [yearCursor, statistics, liveSummary, planMap, now, nowYear, nowMonth])

  const yearPlanTotals = useMemo(() => {
    const ids = new Set<string>()
    const done = new Set<string>()
    const prefix = `${yearCursor}-`
    for (const [key, list] of planMap) {
      if (!key.startsWith(prefix)) continue
      for (const plan of list) {
        ids.add(plan.id)
        if (plan.complete) done.add(plan.id)
      }
    }
    return { planDone: done.size, planTotal: ids.size }
  }, [planMap, yearCursor])

  const yearTotal = useMemo(() => {
    const base = yearMonths.reduce(
      (acc, item) => ({
        count: acc.count + item.count,
        seconds: acc.seconds + item.seconds,
        activeDays: acc.activeDays + item.activeDays,
        planDays: acc.planDays + item.planDays,
      }),
      { count: 0, seconds: 0, activeDays: 0, planDays: 0 },
    )
    return { ...base, ...yearPlanTotals }
  }, [yearMonths, yearPlanTotals])

  const cursorKey = keyOf(dayCursor)

  /** 日视图顶部那行汇总：就是这一天的数 */
  const rangeTotal = useMemo(() => {
    const plans = plansFor(cursorKey)
    return {
      count: boardDetail.focus.count,
      seconds: boardDetail.focus.seconds,
      planDone: plans.filter((plan) => plan.complete).length,
      planTotal: plans.length,
    }
  }, [boardDetail, cursorKey, planMap])

  /** 单箭头：只动当前视图自己的游标 */
  const shift = (delta: number) => {
    if (view === 'year') {
      setYearCursor((prev) => prev + delta)
      return
    }
    if (view === 'month') {
      setMonthCursor((prev) => {
        const next = new Date(prev.year, prev.month + delta, 1)
        return { year: next.getFullYear(), month: next.getMonth() }
      })
      return
    }
    setDayCursor((prev) => {
      const next = dayOf(prev)
      next.setDate(next.getDate() + delta)
      return next
    })
  }

  /**
   * 双箭头＝「跨一级」，而不是固定跨一年：
   * - 月视图 → 跨一年（一格格点 12 次太累）；
   * - 日视图 → 跨一个月（日视图里跳一年没意义，跳一个月才是常用的翻法）。
   * 年视图没有这颗按钮，走不进来。
   */
  const shiftBig = (delta: number) => {
    if (view === 'month') {
      setMonthCursor((prev) => ({ ...prev, year: prev.year + delta }))
      return
    }
    setDayCursor((prev) => {
      // 保留「几号」：31 号跳到只有 30 天的月份时夹到月末，不让他凭空变成下月 1 号
      const target = new Date(prev.getFullYear(), prev.getMonth() + delta, 1)
      const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      return new Date(target.getFullYear(), target.getMonth(), Math.min(prev.getDate(), lastDay))
    })
  }

  /** ↻ 只重置**当前视图**：日回今天、月回本月、年回今年，另外两个视图不动 */
  const goToday = () => {
    if (view === 'year') setYearCursor(nowYear)
    else if (view === 'month') setMonthCursor({ year: nowYear, month: nowMonth })
    else setDayCursor(dayOf(now))
  }

  const resetLabel = view === 'month' ? '回到本月' : view === 'year' ? '回到今年' : '回到今天'

  const changeView = (next: CalendarView) => {
    if (next === view) return
    // 不再把当前视图的日期同步给另一个视图：三份游标各管各的
    lastCalendarView = next
    setView(next)
  }

  const selectedDate = selected ? dateFromKey(selected) : null
  const selectedContext = selectedDate ? dayContextOf(selectedDate) : null
  const selectedFocus = selected ? focusOfDay(selected) : { count: 0, seconds: 0 }
  const selectedTasks = selected ? focusTasksOf(selected) : []
  // 和日视图「时间分布」同一口径：按耗时降序、占比以当天总时长为分母
  const selectedTasksRanked = [...selectedTasks].sort((a, b) => b.seconds - a.seconds)
  const selectedTaskTotal = selectedFocus.seconds || 1
  const selectedSessions = sessionDayMap.get(selected ?? '') ?? []
  const selectedPlans = selected ? plansFor(selected) : []
  const selectedGroups = useMemo(() => groupPlans(selectedPlans), [selected, planMap])
  const selectedHabits = selected
    ? habits.map((node) => {
        const executed = habitDayMap.get(selected)?.get(node.habit.id)?.count ?? 0
        return {
          id: node.habit.id,
          name: node.habit.name,
          due: selectedDate && selectedContext ? isHabitDue(node.habit, selectedDate, selectedContext) : false,
          executed,
        }
      })
    : []
  const dueHabits = selectedHabits.filter((habit) => habit.due)
  const pendingHabits = selectedHabits.filter(
    (habit) => habitDayState(habit.due, habit.executed) === 'pending',
  )
  // 当天的执行记录：先列当天该做的，再列额外做的，组内按次数降序（口径与日视图一致）
  const executedHabits = selected
    ? selectedHabits
        .filter((habit) => habit.executed > 0)
        .sort((a, b) => {
          if (a.due !== b.due) return a.due ? -1 : 1
          return b.executed - a.executed
        })
    : []
  const selectedHoliday = selectedDate ? holidayOf(selectedDate) : null
  // 弹窗里的条目跳转：先关弹窗再切页签，否则切了页签它还浮在上面
  const jumpFromDialog = (kind: 'task' | 'habit', id: string) => {
    setSelected(null)
    jumpTo(kind, id)
  }
  /** 弹窗标题右侧的日历图标：回到对应那天的日视图 */
  const openSelectedDayView = () => {
    if (!selectedDate) return
    setSelected(null)
    setDayCursor(dayOf(selectedDate))
    changeView('day')
  }

  return (
    <div
      className={cn(
        'glass mx-auto w-full min-h-0 max-w-[800px] rounded-panel p-4',
        view !== 'year' && 'flex flex-1 flex-col',
      )}
    >
      {/* 头部：左边回答「这是哪一天」，右边是翻页与视图切换。
          日视图用大号日号 + 星期 / 今天 / 当天汇总，不套底框；
          卡片区因此省下一行高度给习惯与任务。

          【高度锁成 80px】三种视图共用同一个 80px 头部；
          如果让头部随内容变高，右上那组「翻页 + 日月年」就会在切视图时上下跳。
          所以按钮的横纵位置都固定。 */}
      <div className="flex min-h-[80px] items-center justify-between gap-3">
        {view === 'day' ? (
          <div className="flex min-w-0 items-stretch gap-3">
            {/* 开放式日期：大号日号 | 星期 + 汇总两行；竖线与右侧两行上下对齐 */}
            <span className="flex shrink-0 items-center text-[60px] font-semibold leading-[44px] tabular-nums text-foreground">
              {String(dayCursor.getDate()).padStart(2, '0')}
            </span>
            <span className="w-px shrink-0 self-stretch bg-foreground/25" aria-hidden />
            <div className="flex min-w-0 flex-col justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[19px] font-semibold leading-none text-foreground">
                  {weekdayLabel(dayCursor)}
                </span>
                {boardDetail.isToday ? (
                  <span className="rounded-[4px] bg-sidebar-accent px-1.5 py-0.5 text-[10px] leading-none text-sidebar-accent-foreground">
                    今天
                  </span>
                ) : null}
                {boardDetail.holiday === 'holiday' ? (
                  <span className="text-[10.5px] font-semibold leading-none text-destructive">休</span>
                ) : null}
                {boardDetail.holiday === 'workday' ? (
                  <span className="text-[10.5px] font-semibold leading-none text-primary">班</span>
                ) : null}
              </div>
              <p className="mt-2 flex min-w-0 items-center gap-2 text-[10.5px] leading-4 text-muted-foreground">
                <span className="shrink-0 tabular-nums">
                  {dayCursor.getMonth() + 1} 月 {dayCursor.getFullYear()}
                </span>
                <span aria-hidden className="h-3 w-px shrink-0 bg-foreground/20" />
                <span className="min-w-0 truncate tabular-nums">
                  <Num value={rangeTotal.count} /> 番茄 ·{' '}
                  <Num value={Math.round(rangeTotal.seconds / 60)} /> 分钟 · 任务{' '}
                  <Num value={rangeTotal.planDone} />/<Num value={rangeTotal.planTotal} />
                </span>
              </p>
            </div>
          </div>
        ) : (
          /* 报头式排法：一行大字「月份 ｜ 年份」，下面一行摊开全部统计。
             不做方砖 —— 方砖是「某一天」的量具，月份/年份是跨度，搬过来只会空占一块。
             月份用 26px 扛住整个头部的重量，年份跟在一条竖发丝线后面，字号小但独立成段，
             一眼能分清哪个是月、哪个是年。 */
          <div className="min-w-0">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                {view === 'year' ? yearCursor : `${monthCursor.month + 1} 月`}
              </span>
              {view === 'year' ? null : (
                <>
                  <span className="h-3 w-px shrink-0 bg-foreground/25" aria-hidden />
                  <span className="text-[12px] font-medium leading-none tracking-[0.16em] tabular-nums text-muted-foreground">
                    {monthCursor.year} 年
                  </span>
                </>
              )}
            </div>
            <p className="mt-2 truncate text-[11.5px] text-muted-foreground">
              {view === 'year' ? (
                <>
                  <Num value={yearTotal.count} /> 番茄 · <Num value={yearTotal.activeDays} /> 天有专注 ·{' '}
                  <Num value={Math.round(yearTotal.seconds / 60)} /> 分钟 · 任务{' '}
                  <Num value={yearTotal.planDone} />/<Num value={yearTotal.planTotal} /> ·{' '}
                  <Num value={yearTotal.planDays} /> 天有安排
                </>
              ) : (
                <>
                  <Num value={monthTotal.count} /> 番茄 ·{' '}
                  <Num value={Math.round(monthTotal.seconds / 60)} /> 分钟 · 任务{' '}
                  <Num value={monthTotal.planDone} />/<Num value={monthTotal.planTotal} /> ·{' '}
                  <Num value={monthTotal.planDays} /> 天有安排
                </>
              )}
            </p>
          </div>
        )}
        {/* 翻页与视图切换：所有视图都固定在右边同一组位置，切换视图时按钮不会乱跑 */}
        <div className="flex shrink-0 items-center gap-1">
          {view !== 'year' ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={view === 'month' ? '上一年' : '上个月'}
              title={view === 'month' ? '上一年' : '上个月'}
              onClick={() => shiftBig(-1)}
            >
              <ChevronsLeft className="size-4" aria-hidden />
            </Button>
          ) : null}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={view === 'year' ? '上一年' : view === 'month' ? '上个月' : '前一天'}
            onClick={() => shift(-1)}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={view === 'year' ? '下一年' : view === 'month' ? '下个月' : '后一天'}
            onClick={() => shift(1)}
          >
            <ChevronRight className="size-4" aria-hidden />
          </Button>
          {view !== 'year' ? (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={view === 'month' ? '下一年' : '下个月'}
              title={view === 'month' ? '下一年' : '下个月'}
              onClick={() => shiftBig(1)}
            >
              <ChevronsRight className="size-4" aria-hidden />
            </Button>
          ) : null}
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={resetLabel}
            title={resetLabel}
            onClick={goToday}
          >
            <RotateCcw className="size-4" aria-hidden />
          </Button>
          <SlidingSegmented
            options={VIEW_OPTIONS}
            value={view}
            onValueChange={changeView}
            ariaLabel="日历视图"
            className="ml-2"
          />
        </div>
      </div>

      {view === 'month' ? (
        <div className="mt-3 flex flex-1 flex-col">
          <div className="grid grid-cols-7 pb-1.5">
            {['一', '二', '三', '四', '五', '六', '日'].map((label) => (
              <span key={label} className="text-center text-[10.5px] text-muted-foreground">
                {label}
              </span>
            ))}
          </div>

          <div className="grid min-h-[360px] flex-1 grid-cols-7 grid-rows-6 gap-px overflow-hidden rounded-lg border-2 border-primary/70 bg-primary/20">
            {monthCells.map((cell) => {
              // 非本月：只做占位说明（几号、哪个月），点不动、也没有悬停反应。
              // 以前它是个按钮，还能点开那天的弹窗 —— 翻月才是切到那个月的正路，
              // 从别月格子点进去既容易误触，弹出来的也不是当前月视图该有的东西。
              if (!cell.inMonth) {
                return (
                  <div
                    key={cell.key}
                    className="relative flex flex-col bg-[var(--card-surface)] px-2.5 pt-1.5 text-left"
                  >
                    <span className="flex w-full items-start justify-between gap-1">
                      <span className="text-[15px] font-medium leading-none tabular-nums text-muted-foreground/35">
                        {cell.date.getDate()}
                      </span>
                      {cell.holiday ? (
                        <span
                          className={cn(
                            'shrink-0 text-[9px] font-semibold leading-none',
                            cell.holiday === 'holiday' ? 'text-destructive/60' : 'text-primary/60',
                          )}
                          aria-hidden
                        >
                          {cell.holiday === 'holiday' ? '休' : '班'}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 text-[9px] text-muted-foreground/30">
                      {cell.date.getMonth() + 1} 月
                    </span>
                  </div>
                )
              }
              const planDone = cell.plans.filter((plan) => plan.complete).length
              const overdue = cell.key < todayKey && cell.plans.some((plan) => !plan.complete)
              const isToday = cell.key === todayKey
              const hasFocus = cell.count > 0 || cell.seconds > 0
              const focusMinutes = Math.max(1, Math.round(cell.seconds / 60))

              return (
                <button
                  type="button"
                  key={cell.key}
                  onClick={() => setSelected(cell.key)}
                  className="group relative flex min-h-0 cursor-pointer flex-col overflow-hidden bg-[var(--card-surface)] px-2.5 pt-1.5 text-left outline-none transition-colors hover:bg-primary/[0.05] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40"
                  title={`${cell.date.getFullYear()}/${cell.date.getMonth() + 1}/${cell.date.getDate()} · ${cell.count} 个番茄 · ${Math.round(cell.seconds / 60)} 分钟 · ${cell.plans.length} 个任务（完成 ${planDone}）${cell.habitCount > 0 ? ` · ${cell.habitCount} 次习惯` : ''}${overdue ? ' · 有逾期' : ''}`}
                >
                  <span className="flex w-full items-start justify-between gap-1">
                    <span className="flex min-w-0 flex-col items-start">
                      <span
                        className={cn(
                          'text-[15px] font-semibold leading-none tabular-nums',
                          isToday ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {cell.date.getDate()}
                      </span>
                      {/* 今天：紧贴数字下缘的一块实心方条。
                          长度＝数字宽度（跟着这一列走，不额外加宽），
                          厚度 4.4px（5.5px × 0.8），像一枚压在日期下面的色块。 */}
                      {isToday ? <span className="h-[4.4px] w-full bg-primary" aria-hidden /> : null}
                    </span>
                    {cell.holiday ? (
                      <span
                        className={cn(
                          'shrink-0 text-[9px] font-semibold leading-none',
                          cell.holiday === 'holiday' ? 'text-destructive' : 'text-primary',
                        )}
                        aria-hidden
                      >
                        {cell.holiday === 'holiday' ? '休' : '班'}
                      </span>
                    ) : null}
                  </span>

                  <span className="mt-1 flex min-w-0 flex-col gap-0.5">
                    {hasFocus ? (
                      <span className="flex min-w-0 items-baseline gap-1">
                        <span className="shrink-0 text-[8.5px] leading-none text-muted-foreground/75">专注</span>
                        <span className="truncate text-[9.5px] leading-none tabular-nums text-foreground">
                          {cell.count}个/{focusMinutes}分钟
                        </span>
                      </span>
                    ) : null}
                    {cell.plans.length > 0 ? (
                      <span className="flex min-w-0 items-baseline gap-1">
                        <span
                          className={cn(
                            'shrink-0 text-[8.5px] leading-none',
                            overdue ? 'text-destructive/80' : 'text-muted-foreground/75',
                          )}
                        >
                          {overdue ? '任务·逾期' : '任务'}
                        </span>
                        <span
                          className={cn(
                            'truncate text-[9.5px] leading-none tabular-nums',
                            overdue ? 'text-destructive/90' : 'text-foreground',
                          )}
                        >
                          {planDone}/{cell.plans.length}
                        </span>
                      </span>
                    ) : null}
                    {cell.habitCount > 0 ? (
                      <span className="flex min-w-0 items-baseline gap-1">
                        <span className="shrink-0 text-[8.5px] leading-none text-muted-foreground/75">习惯</span>
                        <span className="truncate text-[9.5px] leading-none tabular-nums text-foreground">
                          {cell.habitCount}次
                        </span>
                      </span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>

        </div>
      ) : view === 'year' ? (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {yearMonths.map((month) => {
            const isCurrent = yearCursor === nowYear && month.month === nowMonth
            return (
              <button
                key={month.month}
                type="button"
                onClick={() => {
                  setMonthCursor({ year: yearCursor, month: month.month })
                  lastCalendarView = 'month'
                  setView('month')
                }}
                className={cn(
                  // 底一律是卡片本色，不给本月单独染色 —— 半透明深底压在抹茶上会发灰发脏。
                  // 本月靠「更粗的主色描边」区分：1.5px，同时把内边距减 0.5px，尺寸分毫不动。
                  'rounded-panel bg-[var(--card-surface)] text-left transition-[border-color,box-shadow] duration-150',
                  isCurrent
                    ? 'border-[1.5px] border-primary p-[11.5px] hover:ring-2 hover:ring-primary/20'
                    : 'border border-[var(--card-edge)] px-3 py-2.5 hover:border-primary/50 hover:ring-1 hover:ring-primary/15',
                )}
              >
                <div
                  className={cn(
                    'flex items-baseline justify-between gap-2 border-b pb-1.5',
                    isCurrent ? 'border-primary/25' : 'border-foreground/12',
                  )}
                >
                  <span
                    className={cn(
                      'text-[13px] font-semibold leading-none',
                      isCurrent ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {month.month + 1} 月
                  </span>
                  {isCurrent ? (
                    <span className="rounded-full bg-primary/10 px-1.5 py-[2px] text-[9.5px] font-medium leading-none tracking-[0.12em] text-primary">
                      本月
                    </span>
                  ) : null}
                </div>
                {/* 固定三行，每行定高 + 不换行：
                    以前把三个指标塞一段、两个指标塞一段，数字一长（141 番茄 / 3816 分钟）
                    就折成四行，卡片高度跟着内容跳。现在行长固定，超长一律省略号。
                    ① 番茄数（大号）+ 右侧小字「N 分钟」——两个投入量放一行
                    ② 「N 天有专注」——频率单独一行
                    ③ 计划任务完成度 + 多少天有安排（整月没安排时这句顶掉它） */}
                <div className="mt-2 flex flex-col gap-0.5">
                  <p className="flex h-[18px] items-baseline gap-1.5 whitespace-nowrap">
                    <span className="font-mono text-[15px] font-semibold leading-none tabular-nums text-foreground">
                      {month.count}
                    </span>
                    <span className="text-[10.5px] leading-[16px] text-muted-foreground">番茄</span>
                    <span className="ml-auto truncate text-[10.5px] leading-[16px] text-muted-foreground">
                      <span className="font-mono tabular-nums text-foreground">
                        {Math.round(month.seconds / 60)}
                      </span>{' '}
                      分钟
                    </span>
                  </p>
                  <p className="h-4 truncate text-[10.5px] leading-[16px] text-muted-foreground">
                    <span className="font-mono tabular-nums text-foreground">{month.activeDays}</span> 天有专注
                  </p>
                  <p className="h-4 truncate text-[10.5px] leading-[16px] text-muted-foreground">
                    {month.count === 0 && month.planCount === 0 ? (
                      <span className="text-muted-foreground/70">这个月还没有安排</span>
                    ) : (
                      <>
                        任务{' '}
                        <span className="font-mono tabular-nums text-foreground">
                          {month.planDone}/{month.planCount}
                        </span>{' '}
                        · <span className="font-mono tabular-nums text-foreground">{month.planDays}</span> 天有安排
                      </>
                    )}
                  </p>
                </div>
                {/* 进度条常驻（没计划时是空轨道）：有它没它不该让卡片高度变一下 */}
                {/* 空轨道压到 6%：12 个空格子上的灰条原来太抢眼，整屏像有一排被划掉的条目 */}
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{
                      width: `${month.planCount > 0 ? Math.round((month.planDone / month.planCount) * 100) : 0}%`,
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      ) : (
        // 日视图：四张卡（时间分布 / 习惯 / 会话明细 / 任务）
        <DayBoard detail={boardDetail} />
      )}

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-[520px]">
          <DialogHeader>
            <div className="flex items-center gap-2 pr-7">
              <button
                type="button"
                onClick={openSelectedDayView}
                title="在日视图中查看这一天"
                aria-label="在日视图中查看这一天"
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                <CalendarDays className="size-4" aria-hidden />
              </button>
              <DialogTitle className="min-w-0 truncate text-[15px]">
                {selectedDate
                  ? `${selectedDate.getFullYear()} 年 ${selectedDate.getMonth() + 1} 月 ${selectedDate.getDate()} 日 · ${weekdayLabel(selectedDate)}`
                  : ''}
              </DialogTitle>
              {selected === todayKey ? (
                <span className="shrink-0 rounded-[4px] bg-sidebar-accent px-1.5 py-0.5 text-[10px] leading-none text-sidebar-accent-foreground">
                  今天
                </span>
              ) : null}
            </div>
          </DialogHeader>

          <div className="flex max-h-[520px] flex-col gap-3 overflow-y-auto px-1 py-1 scroll-thin">
            {selectedHoliday ? (
              <p className="text-[10.5px] text-muted-foreground">
                {selectedHoliday === 'holiday' ? '法定节假日' : '调休补班'}
              </p>
            ) : null}

            <section>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-[12px] font-semibold text-foreground">专注</p>
                {selectedFocus.count > 0 || selectedFocus.seconds > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-mono tabular-nums text-foreground">{selectedFocus.count}</span> 个番茄 ·{' '}
                    {minutesText(selectedFocus.seconds)}
                  </p>
                ) : null}
              </div>

              {selectedTasksRanked.length > 0 ? (
                <>
                  {/* 与日视图「时间分布」同一条 100% 堆叠条 */}
                  <div className="mt-1.5 flex h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-foreground/8">
                    {selectedTasksRanked.map((task) => (
                      <span
                        key={task.id}
                        className="h-full"
                        style={{
                          width: `${(task.seconds / selectedTaskTotal) * 100}%`,
                          background: colorOfTask(task.id),
                        }}
                        aria-hidden
                      />
                    ))}
                  </div>
                  <div className="mt-1.5 flex flex-col">
                    {selectedTasksRanked.map((task) => {
                      const color = colorOfTask(task.id)
                      const percent = Math.round((task.seconds / selectedTaskTotal) * 100)
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-2 rounded-[4px] px-0.5 leading-[18px]"
                        >
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ background: color }}
                            aria-hidden
                          />
                          <button
                            type="button"
                            onClick={() => jumpFromDialog('task', task.id)}
                            title={`打开任务：${task.name} · ${minutesShort(task.seconds)} · 占 ${percent}%`}
                            className="min-w-0 cursor-pointer truncate rounded-[4px] text-left text-[10.5px] text-foreground/85 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                          >
                            {task.name}
                          </button>
                          <span className="ml-auto w-[34px] shrink-0 text-right font-mono text-[9.5px] tabular-nums text-muted-foreground/70">
                            {minutesShort(task.seconds)}
                          </span>
                          <span className="w-[32px] shrink-0 text-right font-mono text-[10px] font-medium tabular-nums text-foreground">
                            {percent}%
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : selectedFocus.count > 0 || selectedFocus.seconds > 0 ? null : (
                <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                  当天没有专注记录
                </p>
              )}

              {selectedSessions.length > 0 ? (
                <div className="mt-2.5 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10.5px] font-medium text-muted-foreground">会话明细</p>
                    <span className="text-[9.5px] text-muted-foreground/70">{selectedSessions.length} 段</span>
                  </div>
                  {selectedSessions.map((session) => {
                    const start = new Date(session.start)
                    const end = new Date(session.end)
                    return (
                      <div
                        key={session.id}
                        className="flex items-center gap-2 rounded-md bg-foreground/[0.03] px-2 py-1.5"
                      >
                        <span className="w-[86px] shrink-0 font-mono text-[9.5px] tabular-nums text-muted-foreground">
                          {clockText(start.getHours() * 60 + start.getMinutes())}–
                          {clockText(end.getHours() * 60 + end.getMinutes())}
                        </span>
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: colorOfSession(session) }}
                          aria-hidden
                        />
                        <button
                          type="button"
                          onClick={() => jumpFromDialog('task', session.task.id)}
                          title={`打开任务：${session.task.name}`}
                          className="min-w-0 cursor-pointer truncate rounded-[4px] text-left text-[11px] text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                        >
                          {session.task.name}
                        </button>
                        <span className="ml-auto shrink-0 font-mono text-[9.5px] tabular-nums text-muted-foreground">
                          {Math.max(1, Math.round(session.seconds / 60))}m
                        </span>
                        <Badge
                          variant={session.completed ? 'secondary' : 'outline'}
                          className="shrink-0 text-[9px]"
                        >
                          {session.completed ? '完成' : '停止'}
                        </Badge>
                      </div>
                    )
                  })}
                </div>
              ) : selectedFocus.count > 0 || selectedFocus.seconds > 0 ? (
                <p className="mt-1.5 text-[10px] text-muted-foreground/60">这一天只有日汇总，没有会话明细</p>
              ) : null}
            </section>

            {dueHabits.length > 0 || executedHabits.length > 0 ? (
              <section>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[12px] font-semibold text-foreground">习惯</p>
                  <p className="text-[10.5px] text-muted-foreground">
                    该做 {dueHabits.length} 个 · 已做{' '}
                    {dueHabits.filter((habit) => habitDayState(habit.due, habit.executed) === 'done').length} 个
                  </p>
                </div>
                {pendingHabits.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {pendingHabits.map((habit) => (
                      <button
                        key={habit.id}
                        type="button"
                        onClick={() => jumpFromDialog('habit', habit.id)}
                        title={`打开习惯：${habit.name}`}
                        className="max-w-full cursor-pointer truncate rounded-md border border-foreground/10 px-2 py-1 text-[10.5px] text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:bg-primary/[0.08] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                      >
                        {habit.name}
                      </button>
                    ))}
                  </div>
                ) : null}
                {executedHabits.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {executedHabits.map((habit) => {
                      const extra = !habit.due
                      return (
                        <button
                          key={habit.id}
                          type="button"
                          onClick={() => jumpFromDialog('habit', habit.id)}
                          title={
                            extra
                              ? `打开习惯：${habit.name}（当天不在执行日，额外完成 ${habit.executed} 次）`
                              : `打开习惯：${habit.name}`
                          }
                          className={cn(
                            'flex max-w-full cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-[11px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40',
                            extra
                              ? 'border border-dashed border-foreground/20 text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                              : 'bg-primary/[0.09] text-foreground hover:bg-primary/[0.16]',
                          )}
                        >
                          <Check
                            className={cn(
                              'size-3 shrink-0',
                              extra ? 'text-muted-foreground/70' : 'text-primary',
                            )}
                            aria-hidden
                          />
                          <span className="truncate">{habit.name}</span>
                          <span
                            className={cn(
                              'shrink-0 rounded-full px-1.5 font-mono text-[9.5px] tabular-nums',
                              extra
                                ? 'bg-foreground/8 text-muted-foreground'
                                : 'bg-primary/15 text-primary',
                            )}
                          >
                            ×{habit.executed}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section>
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[12px] font-semibold text-foreground">任务</p>
                {selectedPlans.length > 0 ? (
                  <span className="text-[10.5px] text-muted-foreground">
                    {selectedPlans.filter((plan) => plan.complete).length}/{selectedPlans.length} 已完成
                  </span>
                ) : null}
              </div>

              {selectedGroups.length > 0 ? (
                <div className="mt-1.5 flex flex-col gap-2">
                  {selectedGroups.map((group) => (
                    <PlanGroupView
                      key={`${selected}-${group.rootId}`}
                      group={group}
                      selectedKey={selected ?? ''}
                      todayKey={todayKey}
                      color={colorOfRoot(group.rootId)}
                      onJump={(taskId) => jumpFromDialog('task', taskId)}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                  当天没有任务安排
                </p>
              )}
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Num({ value }: { value: number }) {
  return <span className="tabular-nums text-foreground">{value}</span>
}
