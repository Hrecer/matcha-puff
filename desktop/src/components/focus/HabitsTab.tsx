import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpToLine, BarChart3, Check, GripVertical, Pencil, Play, Plus, Repeat, RotateCcw, SearchX, Trash2 } from 'lucide-react'
import type { Habit, HabitCycle, TaskRef } from '@matcha-puff/pomodoro-core'
import {
  HABIT_CYCLE_LABELS,
  HABIT_CYCLE_ORDER,
  habitCountdownText,
  habitScheduleLabel,
  needsCalendar,
  nextHabitDueDate,
} from '@matcha-puff/pomodoro-core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Empty } from '@/components/ui/empty'
import { SearchInput } from '@/components/ui/search-input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SlidingSegmented } from '@/components/ui/sliding'
import { Tip } from '@/components/ui/tooltip'
import { cn } from 'cn'
import { HabitFormDialog } from '@/components/focus/HabitFormDialog'
import { ConfirmDialog } from '@/components/focus/ConfirmDialog'
import { displayTaskColor } from '@/components/focus/calendar-utils'
import { quadrantMetaOf } from '@/components/focus/quadrants'
import { toast } from '@/components/ui/toast'
import { useFocusStore } from '@/lib/focus-store'
import { consumeJump, useJumpRequest } from '@/lib/focus-jump'
import {
  dayContextOf,
  invalidateFocusData,
  loadFocusData,
  newHabit,
  removeHabit,
  reorderHabits,
  useFocusData,
  type HabitNode,
} from '@/lib/focus-data'


type StatusFilter = 'all' | 'due' | 'done' | 'pending' | 'off'
type DurationFilter = 'all' | 'short' | 'medium' | 'long' | 'xlong'
type RunFilter = 'all' | 'never' | 'today' | 'week' | 'month' | 'few' | 'mid' | 'many'

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'due', label: '该做' },
  { value: 'done', label: '已完成' },
  { value: 'pending', label: '未完成' },
  { value: 'off', label: '休息' },
]

const DURATION_FILTERS: { value: DurationFilter; label: string }[] = [
  { value: 'all', label: '全部时长' },
  { value: 'short', label: '≤ 15 分钟' },
  { value: 'medium', label: '16–30 分钟' },
  { value: 'long', label: '31–60 分钟' },
  { value: 'xlong', label: '> 60 分钟' },
]

const RUN_FILTERS: { value: RunFilter; label: string }[] = [
  { value: 'all', label: '全部执行' },
  { value: 'never', label: '从未执行' },
  { value: 'today', label: '今天执行过' },
  { value: 'week', label: '最近 7 天' },
  { value: 'month', label: '最近 30 天' },
  { value: 'few', label: '已执行 1–9 次' },
  { value: 'mid', label: '已执行 10–49 次' },
  { value: 'many', label: '已执行 50 次以上' },
]

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 习惯页的滚动位置：切页签回来接着上次的位置。
 * 只在内存里（模块级变量），重启应用即清空 —— 和日历三视图那套做法一致，不做持久化。
 */
let habitsScrollMemory = 0

function startOfLocalDay(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}


function relativeTime(ms: number): string {
  if (!ms) return '还没执行'
  const diff = Date.now() - ms
  const day = 24 * 60 * 60 * 1000
  if (diff < 60 * 60 * 1000) return '刚刚'
  if (diff < day) return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`
  if (diff < day * 2) return '昨天'
  if (diff < day * 30) return `${Math.floor(diff / day)} 天前`
  return new Date(ms).toLocaleDateString('zh-CN')
}

const formatLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function HabitsTab({ onStart }: { onStart: (task: TaskRef, minutes: number) => void }) {
  const { habits, ready, holidayMissing } = useFocusData()
  const { snapshot } = useFocusStore()
  /** 正在计时的那条习惯（还没结算的也算）：删掉它会让这颗番茄的入账落在不存在的习惯上 */
  const runningHabitId =
    snapshot?.task?.id && (snapshot.phase !== 'idle' || snapshot.pending) ? snapshot.task.id : null
  const [draft, setDraft] = useState<Habit | null>(null)
  const [analysis, setAnalysis] = useState<HabitNode | null>(null)
  const [confirm, setConfirm] = useState<{ title: string; description: string; action: () => void } | null>(null)

  /** 搜索只覆盖名称和简介；周期、时长、状态、执行情况、日期全部走下面的筛选条 */
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [cycleFilter, setCycleFilter] = useState<'all' | HabitCycle>('all')
  const [durationFilter, setDurationFilter] = useState<DurationFilter>('all')
  const [runFilter, setRunFilter] = useState<RunFilter>('all')
  const [dayFilter, setDayFilter] = useState(0)

  useEffect(() => {
    void loadFocusData()
  }, [])

  useEffect(() => {
    // 到期判断依赖「今天」，不能只在进页面时算一次：
    // 跨过 0 点重算一次并接着排下一次；窗口重新获得焦点也重算（睡眠唤醒后计时器会漂）。
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      const next = new Date()
      next.setHours(24, 0, 1, 0)
      timer = setTimeout(() => {
        invalidateFocusData()
        schedule()
      }, next.getTime() - Date.now())
    }
    schedule()
    const onFocus = () => invalidateFocusData()
    window.addEventListener('focus', onFocus)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  /* ---------------- 布局与虚拟化 ---------------- */

  const GAP = 12

  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  /**
   * 当前的滚动位置。必须滚动时就记下来 —— 等到卸载再读 `el.scrollTop` 是读不到数的，
   * React 那时已经把卡片区摘空了，滚动高度塌成 0（和任务页那个坑一模一样）。
   */
  const scrollPosRef = useRef(0)
  /** 列数：内容宽度 ≥620 时两列，否则一列 */
  const [columns, setColumns] = useState(2)
  const [boxWidth, setBoxWidth] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(600)
  const [scrollTop, setScrollTop] = useState(0)
  /** 卡片高度（所有卡一样高：标题一行 + 简介固定两行）；先给估计值，挂载后量一次对齐 */
  const [cardHeight, setCardHeight] = useState(190)

  const ids = useMemo(() => habits.map((node) => node.habit.id), [habits])
  const byId = useMemo(() => new Map(habits.map((node) => [node.habit.id, node])), [habits])

  /** 今天的零点：判断「今天做完没有」「最近 N 天」都用它 */
  const todayStart = startOfLocalDay(Date.now())

  const filterActive =
    query.trim().length > 0 ||
    statusFilter !== 'all' ||
    cycleFilter !== 'all' ||
    durationFilter !== 'all' ||
    runFilter !== 'all' ||
    dayFilter > 0

  /** beginDrag 要稳定引用（卡片 memo），筛选状态通过 ref 读 */
  const filterActiveRef = useRef(false)
  filterActiveRef.current = filterActive

  /**
   * 名称 + 简介做全文匹配（空格分词、全部命中）；其余条件都是筛选，互相互斥、组合生效。
   * 执行类判断都只认 success 的记录：开始后中断的占位记录不算执行。
   */
  const filteredIds = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const dayStart = dayFilter > 0 ? startOfLocalDay(dayFilter) : 0

    return ids.filter((id) => {
      const node = byId.get(id)
      if (!node) return false
      const { habit } = node

      if (terms.length > 0) {
        const text = `${habit.name}\n${habit.desc}`.toLowerCase()
        if (!terms.every((term) => text.includes(term))) return false
      }

      if (cycleFilter !== 'all' && habit.cycle !== cycleFilter) return false

      if (durationFilter !== 'all') {
        const minutes = habit.time
        if (durationFilter === 'short' && minutes > 15) return false
        if (durationFilter === 'medium' && (minutes < 16 || minutes > 30)) return false
        if (durationFilter === 'long' && (minutes < 31 || minutes > 60)) return false
        if (durationFilter === 'xlong' && minutes <= 60) return false
      }

      if (statusFilter === 'due' && !node.due) return false
      if (statusFilter === 'done' && node.state !== 'done') return false
      if (statusFilter === 'pending' && node.state !== 'pending') return false
      if (statusFilter === 'off' && node.due) return false

      const lastSuccess = node.logs.find((log) => log.success)?.time ?? 0
      if (runFilter === 'never' && node.count > 0) return false
      if (runFilter === 'today' && lastSuccess < todayStart) return false
      if (runFilter === 'week' && lastSuccess < todayStart - 6 * DAY_MS) return false
      if (runFilter === 'month' && lastSuccess < todayStart - 29 * DAY_MS) return false
      if (runFilter === 'few' && (node.count < 1 || node.count > 9)) return false
      if (runFilter === 'mid' && (node.count < 10 || node.count > 49)) return false
      if (runFilter === 'many' && node.count < 50) return false

      if (dayStart > 0) {
        const hit = node.logs.some(
          (log) => log.success && log.time >= dayStart && log.time < dayStart + DAY_MS,
        )
        if (!hit) return false
      }

      return true
    })
  }, [ids, byId, query, statusFilter, cycleFilter, durationFilter, runFilter, dayFilter, todayStart])

  const clearFilters = useCallback(() => {
    setQuery('')
    setStatusFilter('all')
    setCycleFilter('all')
    setDurationFilter('all')
    setRunFilter('all')
    setDayFilter(0)
  }, [])

  /**
   * 跳转进行中的标记：这段时间里「筛选变了回顶部」必须让路。
   * 跳转自己会清筛选，而清筛选又会触发下面这个 effect 把容器按回 0，
   * 于是平滑滚动就变成「从左上角一路滑下来」，而不是从当前位置挪过去。
   */
  const jumpPendingRef = useRef(false)

  /**
   * 筛选条件的签名。用来判断「条件是不是真的变了」：
   * 只靠「跳过首次运行」挡不住 StrictMode —— 它会把 effect 跑两遍，
   * 第二遍时那个"首次"标记已经是 true，于是条件没变也会把位置按回顶部。
   */
  const filtersSigRef = useRef<string | null>(null)

  // 搜索/筛选条件一变就回到顶部，不继承上一份结果的位置（跳转中除外）
  useEffect(() => {
    const sig = [query, statusFilter, cycleFilter, durationFilter, runFilter, dayFilter].join('|')
    const prev = filtersSigRef.current
    filtersSigRef.current = sig
    // 首次null（挂载）与「签名没变」都不算变化，只有真的改了条件才回顶部
    if (prev === null || prev === sig) return
    if (jumpPendingRef.current) return
    const el = scrollRef.current
    if (el) el.scrollTop = 0
    scrollPosRef.current = 0
    setScrollTop(0)
  }, [query, statusFilter, cycleFilter, durationFilter, runFilter, dayFilter])

  const columnWidth = boxWidth > 0 ? (boxWidth - GAP * (columns - 1)) / columns : 0
  const rowStep = cardHeight + GAP

  /**
   * 卡片区和滚动容器都是「有习惯时才渲染」的，所以观察器必须跟着这个开关重挂：
   * 只写 [] 的话，首屏还在加载时 ref 是 null，之后卡片出来了也永远不会再量，宽度会一直是 0
   * （卡片被压成一条竖缝，就是这么来的）。
   */
  const hasHabits = habits.length > 0

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const sync = () => {
      setBoxWidth(el.clientWidth)
      setColumns(el.clientWidth >= 620 ? 2 : 1)
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasHabits])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const sync = () => setViewportHeight(el.clientHeight)
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasHabits])

  /**
   * 量第一张卡的真实高度。必须等列宽算出来再量 —— 之前宽度还是 0 时卡片被挤成一列，
   * 量到的高度是所有文字竖排后的高度，行距因此被撑到几百像素。
   * 用 ResizeObserver 跟着量：字号、窗口宽度变了都会重算。
   */
  const firstCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = firstCardRef.current
    if (!el || columnWidth <= 0) return
    const sync = () => {
      const height = el.offsetHeight
      if (height > 0) setCardHeight((prev) => (Math.abs(prev - height) > 0.5 ? height : prev))
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  }, [columnWidth, columns, ids.length])

  /* ---------------- 拖拽排序 ---------------- */

  const [dragId, setDragId] = useState<string | null>(null)
  /** 拖动中的预览顺序：每跨过一格就真的把数组挪一下，其它卡片因此会「让位」 */
  const [preview, setPreview] = useState<string[] | null>(null)
  const previewRef = useRef<string[] | null>(null)
  previewRef.current = preview

  const order = filterActive ? filteredIds : (preview ?? ids)
  const rowCount = Math.ceil(order.length / columns)
  const activeNode = dragId ? (byId.get(dragId) ?? null) : null

  /**
   * 从日视图跳过来：清掉筛选（否则目标可能被滤掉），再把这张卡滚进视野。
   * 卡片是按「第几行 × 行高」绝对定位的，所以只要算出它在 order 里的下标就够了。
   */
  const [jumpTarget, setJumpTarget] = useState<string | null>(null)
  const jump = useJumpRequest()
  useEffect(() => {
    if (!jump || jump.kind !== 'habit') return
    jumpPendingRef.current = true
    setQuery('')
    setCycleFilter('all')
    setRunFilter('all')
    consumeJump('habit')
    setJumpTarget(jump.id)
  }, [jump])

  useEffect(() => {
    if (!jumpTarget) return
    const el = scrollRef.current
    if (!el) return
    // 等一帧：清筛选之后 order / columns 会重算，这一帧之后才算得出最终位置
    const raf = requestAnimationFrame(() => {
      const index = order.indexOf(jumpTarget)
      if (index < 0) return
      const target = Math.max(0, Math.floor(index / columns) * rowStep - 8)
      // 一律平滑：起点已经是「你刚才的位置」，滑过去才是从下往上（或从上往下）的移动感。
      el.scrollTo({ top: target, behavior: 'smooth' })
      scrollPosRef.current = target
    })
    // 闪烁时长 1 秒：和任务页那边一致
    const timer = window.setTimeout(() => {
      setJumpTarget(null)
      jumpPendingRef.current = false
    }, 1000)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(timer)
    }
  }, [jumpTarget, order, columns, rowStep])

  /**
   * 位置保持：切去别的页签再回来，接着上次看到的地方（只在内存里，重启即丢）。
   *
   * 【跳转时也要恢复】以前这里见到待跳转就跳过恢复，结果起点永远是 0，
   * 画面就成了「从最上面往下滑到目标卡」。正确做法是先把上次的位置恢复出来，
   * 再让跳转从那个位置滑向目标 —— 在下面往回跳，动画就是从下往上。
   * 恢复是 layout 阶段做的，跳转的滚动在之后的 rAF 里，顺序上是「先恢复、再移动」。
   */
  const restoredRef = useRef(false)
  useLayoutEffect(() => {
    if (restoredRef.current) return
    if (!hasHabits) return
    const el = scrollRef.current
    if (!el) return
    restoredRef.current = true
    const maxTop = Math.max(0, el.scrollHeight - el.clientHeight)
    const top = Math.min(habitsScrollMemory, maxTop)
    if (top > 0) el.scrollTop = top
    scrollPosRef.current = top
    setScrollTop(top)
  }, [hasHabits, jump])

  // 离开页面时记一次位置（用 ref，不现读 DOM）
  useEffect(() => () => {
    habitsScrollMemory = scrollPosRef.current
  }, [])

  // 落库后 ids 会变成新顺序；等它追上预览顺序再丢掉预览，中间就不会闪回旧顺序
  useEffect(() => {
    if (!preview) return
    if (preview.length === ids.length && preview.every((id, index) => id === ids[index])) {
      setPreview(null)
    }
  }, [ids, preview])

  // 只渲染视口内的卡片，上下各多留一行
  const firstRow = Math.max(0, Math.floor(scrollTop / rowStep) - 1)
  const lastRow = Math.min(rowCount - 1, Math.ceil((scrollTop + viewportHeight) / rowStep) + 1)
  const visibleStart = firstRow * columns
  const visibleEnd = Math.min(order.length, (lastRow + 1) * columns)

  /**
   * 拖拽状态全放 ref：指针每动一次都不进 React，只有「跨过一格」才 setState 重排。
   * 高频移动期间零 React 工作 —— 每帧只写一次浮层的 transform。
   */
  const dragRef = useRef<{
    id: string
    pointerId: number
    x: number
    y: number
    grabX: number
    grabY: number
    w: number
    h: number
    slot: number
    raf: number
  } | null>(null)

  /** 帧内要用的值都放这里，回调才能保持 [] 依赖、卡片 memo 才不会失效 */
  const metricsRef = useRef({ columnWidth, rowStep, columns, ids, order })
  metricsRef.current = { columnWidth, rowStep, columns, ids, order }

  const floatRef = useRef<HTMLDivElement>(null)
  /** 指针是否已经拖出可放置区域：在外面松手＝取消这次移动 */
  const outsideRef = useRef(false)

  const placeFloat = useCallback(() => {
    const st = dragRef.current
    const float = floatRef.current
    if (!st || !float) return
    float.style.transform = `translate3d(${st.x - st.grabX}px, ${st.y - st.grabY}px, 0)`
  }, [])

  // 浮层一挂出来就摆到指针下：不这么做，从按下到第一次 rAF 之间有一帧
  // 它停在 fixed 的初始位（视口左上角），看着就像开始专注按钮掉在背景上
  useLayoutEffect(() => {
    if (dragId) placeFloat()
  }, [dragId, placeFloat])

  /** 每帧只做三件事：挪浮层、贴边滚动、判断有没有跨格 —— 都不触发 React 渲染 */
  const tick = useCallback(() => {
    const st = dragRef.current
    if (!st) return
    st.raf = 0
    placeFloat()

    const scroller = scrollRef.current
    if (scroller) {
      const rect = scroller.getBoundingClientRect()
      const inside =
        st.x >= rect.left && st.x <= rect.right && st.y >= rect.top && st.y <= rect.bottom
      if (!inside) {
        // 出了列表区域＝取消这次移动：先回到原顺序给用户看结果，
        // 同时直接返回 —— 不能让贴边滚动继续跑，否则拖到外面会一路滚到底。
        if (!outsideRef.current) {
          outsideRef.current = true
          previewRef.current = null
          // 预览清掉后，卡片回到了原始下标，当前格也要跟着回到那里
          st.slot = metricsRef.current.ids.indexOf(st.id)
          setPreview(null)
        }
        return
      }
      if (outsideRef.current) {
        // 又拖回来了：恢复预览顺序，可以继续排
        outsideRef.current = false
        previewRef.current = metricsRef.current.ids
        st.slot = metricsRef.current.ids.indexOf(st.id)
        setPreview(metricsRef.current.ids)
      }
      const edge = 56
      if (st.y < rect.top + edge) scroller.scrollBy({ top: -12 })
      else if (st.y > rect.bottom - edge) scroller.scrollBy({ top: 12 })
    }

    const grid = gridRef.current
    const { columnWidth: colW, rowStep: step, columns: cols, order: list } = metricsRef.current
    if (!grid || colW <= 0 || step <= 0) return

    const box = grid.getBoundingClientRect()
    // 用卡片中心而不是指针位置：握住卡片左边缘拖动也不会算错格
    const cx = st.x - st.grabX + st.w / 2 - box.left
    const cy = st.y - st.grabY + st.h / 2 - box.top
    const rows = Math.ceil(list.length / cols)
    const row = Math.min(rows - 1, Math.max(0, Math.floor(cy / step)))
    const column = Math.min(cols - 1, Math.max(0, Math.floor(cx / (colW + GAP))))
    const target = Math.min(list.length - 1, row * cols + column)
    // 没跨格就到此为止：这一帧不会有任何 React 工作
    if (target === st.slot) return
    st.slot = target

    setPreview((prev) => {
      const src = prev ?? metricsRef.current.ids
      const from = src.indexOf(st.id)
      if (from < 0 || from === target) return prev
      const next = [...src]
      const [moved] = next.splice(from, 1)
      next.splice(target, 0, moved!)
      // 记到 ref 上：松手那一刻要按最新的预览顺序落库，不等下一帧渲染
      previewRef.current = next
      return next
    })
  }, [placeFloat])

  const beginDrag = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>, node: HabitNode) => {
      // 筛选时不能改顺序：拖动的只是筛后子集，落库会把整棵顺序搅乱
      if (event.button !== 0 || filterActiveRef.current) return
      const card = (event.currentTarget as HTMLElement).closest<HTMLElement>('[data-habit-card]')
      if (!card) return
      event.preventDefault()
      const rect = card.getBoundingClientRect()
      dragRef.current = {
        id: node.habit.id,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        grabX: event.clientX - rect.left,
        grabY: event.clientY - rect.top,
        w: rect.width,
        h: rect.height,
        slot: metricsRef.current.order.indexOf(node.habit.id),
        raf: 0,
      }
      // 捕获挂在滚动容器上：它整场都在，卡片本体被隐藏、被虚拟窗口换掉都不影响后续事件
      scrollRef.current?.setPointerCapture(event.pointerId)
      outsideRef.current = false
      setDragId(node.habit.id)
      setPreview(metricsRef.current.ids)
    },
    [],
  )

  const moveDrag = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const st = dragRef.current
      if (!st || event.pointerId !== st.pointerId) return
      st.x = event.clientX
      st.y = event.clientY
      if (!st.raf) st.raf = requestAnimationFrame(tick)
    },
    [tick],
  )

  const finishDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const st = dragRef.current
    if (!st || event.pointerId !== st.pointerId) return
    dragRef.current = null
    if (st.raf) cancelAnimationFrame(st.raf)
    const scroller = scrollRef.current
    if (scroller?.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId)
    }
    setDragId(null)
    outsideRef.current = false

    // 最终落点在列表区域外＝取消这次移动，不落库
    const rect = scroller?.getBoundingClientRect()
    if (
      !rect ||
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      setPreview(null)
      return
    }

    const next = previewRef.current
    if (!next) return
    const from = metricsRef.current.ids.indexOf(st.id)
    const to = next.indexOf(st.id)
    // 顺序没变就清掉预览；变了就保留，等库里的数据追上（上面那个 effect 负责清）
    if (from < 0 || to < 0 || from === to) {
      setPreview(null)
      return
    }
    void reorderHabits(next)
  }, [])

  const cancelDrag = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const st = dragRef.current
    if (!st || event.pointerId !== st.pointerId) return
    dragRef.current = null
    if (st.raf) cancelAnimationFrame(st.raf)
    const scroller = scrollRef.current
    if (scroller?.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId)
    }
    setDragId(null)
    outsideRef.current = false
    setPreview(null)
  }, [])

  // 浮层刚出现时先摆回卡片原来的位置，避免闪一下左上角
  useLayoutEffect(() => {
    if (dragId) placeFloat()
  }, [dragId, placeFloat])

  /* ---------------- 卡片回调（保持引用稳定，卡片才能 memo 住不重渲染） ---------------- */

  const startHabit = useCallback(
    (node: HabitNode) => {
      onStart(
        { id: node.habit.id, name: node.habit.name, desc: node.habit.desc, type: 1 },
        node.habit.time,
      )
    },
    [onStart],
  )

  const editHabit = useCallback((node: HabitNode) => setDraft(node.habit), [])

  const analyzeHabit = useCallback((node: HabitNode) => setAnalysis(node), [])

  /** 键盘排序：把手聚焦后按方向键挪一格，省得只能靠鼠标 */
  const moveHabit = useCallback(
    (node: HabitNode, delta: number) => {
      const from = ids.indexOf(node.habit.id)
      if (from < 0) return
      const to = Math.min(ids.length - 1, Math.max(0, from + delta))
      if (from === to) return
      const next = [...ids]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved!)
      void reorderHabits(next)
    },
    [ids],
  )

  const deleteHabit = useCallback(
    (node: HabitNode) => {
      if (node.habit.id === runningHabitId) {
        toast('计时进行中，请先停止计时再删除习惯', 'error')
        return
      }
      setConfirm({
        title: `删除习惯 ${node.habit.name}`,
        description: '该习惯及其全部执行记录将被永久删除，无法恢复。',
        action: () => void removeHabit(node.habit.id),
      })
    },
    [runningHabitId],
  )

  const dueCount = habits.filter((item) => item.due).length
  const analysisDoneToday = (analysis?.doneToday ?? 0) > 0
  const analysisFrom = analysisDoneToday
    ? new Date(startOfLocalDay(Date.now()) + DAY_MS)
    : new Date()
  const analysisNext = analysis ? nextHabitDueDate(analysis.habit, analysisFrom, dayContextOf) : null
  const analysisCountdown = analysis
    ? habitCountdownText(analysis.habit, analysisFrom, dayContextOf)
    : null

  /**
   * 今日置顶：未完成 → 今日已完成 → 今天不用做。
   *
   * 组内保持当前的相对顺序，所以反复点也不会把顺序搅乱；
   * 做完的习惯不会消失（卡片要留着看标识），只是沉到未完成的后面。
   */
  const pinDueToTop = useCallback(() => {
    if (dueCount === 0) return
    const pending: string[] = []
    const done: string[] = []
    const off: string[] = []
    for (const id of ids) {
      const node = byId.get(id)
      if (node?.state === 'pending') pending.push(id)
      else if (node?.state === 'done') done.push(id)
      else off.push(id)
    }
    const next = [...pending, ...done, ...off]
    const changed = next.some((id, index) => id !== ids[index])
    if (changed) void reorderHabits(next)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [dueCount, ids, byId])

  /** 一张卡片的绝对定位外壳：位置只由下标算出来，顺序一变就能用 transform 过渡 */
  const renderCard = (id: string, index: number) => {
    const node = byId.get(id)
    if (!node) return null
    const isActive = id === dragId
    return (
      <div
        key={id}
        ref={index === visibleStart ? firstCardRef : undefined}
        className="absolute left-0 top-0"
        style={{
          width: columnWidth,
          transform: `translate3d(${(index % columns) * (columnWidth + GAP)}px, ${
            Math.floor(index / columns) * rowStep
          }px, 0)`,
          // 拖动时其它卡片平滑让位（被拖的那张交给浮层，不需要过渡）
          transition:
            dragId && !isActive ? 'transform 160ms cubic-bezier(0.2, 0, 0, 1)' : undefined,
        }}
      >
        <HabitCard
          node={node}
          flash={jumpTarget === id}
          dragging={isActive}
          sortable={!filterActive}
          onGripDown={beginDrag}
          onStart={startHabit}
          onEdit={editHabit}
          onAnalyze={analyzeHabit}
          onDelete={deleteHabit}
          onMove={moveHabit}
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 pt-2">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11.5px] text-muted-foreground">
            {habits.length === 0
              ? '按周期重复的事，用专注时间累计执行'
              : filterActive
                ? `匹配 ${filteredIds.length} 个 / 共 ${habits.length} 个`
                : `今天该做 ${dueCount} 个 / 共 ${habits.length} 个`}
          </p>
          {holidayMissing && habits.some((node) => needsCalendar(node.habit.cycle)) ? (
            <p className="mt-0.5 text-[10.5px] text-muted-foreground/80">
              节假日数据未获取：工作日按周一至周五计算，联网后自动更正
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={pinDueToTop}
            disabled={dueCount === 0}
            aria-label="按未完成、已完成、今天不用做的顺序排列"
          >
            <ArrowUpToLine className="size-3.5" aria-hidden />
            今日置顶
          </Button>
          <Button size="sm" onClick={() => setDraft(newHabit('', '', 'daily', 25))}>
            <Plus className="size-3.5" aria-hidden />
            新建习惯
          </Button>
        </div>
      </div>

      {/* 筛选分两行：第一行「搜索 + 今日状态」，第二行「周期 / 时长 / 执行情况 / 某天」。
          不用 flex-wrap 碰运气换行 —— 哪两个控件挨在一起是定死的，窄窗也不会乱排。 */}
      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={query}
            onValueChange={setQuery}
            placeholder="搜索名称或简介…"
            className="h-8 w-[210px] shrink-0"
          />
          <SlidingSegmented
            options={STATUS_FILTERS}
            value={statusFilter}
            onValueChange={setStatusFilter}
            ariaLabel="按今日状态筛选"
          />
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={clearFilters}
            disabled={!filterActive}
            aria-label="清空搜索和筛选"
            title="清空搜索和筛选"
          >
            <RotateCcw className="size-3.5" aria-hidden />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={cycleFilter}
            onValueChange={(value) => setCycleFilter(value as 'all' | HabitCycle)}
          >
            <SelectTrigger size="sm" className="w-[124px] text-[12px]" aria-label="按周期筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} viewportClassName="scroll-thin">
              <SelectItem value="all">全部周期</SelectItem>
              {HABIT_CYCLE_ORDER.map((cycle) => (
                <SelectItem key={cycle} value={cycle}>
                  {HABIT_CYCLE_LABELS[cycle]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={durationFilter}
            onValueChange={(value) => setDurationFilter(value as DurationFilter)}
          >
            <SelectTrigger size="sm" className="w-[118px] text-[12px]" aria-label="按单次时长筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} viewportClassName="scroll-thin">
              {DURATION_FILTERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={runFilter}
            onValueChange={(value) => setRunFilter(value as RunFilter)}
          >
            <SelectTrigger size="sm" className="w-[150px] text-[12px]" aria-label="按执行情况筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} viewportClassName="scroll-thin">
              {RUN_FILTERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateField
            value={dayFilter}
            onChange={setDayFilter}
            placeholder="某天完成过"
            className="h-8 w-[126px] px-2 text-[12px]"
            ariaLabel="按执行日期筛选"
          />
        </div>
      </div>

      {!ready ? <p className="px-1 text-xs text-muted-foreground">正在读取习惯…</p> : null}

      {/* 始终有一张实色卡片：空状态也在这张卡里居中，不是直接浮在背景上 */}
      <section className="card-solid flex min-h-0 flex-1 flex-col overflow-hidden px-2.5 py-2">
        {ready && habits.length === 0 ? (
          <Empty
            icon={Repeat}
            title="还没有习惯"
            description="读书、跑步、复盘——设一个周期，到日子就能直接开始一段专注。"
            size="sm"
            className="flex-1 py-16"
          />
        ) : (
          /* 卡片区单独滚动：上面那行「今天该做…」和新建按钮始终留在视野里 */
          <div
            ref={scrollRef}
            onScroll={(event) => {
              // 坐标先落 ref，卸载时才有真值可用（见 scrollPosRef 的说明）
              scrollPosRef.current = event.currentTarget.scrollTop
              setScrollTop(event.currentTarget.scrollTop)
            }}
            onPointerMove={moveDrag}
            onPointerUp={finishDrag}
            onPointerCancel={cancelDrag}
            // 上下各留 4px：第一张卡片不能紧贴滚动容器的上边缘 ——
            // 贴边时上边框正落在裁剪边界上，外缘半像素被裁掉，看起来比另外三边细
            className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-0.5 py-1 scroll-thin"
          >
          <div
            ref={gridRef}
            className="relative select-none"
            style={{ height: Math.max(0, rowCount * rowStep - GAP) }}
          >
            {order
              .slice(visibleStart, visibleEnd)
              .map((id, offset) => renderCard(id, visibleStart + offset))}
          </div>
          {filterActive && filteredIds.length === 0 ? (
            <Empty
              icon={SearchX}
              title="没有匹配的习惯"
              description="换个关键词，或清空筛选条件再试。"
              action={
                <Button size="sm" variant="outline" onClick={clearFilters}>
                  清空搜索和筛选
                </Button>
              }
              size="sm"
              className="py-16"
            />
          ) : null}
          </div>
        )}
      </section>

      {/* 跟手的那张卡：fixed 定位，位置由桌面的 rAF 直接写 transform，不经过 React */}
      {activeNode && columnWidth > 0 ? (
        <div
          ref={floatRef}
          className="pointer-events-none fixed left-0 top-0 z-30"
          style={{ width: columnWidth }}
        >
          <HabitCard
            node={activeNode}
            presentational
            onStart={startHabit}
            onEdit={editHabit}
            onAnalyze={analyzeHabit}
            onDelete={deleteHabit}
            onMove={moveHabit}
          />
        </div>
      ) : null}

      <HabitFormDialog habit={draft} onOpenChange={(open) => !open && setDraft(null)} />

      <Dialog open={analysis !== null} onOpenChange={(open) => !open && setAnalysis(null)}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[15px]">{analysis?.habit.name} 执行记录</DialogTitle>
          </DialogHeader>
          {analysisNext && analysisCountdown ? (
            <p className="px-1 text-[10.5px] text-muted-foreground">
              下次执行：{formatLocalDate(analysisNext)} · {analysisCountdown}
            </p>
          ) : null}
          <div className="max-h-[360px] overflow-y-auto px-1 py-1 scroll-thin">
            {analysis && analysis.logs.filter((log) => log.success).length > 0 ? (
              <ol className="relative ml-2 pl-4">
                {analysis.logs
                  .filter((log) => log.success)
                  .slice(0, 60)
                  .map((log, index, rows) => (
                    <li key={log.id} className="relative pb-3">
                      {index < rows.length - 1 ? (
                        <span
                          className="absolute -left-[17px] top-2.5 -bottom-1.5 w-px bg-foreground/10"
                          aria-hidden
                        />
                      ) : null}
                      <span
                        className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary"
                        aria-hidden
                      />
                      <p className="text-[12px] text-foreground">
                        {new Date(log.time).toLocaleString('zh-CN', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-[10.5px] text-muted-foreground">{relativeTime(log.time)}</p>
                    </li>
                  ))}
              </ol>
            ) : (
              <p className="px-1 py-6 text-center text-[12px] text-muted-foreground">还没有完成的执行记录</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAnalysis(null)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        onOpenChange={(open) => !open && setConfirm(null)}
        onConfirm={() => confirm?.action()}
      />
    </div>
  )
}

/** 一张习惯卡片：回调都是稳定引用，配合 memo，拖动时只有「换位」的卡片重渲染 */
const HabitCard = memo(function HabitCard({
  node,
  flash = false,
  dragging = false,
  presentational = false,
  sortable = true,
  onGripDown,
  onStart,
  onEdit,
  onAnalyze,
  onDelete,
  onMove,
}: {
  node: HabitNode
  /** 从日视图跳过来的那一条：闪一下主色描边，确认「落到的是它」 */
  flash?: boolean
  /** 正在被拖：本体先隐藏，跟手的是浮层那张 */
  dragging?: boolean
  /** 浮层用的副本：长得一样，但不接任何手势 */
  presentational?: boolean
  /** 搜索/筛选时关闭排序：只允许整理完整列表，避免打乱筛后子集 */
  sortable?: boolean
  onGripDown?: (event: React.PointerEvent<HTMLButtonElement>, node: HabitNode) => void
  onStart: (node: HabitNode) => void
  onEdit: (node: HabitNode) => void
  onAnalyze: (node: HabitNode) => void
  onDelete: (node: HabitNode) => void
  /** 键盘排序：方向键挪一格 */
  onMove: (node: HabitNode, delta: number) => void
}) {
  const { habit, due, state, doneToday, count, lastTime } = node
  const scheduleLabel = habitScheduleLabel(habit)
  const countdown = habitCountdownText(habit, new Date(), dayContextOf)
  const quadrant = quadrantMetaOf(habit.quadrant)
  const draggable = sortable && !presentational

  return (
    <section
      data-habit-card={habit.id}
      className={cn(
        'flex h-full flex-col rounded-panel border border-[var(--card-edge)] bg-[var(--card-surface)] px-4 py-3 shadow-sm transition-shadow',
        due ? 'ring-1 ring-primary/25' : 'opacity-80',
        // 跳转落点：2px 主色内描边 + 一圈外发光，1.8 秒后自动消失
        flash && 'ring-2 ring-primary/60 shadow-[0_0_0_3px_rgba(49,83,42,0.18)]',
        // 被拖的这张原地隐藏：跟手的是浮层里的同一张卡，不会出现「两个影子」。
        // 必须用 display:none，不能用 invisible：卡片里的按钮带 transition-all，
        // visibility 会参与过渡，卡片本体消失后按钮还会在原位多停留一瞬。
        dragging && 'hidden',
      )}
    >
      <div className="flex flex-1 items-start gap-2">
        {/* 只有这个把手能起拖：卡片里还有开始/记录/编辑/删除四个按钮，整块可拖会误触 */}
        <button
          type="button"
          aria-label={draggable ? '拖动排序，方向键可上下移动' : '筛选状态下不可拖动排序'}
          aria-disabled={!draggable}
          onPointerDown={
            draggable && onGripDown ? (event) => onGripDown(event, node) : undefined
          }
          onKeyDown={
            draggable
              ? (event) => {
                  const delta =
                    event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                      ? -1
                      : event.key === 'ArrowRight' || event.key === 'ArrowDown'
                        ? 1
                        : 0
                  if (!delta) return
                  event.preventDefault()
                  onMove(node, delta)
                }
              : undefined
          }
          className={cn(
            'mt-0.5 flex size-4 shrink-0 touch-none items-center justify-center rounded text-muted-foreground/45 outline-none transition-colors hover:text-foreground',
            draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default opacity-40',
          )}
        >
          <GripVertical className="size-3.5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full border border-foreground/10"
              style={{ background: displayTaskColor(habit.color) }}
              aria-hidden
            />
            <h3 className="min-w-0 truncate text-[13px] font-semibold text-foreground">{habit.name}</h3>
          </div>
          {/* 第二行最左就是今日状态：不占标题行，也不额外占一行。
              今天不用做的（灰色）不给标识，只有该做没做 / 已经做过才有。 */}
          <div className="mt-0.5 flex flex-wrap items-center gap-1">
            {state === 'done' ? (
              <span
                title={doneToday > 1 ? `今天已完成 ${doneToday} 次` : '今天已完成'}
                className="flex h-[18px] shrink-0 items-center gap-0.5 rounded-[4px] bg-success px-1.5 text-[11px] font-medium leading-[18px] text-success-foreground"
              >
                <Check className="size-2.5" strokeWidth={3} aria-hidden />
                已完成
              </span>
            ) : state === 'pending' ? (
              <span className="flex h-[18px] shrink-0 items-center rounded-[4px] bg-[#c0392b] px-1.5 text-[11px] font-medium leading-[18px] text-[#fff7f5]">
                未完成
              </span>
            ) : null}
            <Badge
              variant={due ? 'secondary' : 'outline'}
              className="h-[18px] shrink-0 whitespace-nowrap px-1.5 py-0 text-[11px] leading-[18px]"
            >
              {scheduleLabel}
              {countdown ? <span className="text-primary/90"> · {countdown}</span> : null}
            </Badge>
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
          </div>
          {/* 简介：固定两行高，不限行数、不加省略号。超过两行就在这块里出细滚动条，
              卡片高度不跟着文字变，底部那一栏永远在同一个位置。
              whitespace-pre-line：简介里自己敲的换行要真的换行，不能被折叠成空格。 */}
          <p className="mt-0.5 h-[36px] overflow-y-auto whitespace-pre-line pr-0.5 text-[11px] leading-[18px] text-muted-foreground scroll-thin">
            {habit.desc}
          </p>
        </div>
        <Tip label={due ? '开始专注' : '今天不是执行日'}>
          <Button
            size="icon-sm"
            variant={due ? 'default' : 'ghost'}
            disabled={!due}
            aria-label="开始专注"
            onClick={() => onStart(node)}
          >
            <Play className="size-3.5" aria-hidden />
          </Button>
        </Tip>
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between gap-2 border-t border-foreground/6 pt-2.5">
        <p className="flex flex-wrap items-center gap-x-2 text-[10.5px] text-muted-foreground">
          <span className="font-mono tabular-nums text-foreground/80">{habit.time} 分钟</span>
          <span aria-hidden>·</span>
          <span>已执行 {count} 次</span>
          <span aria-hidden>·</span>
          <span>{relativeTime(lastTime)}</span>
        </p>
        <div className="flex shrink-0 items-center">
          <Tip label="执行记录">
            <Button size="icon-xs" variant="ghost" aria-label="执行记录" onClick={() => onAnalyze(node)}>
              <BarChart3 className="size-3" aria-hidden />
            </Button>
          </Tip>
          <Tip label="编辑">
            <Button size="icon-xs" variant="ghost" aria-label="编辑习惯" onClick={() => onEdit(node)}>
              <Pencil className="size-3" aria-hidden />
            </Button>
          </Tip>
          <Tip label="删除">
            <Button size="icon-xs" variant="ghost" aria-label="删除习惯" onClick={() => onDelete(node)}>
              <Trash2 className="size-3" aria-hidden />
            </Button>
          </Tip>
        </div>
      </div>
    </section>
  )
})

