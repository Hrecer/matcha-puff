import { useMemo, useState } from 'react'
import { Check, Pencil, Play, Repeat } from 'lucide-react'
import type { Habit, TaskNode, TaskQuadrant, TaskRef } from '@matcha-puff/pomodoro-core'
import { habitScheduleLabel, taskCountdown } from '@matcha-puff/pomodoro-core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { Tip } from '@/components/ui/tooltip'
import { toast } from '@/components/ui/toast'
import { HabitFormDialog } from '@/components/focus/HabitFormDialog'
import { TaskFormDialog, type TaskFormDraft } from '@/components/focus/TaskFormDialog'
import { displayTaskColor } from '@/components/focus/calendar-utils'
import { QUADRANTS, normalizeQuadrant } from '@/components/focus/quadrants'
import {
  subtaskViewOf,
  toggleTaskDone,
  topTaskViewOf,
  useFocusData,
  type HabitNode,
} from '@/lib/focus-data'
import { useFocusStore } from '@/lib/focus-store'
import { jumpTo } from '@/lib/focus-jump'
import { matchesText, matchTerms } from '@/lib/highlight'
import { cn } from 'cn'

const startOfLocalDay = (ms: number): number => {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

const monthDay = (ms: number): string => {
  const date = new Date(ms)
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

interface LeafRow {
  node: TaskNode
  path: string
  quadrant: TaskQuadrant
  overdue: boolean
}

interface TaskItem {
  kind: 'task'
  row: LeafRow
  /** 0 逾期、1 今天、2 未来、3 无日期 */
  group: number
  due: number
  createdAt: number
}

interface HabitItem {
  kind: 'habit'
  node: HabitNode
  order: number
}

type BoardItem = TaskItem | HabitItem

const taskGroupOf = (row: LeafRow, today: number): number => {
  if (row.overdue) return 0
  if (row.node.endDate <= 0) return 3
  return startOfLocalDay(row.node.endDate) <= today ? 1 : 2
}

const compareBoardItems = (a: BoardItem, b: BoardItem): number => {
  const ga = a.kind === 'habit' ? 1 : a.group
  const gb = b.kind === 'habit' ? 1 : b.group
  if (ga !== gb) return ga - gb
  // 同为今天该做的事时，习惯排在任务前，免得每日习惯被已有任务压到底部
  if (a.kind !== b.kind) return a.kind === 'habit' ? -1 : 1
  if (a.kind === 'task' && b.kind === 'task') {
    if (a.due !== b.due) return a.due - b.due
    return a.createdAt - b.createdAt
  }
  if (a.kind === 'habit' && b.kind === 'habit') return a.order - b.order
  return 0
}

export function QuadrantTab({ onStart }: { onStart: (task: TaskRef, minutes: number) => void }) {
  const { roots, habits, ready } = useFocusData()
  const { config, snapshot } = useFocusStore()
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<TaskFormDraft | null>(null)
  const [habitDraft, setHabitDraft] = useState<Habit | null>(null)

  const today = startOfLocalDay(Date.now())
  const sessionTaskId =
    snapshot?.task?.id && (snapshot.phase !== 'idle' || snapshot.pending) ? snapshot.task.id : null

  const leaves = useMemo(() => {
    const out: LeafRow[] = []
    const walk = (nodes: readonly TaskNode[], trail: string[]) => {
      for (const node of nodes) {
        if (node.isContainer) {
          walk(node.children, [...trail, node.task.title])
          continue
        }
        if (node.complete) continue
        out.push({
          node,
          path: trail.join(' / '),
          quadrant: normalizeQuadrant(node.task.quadrant),
          overdue: node.endDate > 0 && startOfLocalDay(node.endDate) < today,
        })
      }
    }
    walk(roots, [])
    return out
  }, [roots, today])

  const terms = useMemo(() => matchTerms(query), [query])
  const visible = useMemo(
    () =>
      leaves.filter(({ node, path }) =>
        matchesText(`${node.task.title}\n${node.task.desc}\n${path}`, terms),
      ),
    [leaves, terms],
  )

  const { dueHabits, pendingHabits, doneHabitCount } = useMemo(() => {
    const due = habits.filter((item) => item.due)
    const pending = due.filter(
      (node) =>
        !node.logs.some((log) => log.success && startOfLocalDay(log.time) === today),
    )
    return { dueHabits: due, pendingHabits: pending, doneHabitCount: due.length - pending.length }
  }, [habits, today])

  const visibleHabits = useMemo(
    () =>
      pendingHabits.filter(({ habit }) =>
        matchesText(`${habit.name}\n${habit.desc}`, terms),
      ),
    [pendingHabits, terms],
  )

  const itemsByQuadrant = useMemo(() => {
    const map = new Map<TaskQuadrant, BoardItem[]>(
      QUADRANTS.map((item) => [item.value, [] as BoardItem[]]),
    )
    for (const row of visible) {
      map.get(row.quadrant)!.push({
        kind: 'task',
        row,
        group: taskGroupOf(row, today),
        due: row.node.endDate > 0 ? row.node.endDate : Number.MAX_SAFE_INTEGER,
        createdAt: row.node.task.createdAt,
      })
    }
    visibleHabits.forEach((node, order) => {
      map.get(normalizeQuadrant(node.habit.quadrant))!.push({ kind: 'habit', node, order })
    })
    for (const items of map.values()) items.sort(compareBoardItems)
    return map
  }, [visible, visibleHabits, today])

  const openEdit = (node: TaskNode) => {
    const parentId = node.task.parentId
    setDraft({
      kind: parentId ? 'subtask' : 'top',
      initial: parentId ? subtaskViewOf(node) : topTaskViewOf(node),
      hasSubtasks: false,
    })
  }

  const toggleDone = (row: LeafRow) => {
    if (sessionTaskId === row.node.task.id) {
      toast('计时进行中，请先停止计时再修改完成状态', 'error')
      return
    }
    void toggleTaskDone(row.node.task.id, true)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-2">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <span className="text-[11.5px] text-muted-foreground">
          {dueHabits.length > 0
            ? `今日习惯 ${doneHabitCount}/${dueHabits.length}`
            : '今日习惯 0'}
        </span>
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="搜索任务、习惯或主线…"
          className="h-8 w-[230px] shrink-0"
        />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3">
        {QUADRANTS.map((meta) => {
          const items = itemsByQuadrant.get(meta.value) ?? []
          return (
            <section
              key={meta.value}
              className="glass flex min-h-0 flex-col rounded-panel p-2.5"
            >
              <header className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    'inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-[10px] font-medium',
                    meta.badge,
                  )}
                >
                  {meta.short}
                </span>
                <h2 className={cn('text-[12.5px] font-semibold', meta.text)}>{meta.name}</h2>
                <span className="text-[10px] text-muted-foreground">{meta.hint}</span>
                <span className="ml-auto text-[10.5px] text-muted-foreground">
                  {items.length} 条
                </span>
              </header>

              <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5 scroll-thin">
                {items.length === 0 ? (
                  <p className="py-6 text-center text-[10.5px] text-muted-foreground/70">
                    {query.trim() ? '没有匹配的任务或习惯' : '空'}
                  </p>
                ) : (
                  items.map((item) => {
                    if (item.kind === 'habit') {
                      const { habit } = item.node
                      return (
                        <article
                          key={`habit-${habit.id}`}
                          className="flex gap-2 rounded-lg border border-[var(--card-edge)] bg-[var(--card-surface)] px-2 py-2"
                        >
                          <span
                            className={cn(
                              'w-[3px] shrink-0 self-stretch rounded-full',
                              meta.stripe,
                            )}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-start gap-1.5">
                              <span
                                className="mt-[7px] size-1.5 shrink-0 rounded-full border border-foreground/10"
                                style={{ background: displayTaskColor(habit.color) }}
                                aria-hidden
                              />
                              <button
                                type="button"
                                onClick={() => jumpTo('habit', habit.id)}
                                title={`打开习惯：${habit.name}`}
                                className="line-clamp-2 min-w-0 cursor-pointer break-words text-left text-[12.5px] font-medium leading-5 text-foreground outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40"
                              >
                                {habit.name}
                              </button>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                              <Badge
                                variant="outline"
                                className="h-4 shrink-0 gap-0.5 border-primary/30 px-1.5 py-0 text-[9px] text-primary/90"
                              >
                                <Repeat className="size-2.5" aria-hidden />
                                习惯
                              </Badge>
                              <span>{habitScheduleLabel(habit)}</span>
                              <span aria-hidden>·</span>
                              <span>{habit.time} 分钟</span>
                            </div>
                          </div>
                          <span className="flex shrink-0 items-start gap-0.5">
                            <Tip label="开始专注">
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                className="size-5"
                                aria-label={`开始 ${habit.name}`}
                                onClick={() =>
                                  onStart(
                                    {
                                      id: habit.id,
                                      name: habit.name,
                                      desc: habit.desc,
                                      type: 1,
                                    },
                                    habit.time,
                                  )
                                }
                              >
                                <Play className="size-3" aria-hidden />
                              </Button>
                            </Tip>
                            <Tip label="编辑">
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                className="size-5"
                                aria-label={`编辑 ${habit.name}`}
                                onClick={() => setHabitDraft(habit)}
                              >
                                <Pencil className="size-3" aria-hidden />
                              </Button>
                            </Tip>
                          </span>
                        </article>
                      )
                    }

                    const { row } = item
                    const { node } = row
                    const { task } = node
                    const countdown = node.endDate > 0 ? taskCountdown(node.endDate) : null
                    const canStart = !row.overdue
                    const canManualDone = node.plannedTotal <= 0
                    return (
                      <article
                        key={task.id}
                        className="flex gap-2 rounded-lg border border-[var(--card-edge)] bg-[var(--card-surface)] px-2 py-2"
                      >
                        <span
                          className={cn('w-[3px] shrink-0 self-stretch rounded-full', meta.stripe)}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() => jumpTo('task', task.id)}
                            title={`打开任务：${task.title}`}
                            className={cn(
                              'line-clamp-2 cursor-pointer break-words text-left text-[12.5px] font-medium leading-5 outline-none transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/40',
                              row.overdue ? 'text-destructive' : 'text-foreground',
                            )}
                          >
                            {task.title}
                          </button>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                            {row.overdue ? (
                              <Badge
                                variant="outline"
                                className="h-4 min-w-0 shrink gap-0.5 border-destructive/45 px-1.5 py-0 text-[9px] text-destructive"
                              >
                                <span className="truncate">{countdown?.text ?? '已逾期'}</span>
                              </Badge>
                            ) : countdown ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'h-4 min-w-0 shrink gap-0.5 border-primary/30 px-1.5 py-0 text-[9px] text-primary/90',
                                  countdown.state === 'today' && 'border-primary/55 text-primary',
                                )}
                              >
                                <span className="truncate">{countdown.text}</span>
                              </Badge>
                            ) : (
                              <span>{node.endDate > 0 ? monthDay(node.endDate) : '时间不定'}</span>
                            )}
                            <span aria-hidden>·</span>
                            <span>
                              {node.plannedTotal > 0
                                ? `${node.doneCount}/${node.plannedTotal}`
                                : '无计划'}
                            </span>
                          </div>
                        </div>

                        <span className="flex shrink-0 items-start gap-0.5">
                          {canStart ? (
                            <Tip label="开始专注">
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                className="size-5"
                                aria-label={`开始 ${task.title}`}
                                onClick={() =>
                                  onStart(
                                    {
                                      id: task.id,
                                      name: task.title,
                                      desc: task.desc,
                                      type: task.parentId ? 3 : 2,
                                    },
                                    config.pomodoroTime,
                                  )
                                }
                              >
                                <Play className="size-3" aria-hidden />
                              </Button>
                            </Tip>
                          ) : null}
                          {canManualDone ? (
                            <Tip label="标记完成">
                              <Button
                                size="icon-xs"
                                variant="ghost"
                                className="size-5"
                                aria-label={`标记完成 ${task.title}`}
                                onClick={() => toggleDone(row)}
                              >
                                <Check className="size-3" aria-hidden />
                              </Button>
                            </Tip>
                          ) : null}
                          <Tip label="编辑">
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="size-5"
                              aria-label={`编辑 ${task.title}`}
                              onClick={() => openEdit(node)}
                            >
                              <Pencil className="size-3" aria-hidden />
                            </Button>
                          </Tip>
                        </span>
                      </article>
                    )
                  })
                )}
              </div>
            </section>
          )
        })}
      </div>

      {!ready ? (
        <p className="shrink-0 px-1 text-[10.5px] text-muted-foreground/70">
          正在读取任务和习惯…
        </p>
      ) : null}

      <TaskFormDialog draft={draft} onOpenChange={(open) => !open && setDraft(null)} />
      <HabitFormDialog habit={habitDraft} onOpenChange={(open) => !open && setHabitDraft(null)} />
    </div>
  )
}
