/**
 * 习惯详情：日历看“天”，明细看“次”。
 *
 * 所有“某天完成/缺失/请假”的判断都来自 HabitNode 的日记录；
 * 这里只负责展示与触发动作，不自己从日志推算日状态。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  List,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react'
import type { HabitDayRecord, HabitLog } from '@matcha-puff/pomodoro-core'
import type { HabitNode } from '@/lib/focus-data'
import {
  dayKeyToDate,
  habitCreatedDay,
  habitDayView,
  habitLogDay,
  habitLogSource,
  habitScheduleLabel,
  HABIT_RECORD_STATE_LABELS,
  localDayKey,
} from '@matcha-puff/pomodoro-core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { quadrantMetaOf } from '@/components/focus/quadrants'
import { displayTaskColor } from '@/components/focus/calendar-utils'
import {
  HABIT_DONE_CHIP,
  HABIT_EXCUSED_CHIP,
  HABIT_FUTURE_CHIP,
  HABIT_MISSED_CHIP,
  habitDayChipClass,
} from '@/components/focus/habit-status'
import { cn } from 'cn'
import { dayContextOf } from '@/lib/workday'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

type Tab = 'calendar' | 'list'

/** 固定 42 格；跨月的格子也返回真实日期，整张表是连续、可点击的日历 */
function monthCells(year: number, month: number): Date[] {
  const first = new Date(year, month, 1)
  const leading = (first.getDay() + 6) % 7
  return Array.from({ length: 42 }, (_, index) => new Date(year, month, 1 - leading + index))
}

/** 同一天完成多次时补一个很轻的计数，不做勾叉之类的符号 */
function DayCount({ count }: { count: number }) {
  if (count <= 1) return null
  return (
    <span className="absolute bottom-1 right-[19px] text-[9px] font-semibold leading-none text-[#4f7c77]">
      ×{count}
    </span>
  )
}

/** 图例色块：与月历格里的色块、卡片 7 格条使用同一套样式 */
function LegendChip({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i className={cn('inline-flex size-3 rounded-[3px]', className)} />
      {label}
    </span>
  )
}

/** 实心状态徽章：日面板和明细时间轴共用同一套颜色 */
function stateSolidClass(state: string): string {
  if (state === 'done') return 'bg-[#74a39e] text-white'
  if (state === 'missed') return 'bg-[#b58a98] text-white'
  if (state === 'excused') return 'bg-[#9c8aa6] text-white'
  if (state === 'pending' || state === 'future') return 'bg-[#7f94ae] text-white'
  return 'bg-foreground/8 text-muted-foreground'
}

/** 明细时间轴节点：圆点颜色与月历/7 格条一致（SVG 用真实色值） */
function stateDotColor(state?: string): string {
  if (state === 'done') return '#74a39e'
  if (state === 'missed') return '#b58a98'
  if (state === 'excused') return '#9c8aa6'
  if (state === 'pending') return '#7f94ae'
  return '#7f8480'
}

/** “待做”覆盖今天该做未做，以及未来的该做日 */
function stateText(state: string, due = false): string {
  if (state === 'pending') return '待做'
  if (state === 'off') return '休息 / 无记录'
  if (state === 'future') return due ? '待做' : '休息'
  return HABIT_RECORD_STATE_LABELS[state as HabitDayRecord['state']] ?? state
}

export function HabitDetailDialog({
  node,
  initialDay,
  onOpenChange,
  onCheckIn,
  onExcuse,
  onUndoManual,
  onDeleteLog,
  onSetDue,
  onOverrideDone,
  onClearOverride,
}: {
  node: HabitNode | null
  /** 从卡片 7 格条点进来时定位到那一天 */
  initialDay?: string
  onOpenChange: (open: boolean) => void
  onCheckIn: (habitId: string, day: string) => void | Promise<void>
  onExcuse: (habitId: string, day: string, excused: boolean) => void | Promise<void>
  onUndoManual: (habitId: string, day: string) => void | Promise<void>
  onDeleteLog: (logId: string) => void | Promise<void>
  /** 今天：把休息日临时改成该做（留下待完成） */
  onSetDue: (habitId: string, day: string) => void | Promise<void>
  /** 过去：把休息日临时改成该做并直接补记完成 */
  onOverrideDone: (habitId: string, day: string) => void | Promise<void>
  /** 撤销单日临时加做 */
  onClearOverride: (habitId: string, day: string) => void | Promise<void>
}) {
  const today = localDayKey(new Date())
  const baseDay = initialDay && initialDay <= today ? initialDay : today
  const [tab, setTab] = useState<Tab>('calendar')
  const [month, setMonth] = useState(() => {
    const date = dayKeyToDate(baseDay)
    return { year: date.getFullYear(), month: date.getMonth() }
  })
  const [selectedDay, setSelectedDay] = useState(baseDay)
  const [confirmLog, setConfirmLog] = useState<string | null>(null)

  const habitId = node?.habit.id

  useEffect(() => {
    if (!node) return
    const date = dayKeyToDate(baseDay)
    setTab('calendar')
    setMonth({ year: date.getFullYear(), month: date.getMonth() })
    setSelectedDay(baseDay)
    setConfirmLog(null)
    // baseDay 由父组件在打开时传入；同一习惯重复打开也要回到那一天
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habitId, baseDay])

  const rowByDay = useMemo(() => {
    const map = new Map<string, HabitDayRecord>()
    for (const row of node?.days ?? []) map.set(row.day, row)
    return map
  }, [node])

  const cells = useMemo(
    () => monthCells(month.year, month.month),
    [month.year, month.month],
  )

  const selectedView = useMemo(() => {
    if (!node) return null
    return habitDayView({
      habit: node.habit,
      day: selectedDay,
      rows: node.days,
      logs: node.logs,
      now: new Date(),
      dayContextOf,
    })
  }, [node, selectedDay])

  const monthRate = useMemo(() => {
    if (!node) return 0
    const daysInMonth = new Date(month.year, month.month + 1, 0).getDate()
    let due = 0
    let done = 0
    for (let dayOfMonth = 1; dayOfMonth <= daysInMonth; dayOfMonth += 1) {
      const day = localDayKey(new Date(month.year, month.month, dayOfMonth))
      if (day > today) break
      const view = habitDayView({
        habit: node.habit,
        day,
        rows: node.days,
        logs: node.logs,
        now: new Date(),
        dayContextOf,
      })
      // 过去没有记录的该做日也算分母：未完成不能因为“没写过行”就被跳过
      if (!view.due || view.state === 'excused') continue
      due += 1
      if (view.state === 'done') done += 1
    }
    if (due === 0) return 0
    return Math.round((done / due) * 100)
  }, [node, month, today])

  const groupedLogs = useMemo(() => {
    const groups = new Map<string, HabitLog[]>()
    for (const log of node?.logs ?? []) {
      const day = habitLogDay(log)
      const list = groups.get(day)
      if (list) list.push(log)
      else groups.set(day, [log])
    }
    return [...groups.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([day, logs]) => ({
        day,
        logs: [...logs].sort((a, b) => b.time - a.time),
      }))
  }, [node])

  // 时间轴：线和圆点画在同一份 SVG、同一套坐标里。
  // 先量出每个节点的实际位置，再让一条连续 path 从第一个圆点连到最后一个圆点；
  // 圆点在 path 之后画，天然盖住两端，不依赖“刚好对齐”的像素运气。
  const timelineRef = useRef<HTMLOListElement | null>(null)
  const [timelineYs, setTimelineYs] = useState<number[]>([])

  useLayoutEffect(() => {
    if (tab !== 'list') {
      setTimelineYs([])
      return
    }
    const list = timelineRef.current
    if (!list) return
    const measure = () => {
      const items = list.querySelectorAll<HTMLLIElement>('[data-timeline-item]')
      setTimelineYs(Array.from(items, (item) => item.offsetTop + 8.5))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(list)
    return () => observer.disconnect()
  }, [tab, groupedLogs])

  if (!node) return null

  const view = selectedView
  const record = view ? rowByDay.get(view.day) : undefined
  const quadrant = quadrantMetaOf(node.habit.quadrant)
  const createdDay = habitCreatedDay(node.habit, new Date())
  const selectedDate = dayKeyToDate(selectedDay)
  const selectedLabel = `${selectedDate.getMonth() + 1} 月 ${selectedDate.getDate()} 日 · 周${WEEKDAY_LABELS[selectedDate.getDay()]}`

  const shiftMonth = (delta: number) => {
    const next = new Date(month.year, month.month + delta, 1)
    setMonth({ year: next.getFullYear(), month: next.getMonth() })
    const first = localDayKey(next)
    const nextToday = localDayKey(new Date())
    setSelectedDay(nextToday.startsWith(first.slice(0, 7)) ? nextToday : first)
  }

  /** 一键回到今天所在的月份并选中今天，与专注日历的 ↻ 同一套交互 */
  const goToday = () => {
    const now = new Date()
    setMonth({ year: now.getFullYear(), month: now.getMonth() })
    setSelectedDay(today)
  }

  // 请假日不直接补记：先取消请假，再决定补记，避免“请假+补记”叠在一起无法还原
  const canCheck = view?.state === 'pending' || view?.state === 'missed'
  // 未来该做日也可以提前请假：请掉以后到那天不会变成未完成
  const canExcuse =
    view?.state === 'pending' ||
    view?.state === 'missed' ||
    (view?.state === 'future' && view.due)
  const canUndoManual =
    view?.state === 'done' && (record?.manualCount ?? 0) > 0 && (record?.focusCount ?? 0) === 0
  /** 休息日：今天可以临时设为该做；过去可以临时加做并补记 */
  const canSetDue = !!view && view.state === 'off' && !view.due && view.isToday
  const canOverrideDone =
    !!view &&
    view.state === 'off' &&
    !view.due &&
    !view.isToday &&
    dayKeyToDate(view.day) < dayKeyToDate(today) &&
    view.day >= createdDay
  const canClearOverride =
    !!record?.manualDue && view?.state !== 'done'

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100vh-32px)] max-h-[760px] max-w-[660px] flex-col gap-3 overflow-hidden p-5 sm:max-w-[660px]">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex min-w-0 items-center gap-2 text-[16px]">
            {/* 与卡片同款的大圆点：15px，占位不额外撑高标题行 */}
            <span className="relative size-2.5 shrink-0" aria-hidden>
              <span
                className="absolute left-1/2 top-1/2 size-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-foreground/10"
                style={{ background: displayTaskColor(node.habit.color) }}
              />
            </span>
            <span className="truncate">{node.habit.name}</span>
          </DialogTitle>
          <p className="flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted-foreground">
            <span>
              {habitScheduleLabel(node.habit)} · {node.habit.time} 分钟
            </span>
            <Badge
              variant="outline"
              title={`四象限：${quadrant.name}`}
              className={cn(
                'h-[18px] shrink-0 px-1.5 py-0 text-[11px] leading-[18px]',
                quadrant.badge,
              )}
            >
              {quadrant.short}
            </Badge>
          </p>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2">
          <Stat label="当前连续" value={`${node.stats.streak} 天`} />
          <Stat label="当月完成率" value={`${monthRate}%`} />
          <Stat label="专注次数" value={`${node.stats.focusCount} 次`} />
          <Stat label="手动打卡" value={`${node.stats.manualCount} 天`} />
        </div>

        <div className="flex items-center gap-1 border-b border-foreground/8 pb-1">
          <TabButton active={tab === 'calendar'} onClick={() => setTab('calendar')} icon={<CalendarDays className="size-3.5" />}>
            日历
          </TabButton>
          <TabButton active={tab === 'list'} onClick={() => setTab('list')} icon={<List className="size-3.5" />}>
            明细
          </TabButton>
          <span className="ml-auto text-[9.5px] text-muted-foreground">
            共 {node.stats.doneDays} 天完成 · {node.stats.missedDays} 天未完成
          </span>
        </div>

        {tab === 'calendar' ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scroll-thin">
            {/* 与专注日历同款报头：大字月份 ｜ 竖发丝线 ｜ 年份，右侧 ghost 图标翻月 */}
            <div className="mb-2 flex shrink-0 items-end justify-between gap-2">
              <div className="flex min-w-0 items-baseline gap-2.5">
                <span className="text-[26px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                  {month.month + 1} 月
                </span>
                <span className="h-3 w-px shrink-0 bg-foreground/25" aria-hidden />
                <span className="text-[12px] font-medium leading-none tracking-[0.16em] tabular-nums text-muted-foreground">
                  {month.year} 年
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="上一年"
                  title="上一年"
                  onClick={() => shiftMonth(-12)}
                >
                  <ChevronsLeft className="size-4" aria-hidden />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="上个月"
                  title="上个月"
                  onClick={() => shiftMonth(-1)}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="下个月"
                  title="下个月"
                  onClick={() => shiftMonth(1)}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="下一年"
                  title="下一年"
                  onClick={() => shiftMonth(12)}
                >
                  <ChevronsRight className="size-4" aria-hidden />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="回到今天"
                  title="回到今天"
                  onClick={goToday}
                >
                  <RotateCcw className="size-4" aria-hidden />
                </Button>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-7 pb-1.5">
              {WEEKDAYS.map((weekday) => (
                <span key={weekday} className="text-center text-[10.5px] text-muted-foreground">
                  {weekday}
                </span>
              ))}
            </div>
            {/* 与专注日历同款：6 行等高网格、数字大号、今天用一条横线。
                用 flex-1 吃掉弹窗剩余高度，底部不再留一大块空白。 */}
            <div className="grid min-h-[220px] flex-1 grid-cols-7 grid-rows-6 overflow-hidden rounded-lg border border-primary/25 bg-[var(--card-surface)]">
              {cells.map((date, cellIndex) => {
                const key = localDayKey(date)
                const inMonth =
                  date.getMonth() === month.month && date.getFullYear() === month.year
                const view = habitDayView({
                  habit: node.habit,
                  day: key,
                  rows: node.days,
                  logs: node.logs,
                  now: new Date(),
                  dayContextOf,
                })
                const row = rowByDay.get(key)
                const isSelected = key === selectedDay
                const isToday = key === today
                const chip = habitDayChipClass(view.state, view.due)
                return (
                  <button
                    key={key}
                    type="button"
                    data-day={key}
                    aria-label={`${key} · ${stateText(view.state, view.due)}`}
                    title={`${key} · ${stateText(view.state, view.due)}${row ? ` · 专注 ${row.focusCount} 次 / 手动 ${row.manualCount} 次` : ''}`}
                    onClick={() => {
                      // 跨月格子只选中那一天，不翻页：面板仍停在当前月份
                      setSelectedDay(key)
                    }}
                    className={cn(
                      // 选中 = 中性灰底；悬停 = 一圈清晰的 1px 内描边，不改布局
                      'relative flex cursor-pointer flex-col overflow-hidden px-2.5 pt-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/40',
                      'border-primary/20',
                      cellIndex % 7 !== 6 ? 'border-r' : null,
                      cellIndex < 35 ? 'border-b' : null,
                      'hover:shadow-[inset_0_0_0_1px_rgba(74,94,64,.5)]',
                      isSelected ? 'bg-foreground/[0.10]' : 'bg-[var(--card-surface)]',
                    )}
                  >
                    <span className="flex w-fit flex-col items-start gap-0.5">
                      <span
                        className={cn(
                          'text-[15px] font-semibold leading-none tabular-nums',
                          isToday ? 'text-primary' : 'text-foreground',
                        )}
                      >
                        {date.getDate()}
                      </span>
                      {/* 今天只用一条横线，叠在数字下面；不再用外圈，避免双重标记 */}
                      {isToday ? (
                        <span className="h-[4.4px] w-full bg-primary" aria-hidden />
                      ) : null}
                    </span>
                    {/* 跨月格子不变灰，只在左下角标出它属于哪个月 */}
                    {!inMonth ? (
                      <span className="absolute bottom-1 left-2.5 text-[9px] leading-none text-muted-foreground">
                        {date.getMonth() + 1} 月
                      </span>
                    ) : null}
                    <DayCount count={row?.focusCount ?? 0} />
                    {/* 结果用一小块实心色；未来待做是同色空心框，不抢日期 */}
                    {chip ? (
                      <span
                        className={cn(
                          'absolute bottom-[5px] right-2 size-2.5 rounded-[3px]',
                          chip,
                        )}
                        aria-hidden
                      />
                    ) : null}
                  </button>
                )
              })}
            </div>

            <div className="mt-2 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] text-muted-foreground">
              <LegendChip className={HABIT_DONE_CHIP} label="完成" />
              <LegendChip className={HABIT_MISSED_CHIP} label="未完成" />
              <LegendChip className={HABIT_EXCUSED_CHIP} label="请假" />
              <LegendChip className={HABIT_FUTURE_CHIP} label="待做" />
            </div>

            {/* 固定最小高度：底部有没有操作按钮都不改变高度，上面的日历网格不会跟着缩放 */}
            {view ? (
              <div className="mt-2 flex min-h-[100px] shrink-0 flex-col rounded-[10px] border border-foreground/8 bg-card px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11.5px] font-semibold text-foreground">{selectedLabel}</p>
                    <p className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                      {view.state === 'done'
                        ? `已完成 · 专注 ${view.focusCount} 次${
                            view.manualCount ? ` / 手动 ${view.manualCount} 次` : ''
                          }`
                        : view.state === 'missed'
                          ? '这一天没有完成，可以补记或请假。'
                          : view.state === 'excused'
                            ? '已请假，不计入完成率。'
                            : view.state === 'pending'
                              ? '今天还差一次，可以开始专注或直接打卡。'
                              : view.state === 'off' && view.due
                                ? '这一天没有记录，也没有被日结判成缺失。'
                                : view.state === 'off'
                                  ? view.day < createdDay
                                    ? '习惯创建之前，没有记录。'
                                    : '休息日，今天不用做。'
                                  : view.due
                                    ? '未来的该做日，到那天再记录。'
                                    : '未来的休息日，到那天再看。'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-[4px] px-1.5 py-0.5 text-[9px] font-medium',
                      stateSolidClass(view.state),
                    )}
                  >
                    {stateText(view.state, view.due)}
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {canCheck ? (
                    <Button size="sm" onClick={() => void onCheckIn(node.habit.id, selectedDay)}>
                      <Check className="size-3.5" aria-hidden />
                      {view.state === 'missed' || view.state === 'excused' ? '补记完成' : '立即打卡'}
                    </Button>
                  ) : null}
                  {canExcuse ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void onExcuse(node.habit.id, selectedDay, true)}
                    >
                      <X className="size-3.5" aria-hidden />
                      标记请假
                    </Button>
                  ) : null}
                  {view.state === 'excused' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void onExcuse(node.habit.id, selectedDay, false)}
                    >
                      取消请假
                    </Button>
                  ) : null}
                  {view.state === 'done' ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setTab('list')}>
                        查看当天明细
                      </Button>
                      {canUndoManual ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onUndoManual(node.habit.id, selectedDay)}
                        >
                          撤销手动打卡
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  {canSetDue ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void onSetDue(node.habit.id, selectedDay)}
                    >
                      <Plus className="size-3.5" aria-hidden />
                      临时加做
                    </Button>
                  ) : null}
                  {canOverrideDone ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void onOverrideDone(node.habit.id, selectedDay)}
                    >
                      <Plus className="size-3.5" aria-hidden />
                      临时加做并补记
                    </Button>
                  ) : null}
                  {canClearOverride ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={() => void onClearOverride(node.habit.id, selectedDay)}
                    >
                      取消临时加做
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 scroll-thin">
            {groupedLogs.length === 0 ? (
              <p className="py-10 text-center text-[11px] text-muted-foreground">还没有执行记录</p>
            ) : (
              <>
                <p className="mb-3 text-[10px] leading-4 text-muted-foreground">
                  时间轴只列出有执行记录的日期；未完成与请假请在日历里查看。
                </p>
                <ol ref={timelineRef} className="relative space-y-4 pb-1">
                  {/* 线和圆点在同一份 SVG：一条连续 path，圆点后画、盖住两端 */}
                  {timelineYs.length > 0 ? (
                    <svg
                      aria-hidden
                      className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
                    >
                      {timelineYs.length > 1 ? (
                        <path
                          d={`M 5.5 ${timelineYs[0]} L 5.5 ${timelineYs[timelineYs.length - 1]}`}
                          className="text-foreground/20"
                          stroke="currentColor"
                          strokeWidth={2}
                          strokeLinecap="butt"
                          fill="none"
                        />
                      ) : null}
                      {timelineYs.map((y, index) => (
                        <circle
                          key={groupedLogs[index]?.day ?? index}
                          cx={5.5}
                          cy={y}
                          r={5.5}
                          fill={stateDotColor(rowByDay.get(groupedLogs[index]?.day ?? '')?.state)}
                        />
                      ))}
                    </svg>
                  ) : null}

                {groupedLogs.map((group) => {
                  const row = rowByDay.get(group.day)
                  const date = dayKeyToDate(group.day)
                  return (
                    <li key={group.day} data-timeline-item className="relative pl-6">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="text-[12.5px] font-semibold leading-none text-foreground">
                          {date.getMonth() + 1} 月 {date.getDate()} 日
                          <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">
                            周{WEEKDAY_LABELS[date.getDay()]}
                          </span>
                        </p>
                        {row ? (
                          <span
                            className={cn(
                              'rounded-[4px] px-1.5 py-[3px] text-[9.5px] font-medium leading-none',
                              stateSolidClass(row.state),
                            )}
                          >
                            {stateText(row.state, true)}
                          </span>
                        ) : null}
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {group.logs.length} 次
                        </span>
                      </div>

                      <div className="mt-2 space-y-1.5">
                        {group.logs.map((log) => {
                          const manual = habitLogSource(log) === 'manual'
                          const time = new Date(log.time)
                          const minutes = log.seconds ? Math.round(log.seconds / 60) : 0
                          const label = !log.success
                            ? '中断的专注'
                            : manual
                              ? log.backfilled
                                ? '补记完成'
                                : '手动打卡'
                              : '专注完成'
                          return (
                            <div
                              key={log.id}
                              className="flex min-h-[30px] items-center gap-2 rounded-[8px] border border-foreground/8 bg-card px-2.5 py-1.5"
                            >
                              <span className="w-9 shrink-0 font-mono text-[10px] leading-none text-muted-foreground">
                                {log.success
                                  ? `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`
                                  : '—'}
                              </span>
                              <span
                                className={cn(
                                  'min-w-0 flex-1 truncate text-[11px]',
                                  !log.success && 'text-muted-foreground',
                                )}
                              >
                                {label}
                              </span>
                              {minutes > 0 ? (
                                <span className="shrink-0 font-mono text-[9.5px] text-muted-foreground">
                                  {minutes} 分钟
                                </span>
                              ) : null}
                              {confirmLog === log.id ? (
                                <span className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    className="rounded-[4px] bg-destructive/10 px-2 py-1 text-[10px] leading-none text-destructive"
                                    onClick={() => {
                                      void onDeleteLog(log.id)
                                      setConfirmLog(null)
                                    }}
                                  >
                                    确认删除
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-[4px] px-2 py-1 text-[10px] leading-none text-muted-foreground"
                                    onClick={() => setConfirmLog(null)}
                                  >
                                    取消
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="shrink-0 rounded-[4px] px-2 py-1 text-[10px] leading-none text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                                  onClick={() => setConfirmLog(log.id)}
                                >
                                  删除
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </li>
                  )
                })}
              </ol>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[9px] border border-foreground/8 bg-card px-2.5 py-2">
      <p className="font-mono text-[13px] leading-none text-primary">{value}</p>
      <p className="mt-1 text-[9px] text-muted-foreground">{label}</p>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1 rounded-[5px] px-2.5 py-1.5 text-[11px] outline-none transition-colors',
        active
          ? 'bg-primary/10 font-semibold text-primary'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  )
}


