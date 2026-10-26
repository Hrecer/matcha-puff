import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import { ListTodo, Repeat, Sparkles } from 'lucide-react'
import {
  UNASSIGNED_TASK,
  buildTaskTree,
  flattenTaskTree,
  habitScheduleLabel,
  isHabitDue,
} from '@matcha-puff/pomodoro-core'
import type { Habit, Task, TaskRef } from '@matcha-puff/pomodoro-core'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SearchInput } from '@/components/ui/search-input'
import { SlidingSegmented } from '@/components/ui/sliding'
import { cn } from 'cn'
import { loadHabits, loadTasks } from '@/lib/focus-repo'
import { useFocusStore } from '@/lib/focus-store'
import { dayContextOf, loadHolidays } from '@/lib/workday'

export interface PickedTask {
  task: TaskRef
  minutes: number
}

type PickerTab = 'all' | 'unassigned' | 'tasks' | 'habits'

const TAB_OPTIONS: { value: PickerTab; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'unassigned', label: '无归属' },
  { value: 'tasks', label: '任务' },
  { value: 'habits', label: '习惯' },
]

export function TaskPicker({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (picked: PickedTask) => void
}) {
  const { config } = useFocusStore()
  const [tasks, setTasks] = useState<Task[]>([])
  const [habits, setHabits] = useState<Habit[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<PickerTab>('all')
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  // 换分类或改搜索词后回到结果顶部，别继承上一份列表的滚动位置
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = 0
  }, [tab, query])

  useEffect(() => {
    if (!open) return
    // 每次打开都从「全部」和空搜索开始，不继承上一次的筛选
    setTab('all')
    setQuery('')
    let alive = true
    setLoading(true)
    // 连本地节假日表一起读：习惯的「今天该不该做」要靠它
    Promise.all([loadTasks(), loadHabits(), loadHolidays()])
      .then(([nextTasks, nextHabits]) => {
        if (!alive) return
        setTasks(nextTasks)
        setHabits(nextHabits)
      })
      .catch(() => {
        if (!alive) return
        setTasks([])
        setHabits([])
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open])

  const pick = (task: TaskRef, minutes: number) => {
    onPick({ task, minutes })
    onOpenChange(false)
  }

  /**
   * 可选任务 = 未做完的叶子。
   * 容器（有子节点）的番茄数由后代汇总，所以它自己不出现在这里。
   */
  const pickable = useMemo(() => {
    const titles = new Map(tasks.map((item) => [item.id, item.title]))
    return flattenTaskTree(buildTaskTree(tasks))
      .filter(
        ({ node }) =>
          !node.isContainer && (node.plannedTotal === 0 || node.doneCount < node.plannedTotal),
      )
      .map(({ node }) => {
        const parent = node.task.parentId
        return {
          id: node.task.id,
          title: node.task.title,
          desc: node.task.desc,
          type: (parent ? 3 : 2) as TaskRef['type'],
          meta: parent
            ? `${titles.get(parent) ?? '未知'} · ${node.doneCount}/${node.plannedTotal}`
            : `${node.doneCount}/${node.plannedTotal} 个番茄`,
        }
      })
  }, [tasks])

  const now = new Date()
  const day = dayContextOf(now)

  /** 搜索词按空白切分，多个词要全部命中（顺序无关） */
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const hit = (...parts: Array<string | number | null | undefined>) => {
    if (terms.length === 0) return true
    const text = parts
      .map((part) => String(part ?? ''))
      .join(' ')
      .toLowerCase()
    return terms.every((term) => text.includes(term))
  }

  const unassignedHit = hit(
    '无归属',
    UNASSIGNED_TASK.name,
    '只记录时间',
    `${config.pomodoroTime} 分钟`,
  )

  const taskHits = pickable.filter((item) =>
    hit('任务', item.title, item.desc, item.meta),
  )

  const habitRows = habits
    .map((habit) => {
      const due = isHabitDue(habit, now, day)
      const cycleLabel = habitScheduleLabel(habit)
      return {
        habit,
        due,
        meta: `${cycleLabel} · ${habit.time} 分钟${due ? '' : ' · 今天不执行'}`,
      }
    })
    .filter(({ habit, due, meta }) =>
      hit('习惯', habit.name, habit.desc, habitScheduleLabel(habit), habit.time, meta, due ? '今天可做' : '今天不执行'),
    )

  const showUnassigned = (tab === 'all' || tab === 'unassigned') && unassignedHit
  const showTasks = tab === 'all' || tab === 'tasks'
  const showHabits = tab === 'all' || tab === 'habits'
  const visibleCount =
    (showUnassigned ? 1 : 0) +
    (showTasks ? taskHits.length : 0) +
    (showHabits ? habitRows.length : 0)

  const tabs = TAB_OPTIONS.map((option) => {
    if (option.value === 'tasks') return { ...option, label: `任务 ${pickable.length}` }
    if (option.value === 'habits') return { ...option, label: `习惯 ${habits.length}` }
    return option
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>选择这次专注的任务</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2.5">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder="搜索标题、简介、父任务、周期、时长…"
            autoFocus
          />
          <SlidingSegmented
            options={tabs}
            value={tab}
            onValueChange={setTab}
            ariaLabel="任务类型"
            className="self-start"
          />

          {/* 固定高度：切换分类或搜索时弹窗不能跟着内容缩水，始终和「全部」一样大 */}
          <div
            ref={listRef}
            className="flex h-[420px] flex-col gap-1 overflow-y-auto pr-1 scroll-thin"
          >
            {showUnassigned ? (
              <>
                {tab === 'all' ? <SectionLabel icon={Sparkles} text="无归属" /> : null}
                <TaskRow
                  title={UNASSIGNED_TASK.name}
                  meta={`只记录时间 · ${config.pomodoroTime} 分钟`}
                  onClick={() => pick(UNASSIGNED_TASK, config.pomodoroTime)}
                />
              </>
            ) : null}

            {showTasks && taskHits.length > 0 ? (
              <>
                {tab === 'all' ? <SectionLabel icon={ListTodo} text="任务" /> : null}
                {taskHits.map((item) => (
                  <TaskRow
                    key={item.id}
                    title={item.title}
                    meta={item.meta}
                    onClick={() =>
                      pick(
                        { id: item.id, name: item.title, desc: item.desc, type: item.type },
                        config.pomodoroTime,
                      )
                    }
                  />
                ))}
              </>
            ) : null}

            {showHabits && habitRows.length > 0 ? (
              <>
                {tab === 'all' ? <SectionLabel icon={Repeat} text="习惯" /> : null}
                {habitRows.map(({ habit, due, meta }) => (
                  <TaskRow
                    key={habit.id}
                    title={habit.name}
                    meta={meta}
                    disabled={!due}
                    onClick={() =>
                      pick({ id: habit.id, name: habit.name, desc: habit.desc, type: 1 }, habit.time)
                    }
                  />
                ))}
              </>
            ) : null}

            {!loading && visibleCount === 0 ? (
              <p className="py-6 text-center text-[12px] text-muted-foreground">
                {pickable.length === 0 && habits.length === 0
                  ? '还没有任务或习惯，先在「任务 / 习惯」页创建。'
                  : query.trim()
                    ? '没有找到匹配的内容'
                    : '这一类还没有内容'}
              </p>
            ) : null}
            {loading ? (
              <p className="py-6 text-center text-[12px] text-muted-foreground">正在读取…</p>
            ) : null}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function SectionLabel({
  icon: Icon,
  text,
}: {
  icon: ComponentType<{ className?: string }>
  text: string
}) {
  return (
    <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
      <Icon className="size-3" aria-hidden />
      {text}
    </p>
  )
}

function TaskRow({
  title,
  meta,
  disabled = false,
  onClick,
}: {
  title: string
  meta: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-left outline-none transition-colors',
        disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40',
      )}
    >
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-foreground">{title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{meta}</span>
      </span>
      {!disabled ? <span className="shrink-0 text-[11px] text-primary">选择</span> : null}
    </button>
  )
}
