import type { FocusSession } from '@matcha-puff/pomodoro-core'
import { Check } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { PlanGroupView } from '@/components/focus/PlanGroupView'
import { SectionTitle } from '@/components/ui/section-title'
import { clockText, minutesShort, type PlanEntry } from '@/components/focus/calendar-utils'

/** 卡片外形：和任务行 / 收件箱卡同一套（淡抹茶底 + 抹茶描边） */
const CARD = 'rounded-panel border border-[var(--card-edge)] bg-[var(--card-surface)] p-3'

/** 卡内列表：各自滚动，整页就不用滚了 */
const SCROLL = 'min-h-0 flex-1 overflow-y-auto scroll-thin'

/** 第一行左列（时间分布）固定 280；第二行的会话明细与任务各占一半 */
const LEFT_W = 280

export interface DayDetail {
  date: Date
  /** `yyyy-mm-dd`，和 planMap / habitDayMap 的键同一口径 */
  key: string
  /** 今天（`yyyy-mm-dd`）：判断计划是否逾期用 */
  todayKey: string
  isToday: boolean
  holiday: 'holiday' | 'workday' | null
  /** 当天汇总 */
  focus: { count: number; seconds: number }
  /** 当天按任务拆的时长（带主线色） */
  tasks: { id: string; name: string; seconds: number; color: string }[]
  sessions: FocusSession[]
  habits: {
    due: number
    done: { id: string; name: string; count: number }[]
    pending: { id: string; name: string }[]
  }
  planGroups: { rootId: string; rootTitle: string; items: PlanEntry[] }[]
  planDone: number
  planTotal: number
  colorOfSession: (session: FocusSession) => string
  colorOfRoot: (rootId: string) => string
  /** 点任务 / 习惯：跳到对应页签并定位到那一条 */
  onJumpTask: (taskId: string) => void
  onJumpHabit: (habitId: string) => void
}

/**
 * 日视图的卡片区。日期、星期、今天与当天汇总都已经移到上面的头部，
 * 这里只放「时间怎么花的」和「还有什么要做」两类内容。
 *
 * 卡片位置与顺序固定，永远是这四块、永远是这四个角：
 *
 * ```
 * 时间分布(280) │ 习惯
 * ──────────────┼─────────────
 * 会话明细 1.07fr │ 任务 0.93fr
 * ```
 *
 * 两行**各自是一条 grid**：第一行仍是 `280 + 1fr`，
 * 第二行左会话占 1.07 份、右任务占 0.93 份 —— 会话约为等分时的 1.07 倍宽。
 *
 * 所有卡片都锁在容器高度内、各自内部滚动：当天有 38 段会话、110 个习惯、
 * 104 条计划也只是卡内滚，页面本身不动。
 */
export function DayBoard({ detail }: { detail: DayDetail }) {
  const { focus, tasks, sessions, habits, planGroups } = detail
  // 分布按耗时降序；占比都以「当天总专注时长」为分母
  const ranked = [...tasks].sort((a, b) => b.seconds - a.seconds)
  const totalSeconds = focus.seconds || 1

  return (
    <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
      {/* 第一行：时间分布 ｜ 习惯 —— 两卡固定同高，内容多少都占满整格 */}
      <div
        className="grid h-[196px] shrink-0 gap-3"
        style={{ gridTemplateColumns: `${LEFT_W}px minmax(0, 1fr)` }}
      >
        <section className={cn(CARD, 'flex min-h-0 flex-col')}>
          <SectionTitle trailing={`${tasks.length} 个任务`}>时间分布</SectionTitle>
          {ranked.length === 0 ? (
            <p className="mt-2 text-[10.5px] text-muted-foreground/70">当天没有专注记录</p>
          ) : (
            <>
              {/* 一条 100% 的堆叠条：一眼看出时间被谁吃掉了，比一排等宽进度条更像个"分布" */}
              <div className="mt-1.5 flex h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-foreground/8">
                {ranked.map((task) => (
                  <span
                    key={task.id}
                    className="h-full"
                    style={{
                      width: `${(task.seconds / totalSeconds) * 100}%`,
                      background: task.color,
                    }}
                    title={`${task.name} · ${Math.round((task.seconds / totalSeconds) * 100)}%`}
                    aria-hidden
                  />
                ))}
              </div>
              {/* 逐条明细：占比用前景色（这是这张卡的重点），时长退成次要信息。
                  行数多时靠卡内滚动兜底，不再砍掉后面的任务。 */}
              <div className={cn(SCROLL, 'mt-1.5 flex flex-col')}>
                {ranked.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-[4px] px-0.5 leading-[18px]"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: task.color }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => detail.onJumpTask(task.id)}
                      title={`打开任务：${task.name} · ${minutesShort(task.seconds)} · 占 ${Math.round(
                        (task.seconds / totalSeconds) * 100,
                      )}%`}
                      className="min-w-0 cursor-pointer truncate rounded-[4px] text-left text-[10.5px] text-foreground/85 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {task.name}
                    </button>
                    <span className="ml-auto w-[34px] shrink-0 text-right font-mono text-[9.5px] tabular-nums text-muted-foreground/70">
                      {minutesShort(task.seconds)}
                    </span>
                    <span className="w-[32px] shrink-0 text-right font-mono text-[10px] font-medium tabular-nums text-foreground">
                      {Math.round((task.seconds / totalSeconds) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

        {/* 习惯与「时间分布」固定同高：内容多时卡内滚动 */}
        <section className={cn(CARD, 'flex min-h-0 flex-col')}>
          <SectionTitle trailing={`该做 ${habits.due} · 已做 ${habits.done.length}`}>习惯</SectionTitle>
          {habits.due === 0 && habits.done.length === 0 ? (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground/70">这一天没有要到期的习惯。</p>
          ) : (
            <div className={cn(SCROLL, 'mt-1.5 flex flex-wrap content-start gap-1')}>
              {/* 先列「还没做的」：这些才是今天要动手的；做过的沉到最后，只作为记录。
                  每颗 chip 都是按钮：悬停换底色 + 主色描边，点一下跳到习惯页那一条。 */}
              {habits.pending.map((habit) => (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => detail.onJumpHabit(habit.id)}
                  title={`打开习惯：${habit.name}`}
                  className="max-w-full truncate rounded-md border border-foreground/10 px-1.5 py-0.5 text-[10.5px] text-muted-foreground outline-none transition-colors hover:border-primary/40 hover:bg-primary/[0.08] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  {habit.name}
                </button>
              ))}
              {habits.done.map((habit) => (
                <button
                  key={habit.id}
                  type="button"
                  onClick={() => detail.onJumpHabit(habit.id)}
                  title={`打开习惯：${habit.name}`}
                  className="flex max-w-full items-center gap-1 rounded-md bg-primary/[0.09] px-1.5 py-0.5 text-[10.5px] text-foreground outline-none transition-colors hover:bg-primary/[0.16] focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                  <Check className="size-2.5 shrink-0 text-primary" aria-hidden />
                  <span className="truncate">{habit.name}</span>
                  <span className="shrink-0 rounded-full bg-primary/15 px-1 font-mono text-[9px] tabular-nums text-primary">
                    ×{habit.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 第二行：会话明细 ｜ 任务 —— 会话 1.07fr / 任务 0.93fr（会话约为等分时 1.07 倍宽） */}
      <div className="grid min-h-0 flex-1 grid-cols-[1.07fr_0.93fr] gap-3">
        <section className={cn(CARD, 'flex min-h-0 flex-col')}>
          <SectionTitle trailing={`${sessions.length} 段`}>会话明细</SectionTitle>
          {sessions.length === 0 ? (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground/70">这一天没有会话明细。</p>
          ) : (
            <div className={cn(SCROLL, 'mt-1.5 flex flex-col gap-1')}>
              {sessions.map((session) => {
                const start = new Date(session.start)
                const end = new Date(session.end)
                return (
                  <div
                    key={session.id}
                    className="flex items-center gap-1.5 rounded-md bg-foreground/[0.03] px-2 py-1"
                  >
                    <span className="w-[74px] shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
                      {clockText(start.getHours() * 60 + start.getMinutes())}–
                      {clockText(end.getHours() * 60 + end.getMinutes())}
                    </span>
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: detail.colorOfSession(session) }}
                      aria-hidden
                    />
                    <button
                      type="button"
                      onClick={() => detail.onJumpTask(session.task.id)}
                      title={`打开任务：${session.task.name}`}
                      className="min-w-0 cursor-pointer truncate rounded-[4px] text-left text-[10.5px] text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {session.task.name}
                    </button>
                    <span className="ml-auto shrink-0 font-mono text-[9px] tabular-nums text-muted-foreground">
                      {Math.max(1, Math.round(session.seconds / 60))}m
                    </span>
                    <Badge
                      variant={session.completed ? 'secondary' : 'outline'}
                      className="shrink-0 px-1 py-0 text-[8px] leading-[14px]"
                    >
                      {session.completed ? '完成' : '停止'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className={cn(CARD, 'flex min-h-0 flex-col')}>
          <SectionTitle
            trailing={detail.planTotal > 0 ? `${detail.planDone}/${detail.planTotal} 已完成` : undefined}
          >
            任务
          </SectionTitle>
          {planGroups.length === 0 ? (
            <p className="mt-1.5 text-[10.5px] text-muted-foreground/70">当天没有任务安排。</p>
          ) : (
            <div className={cn(SCROLL, 'mt-1.5 flex flex-col gap-1.5')}>
              {planGroups.map((group) => (
                <PlanGroupView
                  key={`${detail.key}-${group.rootId}`}
                  group={group}
                  selectedKey={detail.key}
                  todayKey={detail.todayKey}
                  color={detail.colorOfRoot(group.rootId)}
                  compact
                  onJump={detail.onJumpTask}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
