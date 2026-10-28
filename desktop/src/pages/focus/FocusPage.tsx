import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronRight,
  Coffee,
  FileText,
  Focus as FocusIcon,
  Pause,
  Pin,
  Play,
  SkipForward,
  Square,
  type LucideIcon,
} from 'lucide-react'
import {
  formatRemain,
  makeupTime,
  secondsToMinutes,
  UNASSIGNED_TASK,
} from '@matcha-puff/pomodoro-core'
import { Button } from '@/components/ui/button'

import { SectionTitle } from '@/components/ui/section-title'
import { SlidingSegmented } from '@/components/ui/sliding'
import { WidgetHideIcon, WidgetShowIcon } from '@/components/focus/FocusWidgetIcons'
import { TaskPicker, type PickedTask } from '@/components/focus/TaskPicker'
import { HabitsTab } from '@/components/focus/HabitsTab'
import { QuadrantTab } from '@/components/focus/QuadrantTab'
import { loadFocusData, startFocusDataClock } from '@/lib/focus-data'
import { jumpTo, useJumpRequest } from '@/lib/focus-jump'
import { TasksTab } from '@/components/focus/TasksTab'
import { InboxTab } from '@/components/focus/InboxTab'
import { PomodoroCalendar } from '@/components/focus/PomodoroCalendar'
import { StatsTab } from '@/components/focus/StatsTab'
import type { TaskRef } from '@matcha-puff/pomodoro-core'
import { cn } from 'cn'
import {
  initFocusStore,
  pauseFocus,
  resumeFocus,
  skipCurrentRest,
  startFocus,
  startManualRest,
  stopFocus,
  useFocusStore,
} from '@/lib/focus-store'
import { requestStopConfirm } from '@/lib/focus-stop-ask'
import {
  hideWidget,
  initWidgetVisibility,
  showWidget,
  useWidgetVisible,
} from '@/lib/widget-visibility'
import { inTauri } from '@/ipc/bridge'

type FocusTab = 'timer' | 'tasks' | 'quadrant' | 'calendar' | 'inbox' | 'habits' | 'stats'

const TABS: { value: FocusTab; label: string }[] = [
  { value: 'timer', label: '番茄钟' },
  { value: 'calendar', label: '专注日历' },
  { value: 'habits', label: '习惯' },
  { value: 'tasks', label: '任务' },
  { value: 'quadrant', label: '四象限' },
  { value: 'stats', label: '统计' },
  { value: 'inbox', label: '收件箱' },
]

/**
 * 当前分区记在 sessionStorage 里：从左侧导航跑去别处再回来时，还停在上次那个分区，
 * 不重置回「番茄钟」；但**只保留这一次会话** —— 软件重启后清空，仍然从「番茄钟」开始。
 * 键名带 matcha-puff 前缀，避免和别处数据撞车。
 */
const TAB_STORAGE_KEY = 'matcha-puff/focus-tab'

const readStoredTab = (): FocusTab => {
  try {
    const raw = sessionStorage.getItem(TAB_STORAGE_KEY)
    if (raw && TABS.some((item) => item.value === raw)) return raw as FocusTab
  } catch {
    // 读不到（存储被禁）就退回默认分区
  }
  return 'timer'
}

export function FocusPage() {
  const [tab, setTab] = useState<FocusTab>(readStoredTab)
  const widgetSupported = inTauri()
  const widgetVisible = useWidgetVisible()

  useEffect(() => {
    try {
      sessionStorage.setItem(TAB_STORAGE_KEY, tab)
    } catch {
      // 存不住不影响使用，只是下次回来会回到默认分区
    }
  }, [tab])

  // 挂件上的「打开」要直达番茄钟：页面已经挂着时 sessionStorage 不会触发更新，靠这个事件切
  useEffect(() => {
    const onSwitch = (event: Event) => {
      const next = (event as CustomEvent<string>).detail
      if (next && TABS.some((item) => item.value === next)) setTab(next as FocusTab)
    }
    window.addEventListener('matcha:focus-tab', onSwitch)
    return () => window.removeEventListener('matcha:focus-tab', onSwitch)
  }, [])

  useEffect(() => {
    void initFocusStore()
    initWidgetVisibility()
    // 业务文档统一在进入页面时拉一次，任何页签都可直接用。
    void loadFocusData()
  }, [])

  // 常驻窗口跨天时，习惯的「今天可做」与今日统计都要跟着翻页。
  useEffect(() => startFocusDataClock(), [])

  /**
   * 日视图里点了某个任务 / 习惯：切到对应页签，把「定位到这一条」的活儿交给列表页自己。
   * 这里只负责切页签；真正的展开、滚动、高亮由 TasksTab / HabitsTab 消费同一个请求完成。
   */
  const jump = useJumpRequest()
  useEffect(() => {
    if (!jump) return
    setTab(jump.kind === 'task' ? 'tasks' : 'habits')
  }, [jump])

  // 任务页 / 习惯页点「专注」：直接开一段并切到番茄钟页，避免任务上下文丢失。
  // 被「已有会话在跑」拦下时不动界面：提示已经弹了，再跳页反而像点成功了。
  const handleStart = (task: TaskRef, minutes: number) => {
    void startFocus(minutes, task).then((started) => {
      if (started) setTab('timer')
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 px-7">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 truncate pr-[2px] text-[19px] font-bold tracking-tight text-foreground">专注</h1>
          {widgetSupported ? (
            <button
              type="button"
              aria-label={widgetVisible ? '关闭挂件' : '打开挂件'}
              title={widgetVisible ? '关闭挂件' : '打开挂件'}
              onClick={() => {
                void (widgetVisible ? hideWidget() : showWidget()).catch(() => {})
              }}
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/55 text-muted-foreground outline-none transition-colors hover:border-foreground/20 hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
            >
              {widgetVisible ? (
                <WidgetHideIcon className="size-3.5" />
              ) : (
                <WidgetShowIcon className="size-3.5" />
              )}
            </button>
          ) : null}
        </div>
        <SlidingSegmented
          options={TABS}
          value={tab}
          onValueChange={setTab}
          ariaLabel="专注分区"
          className="shrink-0"
        />
      </header>

      {/* flex-col：让分区里的空状态能占满剩余高度并居中（见 Empty 上的 flex-1） */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-7 pb-6 scroll-thin">
        {tab === 'timer' ? <TimerTab /> : null}
        {tab === 'tasks' ? <TasksTab onStart={handleStart} /> : null}
        {tab === 'quadrant' ? <QuadrantTab onStart={handleStart} /> : null}
        {tab === 'calendar' ? <PomodoroCalendar /> : null}
        {tab === 'inbox' ? <InboxTab /> : null}
        {tab === 'habits' ? <HabitsTab onStart={handleStart} /> : null}
        {tab === 'stats' ? <StatsTab /> : null}
      </div>
    </div>
  )
}

function TimerTab() {
  const { ready, snapshot, summary, config, error } = useFocusStore()
  const [picked, setPicked] = useState<PickedTask | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)

  const phase = snapshot?.phase ?? 'idle'
  const running = phase === 'focus'
  const resting = phase === 'rest'
  const paused = phase === 'paused'
  const inRest = resting || (paused && snapshot?.pausedFrom === 'rest')
  /** 专注走完、等用户确认：不计时、不自动进休息 */
  const awaiting = phase === 'awaiting'
  const liveTask = snapshot?.task ?? UNASSIGNED_TASK
  // 空闲态只认「下一次要开始的选择」：上一段留下的任务/习惯不在这里沿用，
  // 否则休息结束后计时页还挂着它，看起来像没退出。
  const task = phase === 'idle' ? (picked?.task ?? UNASSIGNED_TASK) : liveTask
  const startMinutes = picked?.minutes ?? config.pomodoroTime

  // 选择一旦交给会话，就不再作为「下一次」的预设：这段结束后回到未命名待命态。
  useEffect(() => {
    if (phase !== 'idle') setPicked(null)
  }, [phase])

  const remainText = useMemo(() => {
    if (phase === 'idle') return { minutes: makeupTime(config.pomodoroTime), seconds: '00' }
    return formatRemain(snapshot?.remainMs ?? 0)
  }, [phase, config.pomodoroTime, snapshot?.remainMs])

  const progress = phase === 'idle' ? 0 : (snapshot?.progress ?? 0)
  const cycle = snapshot?.cycleCompleted ?? 0
  const interval = Math.max(1, config.longRestInterval)
  const untilLong = interval - (cycle % interval || 0)

  const startSession = () => {
    setPicked({ task, minutes: startMinutes })
    void startFocus(startMinutes, task)
  }

  // 浏览器预览里计时内核不可用，但界面照常渲染：调界面时不需要真功能生效，
  // 按钮点下去也只会因为没有宿主而没有反应，不会报错（bridge 里未实现的能力一律返回 null）。
  if (!ready) {
    return (
      <div className="glass flex h-[420px] items-center justify-center rounded-panel">
        <p className="text-xs text-muted-foreground">正在读取计时状态…</p>
      </div>
    )
  }

  return (
    <>
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 pt-2">
      <FocusBanner phase={phase} resting={resting} task={task} />
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
      <section className="glass flex flex-col items-center justify-center rounded-panel px-6 py-8">
        <div className="relative flex size-[268px] items-center justify-center">
          <svg viewBox="0 0 268 268" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle
              cx="134"
              cy="134"
              r="122"
              fill="none"
              stroke="currentColor"
              strokeWidth="9"
              className="text-foreground/8"
            />
            <circle
              cx="134"
              cy="134"
              r="122"
              fill="none"
              stroke="currentColor"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 122}
              strokeDashoffset={2 * Math.PI * 122 * (1 - progress / 100)}
              className={cn(
                'transition-[stroke-dashoffset] duration-500 ease-linear',
                resting ? 'text-success' : paused ? 'text-muted-foreground' : 'text-primary',
              )}
            />
          </svg>

          <div className="relative flex flex-col items-center gap-1">
            <span
              className={cn(
                'text-[12px] font-medium',
                running
                  ? 'text-primary'
                  : resting
                    ? 'text-success'
                    : paused
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground',
              )}
            >
              {awaiting
                ? '时间到'
                : running
                  ? '专注中'
                  : resting
                    ? '休息中'
                    : paused
                      ? '已暂停'
                      : '准备开始'}
            </span>
            <p className="font-mono text-[60px] leading-none tracking-tight tabular-nums text-foreground">
              {remainText.minutes}
              <span className="mx-0.5 text-foreground/40">:</span>
              {remainText.seconds}
            </p>
            <button
              type="button"
              disabled={phase !== 'idle'}
              onClick={() => setPickerOpen(true)}
              className={cn(
                'mt-1 flex max-w-[220px] items-center gap-1 truncate rounded-full px-2 py-0.5 text-[12.5px] text-muted-foreground outline-none transition-colors',
                phase === 'idle' ? 'hover:bg-accent hover:text-foreground' : 'cursor-default',
              )}
            >
              <span className="min-w-0 truncate">{task.name}</span>
              {phase === 'idle' ? <ChevronRight className="size-3 shrink-0" aria-hidden /> : null}
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
          {awaiting ? (
            <>
              <Button size="lg" className="min-w-[180px]" onClick={() => void startManualRest()}>
                <Coffee className="size-4" aria-hidden />
                开始休息
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="min-w-[130px]"
                onClick={() => void stopFocus()}
              >
                <Check className="size-4" aria-hidden />
                知道了
              </Button>
            </>
          ) : phase === 'idle' ? (
            <>
              <Button size="lg" className="min-w-[180px]" onClick={startSession}>
                <Play className="size-4" aria-hidden />
                开始 {startMinutes} 分钟
              </Button>
              <Button size="lg" variant="outline" className="min-w-[130px]" onClick={() => void startManualRest()}>
                <Coffee className="size-4" aria-hidden />
                开始休息
              </Button>
            </>
          ) : paused ? (
            <Button
              size="lg"
              className="has-[>svg]:px-3"
              onClick={() => void resumeFocus()}
            >
              <Play className="size-4" aria-hidden />
              继续
            </Button>
          ) : (
            <Button
              size="lg"
              variant="outline"
              className="has-[>svg]:px-3"
              onClick={() => void pauseFocus()}
            >
              <Pause className="size-4" aria-hidden />
              暂停
            </Button>
          )}

          {inRest ? (
            <Button
              size="lg"
              variant="outline"
              className="has-[>svg]:px-3"
              onClick={() => void skipCurrentRest()}
            >
              <SkipForward className="size-4" aria-hidden />
              跳过休息
            </Button>
          ) : null}

          {phase !== 'idle' && !awaiting ? (
            <Button
              size="lg"
              variant="ghost"
              className="has-[>svg]:px-3"
              onClick={requestStopConfirm}
            >
              <Square className="size-3.5" aria-hidden />
              {inRest ? '停止休息' : '停止'}
            </Button>
          ) : null}
        </div>

        {error ? (
          <p className="mt-3 rounded-md bg-destructive/10 px-3 py-1.5 text-[11.5px] text-destructive">
            {error}
          </p>
        ) : null}
      </section>

      <div className="flex flex-col gap-3">
        <section className="glass rounded-panel p-4">
          <SectionTitle>今日</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label="完成番茄" value={`${summary.todayPomodoro}`} unit="个" />
            <Stat label="专注时长" value={`${secondsToMinutes(summary.todayTime)}`} unit="分钟" />
            <Stat label="本轮完成" value={`${cycle}`} unit="个" />
            <Stat label="距长休" value={`${untilLong}`} unit="个" />
          </div>
        </section>

        <section className="glass rounded-panel p-4">
          <SectionTitle>节奏</SectionTitle>
          <dl className="mt-3 flex flex-col gap-2 text-[12px]">
            <Row label="专注" value={`${config.pomodoroTime} 分钟`} />
            <Row label="短休" value={`${config.restTime} 分钟`} />
            <Row label="长休" value={`${config.longRestTime} 分钟`} />
            <Row label="长休间隔" value={`每 ${config.longRestInterval} 个`} />
            <Row label="自动休息" value={config.autoRest ? '开启' : '关闭'} />
            <Row label="自动下一个" value={config.autoNextPomodoro ? '开启' : '关闭'} />
          </dl>
        </section>
      </div>
      </div>
    </div>

    <TaskPicker
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      onPick={(next) => setPicked(next)}
    />
    </>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg bg-foreground/[0.035] px-3 py-2">
      <p className="text-[10.5px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex flex-wrap items-baseline gap-x-1 font-mono text-[20px] leading-6 tabular-nums text-foreground">
        <span>{value}</span>
        <span className="whitespace-nowrap font-sans text-[10.5px] font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  )
}

/** 顶部任务横幅：空闲/运行/休息三种状态。 */
function FocusBanner({
  phase,
  resting,
  task,
}: {
  phase: string
  resting: boolean
  task: TaskRef
}) {
  let title: string
  let desc: string
  let icon: LucideIcon
  let tone: string

  if (resting) {
    title = '休息时间到啦！'
    desc = '当前为休息时间，请注意休息！'
    icon = Coffee
    tone = 'text-success'
  } else if (phase === 'idle' && task.type === 0) {
    title = '启动一个未命名的番茄钟任务'
    desc = '在此处启动的番茄钟仅被记录时间，请在任务或习惯页面开始番茄钟。'
    icon = FocusIcon
    tone = 'text-primary'
  } else {
    title = task.name || '未命名专注'
    desc = task.desc || '这次专注没有任务归属，只记录时间。'
    icon = task.type === 1 ? Pin : task.type === 0 ? FocusIcon : FileText
    // 任务类型只靠图标形状区分：全 UI 统一抹茶绿，不再用红/青给类型上色
    tone = 'text-primary'
  }
  const Icon = icon
  const jumpKind =
    !resting && task.type === 1
      ? ('habit' as const)
      : !resting && (task.type === 2 || task.type === 3)
        ? ('task' as const)
        : null

  return (
    <section className="glass flex items-center gap-3 rounded-panel px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 truncate text-[11.5px] text-muted-foreground">{desc}</p>
      </div>
      {jumpKind ? (
        <button
          type="button"
          onClick={() => jumpTo(jumpKind, task.id)}
          aria-label={jumpKind === 'habit' ? '打开习惯' : '打开任务'}
          title={jumpKind === 'habit' ? '打开习惯' : '打开任务'}
          className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md outline-none transition-colors hover:bg-primary/10 focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <Icon className={cn('size-6', tone)} strokeWidth={2.2} aria-hidden />
        </button>
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center" aria-hidden>
          <Icon className={cn('size-6', tone)} strokeWidth={2.2} />
        </span>
      )}
    </section>
  )
}
