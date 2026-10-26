import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Check, CheckCircle2, ChevronDown, CircleDot, Clock, FolderKanban, Archive, Pencil, Play, Plus, RotateCcw, SearchX, Trash2 } from 'lucide-react'
import { canMoveTask, taskCountdown } from '@matcha-puff/pomodoro-core'
import type { Task, TaskNode, TaskRef } from '@matcha-puff/pomodoro-core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DateField, toDateInput } from '@/components/ui/date-field'
import { Empty } from '@/components/ui/empty'
import { SearchInput } from '@/components/ui/search-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tip } from '@/components/ui/tooltip'
import { cn } from 'cn'
import { ConfirmDialog } from '@/components/focus/ConfirmDialog'
import { quadrantMetaOf } from '@/components/focus/quadrants'
import { TaskFormDialog, type TaskFormDraft } from '@/components/focus/TaskFormDialog'
import {
  archiveTask,
  loadFocusData,
  moveTaskTo,
  overdueTaskIds,
  topTaskViewOf,
  removeTask,
  subtaskViewOf,
  toggleTaskDone,
  useFocusData,
} from '@/lib/focus-data'
import { useFocusStore } from '@/lib/focus-store'
import { highlightTerms, matchesText, matchTerms } from '@/lib/highlight'
import { consumeJump, useJumpRequest } from '@/lib/focus-jump'
import { toast } from '@/components/ui/toast'

/**
 * 每层缩进。下限由卡片左缘决定：竖线画在上一层「环心」那一列（距卡片左缘 25px），
 * 缩进必须大于 25px，竖线才能整根落在子卡片的左侧之外、不压到卡片上；
 * 多出来的部分就是连接横线的长度。36 = 25 + 11px 横线，接得看得清。
 */
const INDENT = 36
/** 行块右侧预留的缩进余量（层）—— 行比卡片内容区窄这么多，缩进先吃掉这段余量，
    再往深处就超出卡片右缘、由底部横向滚动条接住（缩进不封顶） */
const INDENT_LEVELS = 4

/** 行高固定：虚拟列表按它算区间，拖拽落点也按它算，不再去量 DOM。
 *  50 = 46 的卡片 + 上下各 2px 缝隙 */
const ROW_HEIGHT = 50

/**
 * 搜索与筛选的口径。
 *
 * 任务是一棵树，所以筛选**不改树**，只决定「哪几行可见」：
 *   可见 = 命中的节点 ∪ 它们的祖先 ∪ 它们的后代
 * 也就是「命中的分支整支留着，没命中的收掉，只留一条到命中处的路」。
 * 祖先那截自己没命中，标成路径行（文字淡化）—— 它必须留着，
 * 否则缩进和 TreeGuides 的连接线会断成一棵看不出层级的散列表。
 */
type ProgressFilter = 'all' | 'none' | 'idle' | 'doing' | 'done'
type DateFilterMode = 'all' | 'today' | 'overdue' | 'unset' | 'day'

const PROGRESS_OPTIONS: { value: ProgressFilter; label: string }[] = [
  { value: 'all', label: '全部进度' },
  { value: 'none', label: '无计划' },
  { value: 'idle', label: '未开始' },
  { value: 'doing', label: '进行中' },
  { value: 'done', label: '已完成' },
]

const DATE_OPTIONS: { value: DateFilterMode; label: string }[] = [
  { value: 'all', label: '全部日期' },
  { value: 'today', label: '今天在计划内' },
  { value: 'overdue', label: '已逾期' },
  { value: 'unset', label: '未设日期' },
  { value: 'day', label: '指定某天' },
]

/** 本地自然日的零点：日期筛选一律按「天」比较，不掺时分秒 */
function startOfLocalDay(ms: number): number {
  const date = new Date(ms)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * 拖拽贴边自动滚动：每帧滚 7px（原 14px 太快，深层树里一闪就过去、落点难掐准）。
 * 上下触发带 44px；左右收窄到 28px —— 面板有近 800px 宽，太宽容易误触。
 * 浅树没有横向滚动范围，左右这两行自然空转，不会报错。
 */
const AUTO_SCROLL_STEP = 7
const AUTO_SCROLL_EDGE_Y = 44
const AUTO_SCROLL_EDGE_X = 28

/** 卡片左右各留的边距：只留一道很小的边缘 */
const CARD_GUTTER = 2

/** 卡片右侧额外让出的宽度：左边缘要贴紧，所以收窄全部让在右边。 */
const CARD_RIGHT_SPACE = 46

/** 行卡片在基准宽度上再横向拉长 20% */
const CARD_WIDTH_SCALE = 1.2

/** 基准行宽 = 100% - 这个数；实际行宽再 × CARD_WIDTH_SCALE。
 *  抽成常量是为了让横向滚动范围也能照它算（见 overflowX）。 */
const CARD_RESERVE = INDENT_LEVELS * INDENT + CARD_GUTTER * 2 + CARD_RIGHT_SPACE

/**
 * 落点（照 Explorer / VS Code 那套成熟做法）：
 * - before / after：插到目标行的前面 / 后面，与目标行同级
 * - into：放进目标行下，成为它的最后一个子节点
 * 只有「压在行上」才有落点：拖到面板空白处、最后一行下方、面板之外，一律没有落点，
 * 松手＝取消（不再有「塞到最外层末尾」这种去处）。
 * 还有一类「自己」落点（self）：被拖的行自己 + 它的整个子树是一整块不可放置区，
 * 整行连同上下边缘都不给落点，只在页头报一句原因 —— 设计说明见 hitTest。
 */
type DropMode = 'before' | 'after' | 'into' | 'self'

interface DropTarget {
  /** 指示线画在这一行上 */
  id: string
  mode: DropMode
  parentId: string | null
  index?: number
  /** 指示线缩进用：落点所在层级的缩进层数 */
  depth: number
  valid: boolean
  reason?: string
  /** 悬浮提示文案：说清「谁放进谁名下」，不再只报被拖走的那个是谁 */
  label: string
}

/**
 * 缩进参考线（IDE 那种竖向「接线」）整棵一起画，不再每行各画一段。
 *
 * 每一层的线只负责「把一个父节点的子节点连起来」，`codes` 里的每一位就是那一层的结论：
 * - `'1'` 继续：下面还有同层的兄弟，竖线贯通整行接过去；本行自己这一层还要在中线处
 *   补一段横线，一路压到把手圆环的环带上 —— 每个子节点都要挂到父层的竖线上；
 * - `'2'` 到此为止：本行是这一层最后一个子节点，竖线画到中线再直角拐到圆环上；
 * - `'0'` 不画：这棵子树已经结束 —— 必须整段不画，而不是画到一半再收口。
 *
 * 连接线画在卡片**上面**（TreeGuides z-20，压在卡面之上）：横线要接到把手圆环，
 * 就必然从卡片左边框穿进卡内一小段，这是刻意的 —— 只有这段压着卡面，
 * 父子关系才连得起来。缩进（INDENT）保证竖线本身不切进任何子卡片。
 *
 * 每行各画一段有两个必现的毛病：行与行的接缝处两个半圆线帽相接、转折处两根线搭接，
 * 放大就是「分成多段、粗细不均」。所以先把同一列上首尾相接的段并成一条，
 * 收尾那一行再用一条直角折线把竖线直接拐进圆环外缘 —— 一条括弧线一次画完。
 */
/** 圆环中心所在列的推算值：缝 2 + 卡片描边 1 + pl-2 的 8 + 把手一半 12（量不到时的兜底） */
const RING_COLUMN = 23
/**
 * 圆环的实际渲染尺寸：环半径 3.6px、描边 1.8px（外缘 4.5、内缘 2.7）。
 *
 * 圆环不再画在把手里，而是跟着参考线一起画进 TreeGuides 那份 svg —— 线和环在
 * 同一个透明度组里「先合成形状、再统一上 30% 透明度」：重叠处不会叠出深色，
 * 对齐也是同一坐标系里算出来的。这就是「融为一体」的物理保证，不靠像素 luck。
 *
 * 横线终点定在环半径（环带正中）：终点埋在环的描边里，合成出来的形状就是
 * 「线长进了圆环里」；不进孔、也不留缝。圆环尺寸改了，这两个值要跟着改。
 */
const RING_R = 3.6
const RING_STROKE = 1.8
/** 线宽 1.5px；端帽用平头（butt），不做圆头 —— 圆头会在端点鼓成半圆，看着像弧线 */
const GUIDE_W = 1.5

/** 一条参考线：d 是路径；color 是所属顶层任务的手动色，没有就沿用全局灰色 */
type GuidePath = { d: string; color?: string }

function buildGuidePaths(
  rows: { depth: number }[],
  codesOf: (index: number) => string,
  childOf: (index: number) => boolean,
  colorOf: (index: number) => string | undefined,
  start: number,
  end: number,
  baseX: number,
) {
  type Seg = { x: number; y1: number; y2: number; elbowX?: number; color?: string }
  const segs: Seg[] = []
  /** 每个非末位子节点接卡片的那一小段横线：一段一条 path，各自独立，绝不并进竖线
      （横线按行中线逐行出现，若混进竖线序列会把整根贯通竖线切断成一行一段，
      正是当年「接缝处分段、粗细不均」的老毛病）。 */
  const ties: GuidePath[] = []
  for (let i = start; i < end; i += 1) {
    const depth = rows[i]?.depth ?? 0
    const codes = codesOf(i)
    // 参考线跟着所属顶层任务的颜色走：子任务继承父级色，整棵子树一条色系
    const color = colorOf(i)
    const y0 = i * ROW_HEIGHT
    const cy = y0 + ROW_HEIGHT / 2
    const ringX = depth * INDENT + baseX
    for (let level = 0; level < depth; level += 1) {
      const code = codes[level]
      if (code === '0' || !code) continue
      const colX = level * INDENT + baseX
      // 横线终点埋在环带正中：合成后就是「线长进圆环里」的一个形状
      const tieX = ringX - RING_R
      if (code === '2') {
        // 收尾：竖线画到中线，一条折线接到圆环上
        segs.push({ x: colX, y1: y0, y2: cy, elbowX: tieX, color })
        continue
      }
      segs.push({ x: colX, y1: y0, y2: y0 + ROW_HEIGHT, color })
      // 本行自己这一层（最里层）：中线处补一段横线接到自己的圆环，
      // 让每个子节点都挂到父层的竖线上
      if (level === depth - 1) {
        ties.push({ d: `M ${colX} ${cy} L ${tieX} ${cy}`, color })
      }
    }
    // 下一行就是自己的孩子：从圆环下沿（环带正中）垂到行底，
    // 和下一行那一列本来就是同一条线
    if (childOf(i)) {
      segs.push({ x: ringX, y1: cy + RING_R, y2: y0 + ROW_HEIGHT, color })
    }
  }

  segs.sort((a, b) => a.x - b.x || a.y1 - b.y1)
  const paths: GuidePath[] = []
  let run: Seg | null = null
  const flush = () => {
    if (!run) return
    const { x, y1, y2, elbowX, color } = run
    if (elbowX === undefined) {
      paths.push({ d: `M ${x} ${y1} L ${x} ${y2}`, color })
    } else {
      // 直角拐进圆环：一条折线画完，不做圆角，也不分成两根线
      paths.push({ d: `M ${x} ${y1} L ${x} ${y2} L ${elbowX} ${y2}`, color })
    }
    run = null
  }
  for (const seg of segs) {
    // 同一列且首尾相接、颜色相同才并进当前这条；带拐弯的那段是一条括弧线的收尾，不再往后接
    if (
      run &&
      run.x === seg.x &&
      run.color === seg.color &&
      run.elbowX === undefined &&
      seg.y1 <= run.y2
    ) {
      run.y2 = Math.max(run.y2, seg.y2)
      run.elbowX = seg.elbowX
      continue
    }
    flush()
    run = { ...seg }
  }
  flush()
  return [...paths, ...ties]
}

/**
 * 整棵参考线连同所有把手圆环，一份 svg 画完。
 *
 * 关键在「同一个透明度组」：同一颜色的线和环先各自合成形状、再对合成结果统一上一次
 * 透明度 —— 线压到环上的地方不会叠出第二层深色，看起来就是一个连续的形状，这才是
 * 「融为一体」；按颜色分组后，每一棵设了色的子树各成一组，组内依旧不会叠色。
 * 对齐同理：环和线的列位都从同一个 baseX 长出来，误差为零。
 */
function TreeGuides({
  paths,
  rings,
}: {
  paths: GuidePath[]
  rings: { x: number; y: number; color?: string }[]
}) {
  // 按颜色分组：同一组里的线和环在同一个 opacity 组内合成，
  // 环与线交叠处不会叠出第二层深色（保持「融为一体」的观感）。
  const groups = new Map<string | undefined, { paths: string[]; rings: { x: number; y: number }[] }>()
  const groupOf = (color: string | undefined) => {
    const existing = groups.get(color)
    if (existing) return existing
    const created = { paths: [] as string[], rings: [] as { x: number; y: number }[] }
    groups.set(color, created)
    return created
  }
  for (const path of paths) groupOf(path.color).paths.push(path.d)
  for (const ring of rings) groupOf(ring.color).rings.push(ring)

  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 h-full w-full overflow-visible text-foreground"
      shapeRendering="geometricPrecision"
    >
      {[...groups].map(([color, group]) => (
        <g
          key={color ?? 'unset'}
          stroke={color ?? 'currentColor'}
          // 有颜色的子树压到 72%，既看得出色系，又不至于比卡片还抢眼
          opacity={color ? 0.72 : 0.3}
        >
          {group.paths.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              strokeWidth={GUIDE_W}
              strokeLinecap="butt"
              strokeLinejoin="miter"
            />
          ))}
          {group.rings.map((ring) => (
            <circle
              key={`${ring.x}|${ring.y}`}
              cx={ring.x}
              cy={ring.y}
              r={RING_R}
              fill="none"
              strokeWidth={RING_STROKE}
            />
          ))}
        </g>
      ))}
    </svg>
  )
}

export function TasksTab({ onStart }: { onStart: (task: TaskRef, minutes: number) => void }) {
  const { roots, ready } = useFocusData()
  const { config, snapshot } = useFocusStore()
  /**
   * 正在跑（或刚跑完还没入账）的那颗番茄挂在哪个任务上。
   * 这个任务在结算前不能被删掉、也不能变成容器 —— 前者会让这一颗番茄入账时找不到任务，后者会让它的番茄数失效。
   */
  const sessionTaskId =
    snapshot?.task?.id && (snapshot.phase !== 'idle' || snapshot.pending) ? snapshot.task.id : null
  const [draft, setDraft] = useState<TaskFormDraft | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set())

  /** 搜索关键字（空格分词，全部命中才算）与两档筛选 */
  const [query, setQuery] = useState('')
  const [progressFilter, setProgressFilter] = useState<ProgressFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilterMode>('all')
  /** 「指定某天」选中的那天（毫秒） */
  const [filterDay, setFilterDay] = useState(0)
  /**
   * 筛选态下手动收起的支，和常态的 collapsed 分开存。
   * 筛选时默认强制展开到命中处（否则搜到了却藏在折叠里，等于没搜到），
   * 但绝不去改用户原来那份 collapsed —— 清空筛选后折叠要原样回来。
   */
  const [filterCollapsed, setFilterCollapsed] = useState<Set<string>>(() => new Set())
  const [confirm, setConfirm] = useState<{
    title: string
    description: string
    action: () => void
    confirmText?: string
    /** notice＝只是提醒（按钮不改红）；默认按破坏性操作处理 */
    tone?: 'notice'
  } | null>(null)

  // 拖拽：自绘（pointer 事件 + 落点指示），不走 HTML5 DnD，免得和窗口拖拽区打架
  const [dragId, setDragId] = useState<string | null>(null)
  /** 指针位置只走 ref + 每帧一次 rAF，不进 React state：
      否则拖拽时每个 mousemove 都会重渲染整棵树（几百行一起重画）。 */
  const pointRef = useRef({ x: 0, y: 0 })
  const frameRef = useRef(0)
  const [drop, setDrop] = useState<DropTarget | null>(null)
  const dropRef = useRef<DropTarget | null>(null)
  /** 拖拽开始时把所有行元素抓一次（拖拽期间树不变），之后每帧只重新读它们的 rect */
  /**
   * 行元素缓存：内容没变的行直接复用上一次的 React 元素（同一个对象 React 会跳过整棵子树）。
   * 拖拽时落点一变，本来会让 200 行全部重渲；有了它每次只重渲「原来那一行 + 新那一行」。
   */
  const rowCache = useRef(new Map<string, { sig: string; el: ReactNode }>())
  const panelRef = useRef<HTMLElement>(null)
  /** 卡片内部那个纵向滚动容器 */
  const listRef = useRef<HTMLDivElement>(null)
  /**
   * 列表当前的滚动坐标（上下左右）。
   *
   * 必须在滚动过程中就记下来：等到卸载时再读 `el.scrollTop` 是读不到数的 ——
   * React 在跑 effect 清理之前已经把列表的 DOM 摘掉了，滚动高度塌成 0，
   * `scrollTop` 也就跟着归零（实测：跳到 342 之后切走，存下来的还是 0）。
   * 记在 ref 里不写盘，卸载时再一次性落盘，既拿到真值又不产生每帧 IO。
   */
  const scrollPosRef = useRef({ top: 0, left: 0 })
  /**
   * 列表容器的上下内边距（像素）。容器留了内边距，插入线和线头圆点才有缝上方的空间，
   * 不会被容器上缘裁掉；落点判定要把这段减掉，行位才准。拖拽开始时量一次存这里。
   */
  const listPadRef = useRef(0)

  useEffect(() => {
    void loadFocusData()
    // 归档不再自动触发：由用户在行上点「归档」按钮手动执行（见 archiveTask）
  }, [])

  /** 一次遍历拿到：节点表 / 每个节点在兄弟里的位置 / 扁平任务数组（给 canMoveTask 用） */
  const tree = useMemo(() => {
    const nodes = new Map<string, TaskNode>()
    const slots = new Map<string, { parentId: string | null; index: number }>()
    const list: Task[] = []
    const walk = (items: readonly TaskNode[], parentId: string | null) => {
      items.forEach((node, index) => {
        nodes.set(node.task.id, node)
        slots.set(node.task.id, { parentId, index })
        list.push(node.task)
        walk(node.children, node.task.id)
      })
    }
    walk(roots, null)
    return { nodes, slots, list }
  }, [roots])

  const totalCount = tree.list.length
  /** 倒数按自然日变化：跨天后行缓存也要失效一次。 */
  const todayStamp = startOfLocalDay(Date.now())

  /** 关键字拆词：搜索「周报 模板」＝标题或简介里两个词都得有（口径见 lib/highlight） */
  const terms = useMemo(() => matchTerms(query), [query])
  const filtering = terms.length > 0 || progressFilter !== 'all' || dateFilter !== 'all'
  /** 高亮与行缓存签名都按它比：命中词变了必须重渲 */
  const termKey = terms.join('|')

  // 筛选条件一变，上一组条件下临时收起的支就没有意义了。
  // 只在真有内容时才换新 Set：否则每敲一个字都会多一次无意义的重渲染
  useEffect(() => {
    setFilterCollapsed((prev) => (prev.size > 0 ? new Set() : prev))
  }, [termKey, progressFilter, dateFilter, filterDay])

  /**
   * 命中集合与可见集合。返回 null ＝ 没在筛选，树照常按 collapsed 渲染。
   *
   * 三档语义（看上面的类型注释）：
   *  - own     ：自己命中，标题里的关键字要打高亮
   *  - pathOnly：自己没命中、上面也没命中，只是通往某处命中的那截祖先 → 文字淡化
   *  - 其余可见行：父级命中后被整支带出来的（用户拍板：父命中＝这一支都相关）
   *
   * 数值口径不动：进度条和「N/M」仍按**全量子树**汇总，不按筛出来的子集重算 ——
   * 否则同一个父任务筛一下进度就从 40% 跳到 80%，数字等于在骗人。
   */
  const matchState = useMemo(() => {
    if (!filtering) return null
    const today = startOfLocalDay(Date.now())
    const anchorDay = filterDay > 0 ? startOfLocalDay(filterDay) : 0

    const passesDate = (node: TaskNode): boolean => {
      if (dateFilter === 'all') return true
      if (dateFilter === 'unset') return node.startDate <= 0 && node.endDate <= 0
      if (dateFilter === 'overdue') {
        return node.endDate > 0 && startOfLocalDay(node.endDate) < today && !node.complete
      }
      const day = dateFilter === 'today' ? today : anchorDay
      if (day <= 0) return true
      const from = node.startDate > 0 ? startOfLocalDay(node.startDate) : 0
      const to = node.endDate > 0 ? startOfLocalDay(node.endDate) : 0
      // 两端都没设：这一天不可能落在计划里
      if (from <= 0 && to <= 0) return false
      // 只设了一端就当单端约束（容器汇总是 min/max，天然也适用）
      return (from <= 0 || from <= day) && (to <= 0 || to >= day)
    }

    const passesProgress = (node: TaskNode): boolean => {
      if (progressFilter === 'all') return true
      if (progressFilter === 'done') return node.complete
      if (progressFilter === 'none') return node.plannedTotal <= 0 && !node.complete
      if (progressFilter === 'idle') return node.plannedTotal > 0 && node.doneCount <= 0
      return node.plannedTotal > 0 && node.doneCount > 0 && !node.complete
    }

    const passesText = (task: Task): boolean =>
      matchesText(`${task.title}\n${task.desc}`, terms)

    const own = new Set<string>()
    for (const node of tree.nodes.values()) {
      if (passesText(node.task) && passesProgress(node) && passesDate(node)) own.add(node.task.id)
    }

    // 子树里命中几处：自底向上算一遍，往下走时才知道这一支要不要为了后代留着
    const subtreeHits = new Map<string, number>()
    const collect = (node: TaskNode): number => {
      let hits = own.has(node.task.id) ? 1 : 0
      for (const child of node.children) hits += collect(child)
      subtreeHits.set(node.task.id, hits)
      return hits
    }
    for (const root of roots) collect(root)

    const visible = new Map<string, { own: boolean; pathOnly: boolean; hits: number }>()
    const visit = (node: TaskNode, inherited: boolean) => {
      const isOwn = own.has(node.task.id)
      const hits = subtreeHits.get(node.task.id) ?? 0
      // 自己命中、父级命中（整支保留）、或后代里有命中（补祖链）—— 三者之外一律不渲染
      if (!isOwn && !inherited && hits === 0) return
      visible.set(node.task.id, {
        own: isOwn,
        pathOnly: !isOwn && !inherited,
        hits,
      })
      for (const child of node.children) visit(child, inherited || isOwn)
    }
    for (const root of roots) visit(root, false)

    return { own, visible, hits: own.size }
  }, [filtering, terms, progressFilter, dateFilter, filterDay, tree, roots])

  /**
   * 某个容器当前是展开还是收起。
   * 筛选态下改看 filterCollapsed（默认全展开到命中处），常态才看用户自己那份 collapsed。
   */
  const isOpen = (id: string) =>
    matchState ? !filterCollapsed.has(id) : !collapsed.has(id)

  /**
   * 扁平成「当前真正显示出来的行」，顺带带上每行的层级。
   * 有了这张表，某一行下面还有没有更深的行（下一行的层级）就是查表，不用再递归算。
   */
  const flatRows = useMemo(() => {
    const rows: {
      node: TaskNode
      depth: number
      path: string[]
      /** 自己命中：标题要打高亮 */
      own: boolean
      /** 纯路径行：只为了把命中处接回根部 */
      pathOnly: boolean
      /** 这一支里有几处命中（路径行右侧标出来） */
      hits: number
    }[] = []
    const walk = (nodes: readonly TaskNode[], depth: number, path: string[]) => {
      for (const node of nodes) {
        const mark = matchState?.visible.get(node.task.id)
        // 筛选态下没进可见集合的分支，整支都不渲染
        if (matchState && !mark) continue
        const nextPath = [...path, node.task.id]
        rows.push({
          node,
          depth,
          path: nextPath,
          own: mark?.own ?? false,
          pathOnly: mark?.pathOnly ?? false,
          hits: mark?.hits ?? 0,
        })
        if (node.children.length > 0 && isOpen(node.task.id)) {
          walk(node.children, depth + 1, nextPath)
        }
      }
    }
    walk(roots, 0, [])
    return rows
    // isOpen 只依赖 collapsed / filterCollapsed / matchState，下面三个都进了依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roots, collapsed, matchState, filterCollapsed])

  /**
   * 从日视图跳过来：把目标任务「露出来」。
   *
   * 三步缺一不可——
   * 1. 清筛选：否则目标可能被当前的搜索/进度/日期条件挡在可见集合外；
   * 2. 展开祖先：目标若在收起的子树里，flatRows 里根本不会有这一行；
   * 3. 滚到它：按行高算出下标，直接定位（虚拟滚动只渲染视口，必须给 scrollTop）。
   */
  const [jumpTarget, setJumpTarget] = useState<string | null>(null)
  const jump = useJumpRequest()
  useEffect(() => {
    if (!jump || jump.kind !== 'task') return
    setQuery('')
    setProgressFilter('all')
    setDateFilter('all')
    setFilterCollapsed(new Set())
    setCollapsed((prev) => {
      const next = new Set(prev)
      for (
        let cur: string | null = tree.slots.get(jump.id)?.parentId ?? null;
        cur;
        cur = tree.slots.get(cur)?.parentId ?? null
      ) {
        next.delete(cur)
      }
      return next
    })
    consumeJump('task')
    setJumpTarget(jump.id)
  }, [jump, tree])

  // 展开、渲染之后再滚：flatRows 里才查得到目标下标与层级
  useEffect(() => {
    if (!jumpTarget) return
    const index = flatRows.findIndex((row) => row.node.task.id === jumpTarget)
    const el = listRef.current
    if (index >= 0 && el) {
      // 纵向：按固定行高换算位置（虚拟滚动不按 DOM 量，必须算 scrollTop）
      const top = Math.max(0, index * ROW_HEIGHT - 8)
      // 横向：每深一层整块右移 INDENT，深层任务可能已经滚到视野外很远的地方，
      // 所以左边距也要一起跟过去，否则「滚到了但看不见」。
      const left = Math.max(0, (flatRows[index]?.depth ?? 0) * INDENT + CARD_GUTTER - 8)
      // 起点是恢复出来的上次位置，无论多远都平滑滑过去
      el.scrollTo({ top, left, behavior: 'smooth' })
      // 平滑滚动是异步的：先把目标值写进 ref，万一动画没跑完就切走也不至于存个中间值
      scrollPosRef.current = { top, left }
    }
    // 闪烁时长 1 秒：够看清落点，又不至于停在那一行太久
    const timer = window.setTimeout(() => setJumpTarget(null), 1000)
    return () => window.clearTimeout(timer)
  }, [jumpTarget, flatRows])

  /**
   * 顶层任务 id → 手动色。颜色只挂在顶层，子任务按「所在顶层树」继承：
   * 把手浅底、圆环、连接线整棵子树同色；没设色的顶层（以及它的后代）保持灰色。
   */
  const rootColors = useMemo(() => {
    const map = new Map<string, string | undefined>()
    for (const root of roots) map.set(root.task.id, root.task.color)
    return map
  }, [roots])

  /**
   * 每个格子该不该有线、画到哪儿，一次算好（倒着扫一遍）：
   * 从下往上记「下一行（含以后）在第 k 层最近出现在哪」，再按上面的三条规则生成编码。
   */
  const guideCodes = useMemo(() => {
    const n = flatRows.length
    const maxDepth = flatRows.reduce((max, row) => Math.max(max, row.depth), 0)
    const nearestAtDepth: number[] = new Array(maxDepth + 2).fill(-1)
    const codes: string[] = new Array(n).fill('')

    for (let i = n - 1; i >= 0; i -= 1) {
      const depth = flatRows[i]!.depth
      let out = ''
      for (let level = 0; level < depth; level += 1) {
        const childLevel = level + 1
        // 后面最近的一行，只要层级 ≤ childLevel，就说明这一层往下已经走出去了
        let next = -1
        for (let k = 0; k <= childLevel; k += 1) {
          const hit = nearestAtDepth[k] ?? -1
          if (hit >= 0 && (next < 0 || hit < next)) next = hit
        }
        const nextDepth = next >= 0 ? flatRows[next]!.depth : -1
        if (nextDepth === childLevel) out += '1' // 下面还有同层兄弟 → 继续
        else if (depth === childLevel) out += '2' // 本行就是这一层最后一个子节点 → 收口
        else out += '0' // 子树已结束 → 整段不画
      }
      codes[i] = out
      nearestAtDepth[depth] = i
    }
    return codes
  }, [flatRows])


  /**
   * 一个任务第一次有子任务时，它自己那套计划就作废了：时间改为按子任务汇总、番茄数改为子任务合计，
   * 自己的这两栏会被清成「不定」，而且只要还有子任务就改不回来。
   * 这两样里只要有一个不是「不定」，动手前就得说一声；已经是容器（本来就不看它自己的）就不用说。
   */
  /** 这个任务本身、或它的祖先里，有没有正在计时的那个任务 */
  const holdsRunningTask = useCallback(
    (id: string): boolean => {
      if (!sessionTaskId) return false
      for (let current: string | null = sessionTaskId; current; ) {
        if (current === id) return true
        current = tree.slots.get(current)?.parentId ?? null
      }
      return false
    },
    [sessionTaskId, tree],
  )

  const clearsOwnPlan = useCallback(
    (id: string): boolean => {
      const node = tree.nodes.get(id)
      if (!node || node.children.length > 0) return false
      const { startDate, endDate, pomodoroTotal } = node.task
      return startDate > 0 || endDate > 0 || pomodoroTotal > 0
    },
    [tree],
  )

  const toggle = (id: string) => {
    // 筛选期间收起的是「临时收起」，写进 filterCollapsed，不碰用户原来那份 collapsed
    if (matchState) {
      setFilterCollapsed((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
      return
    }
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** 清空搜索与全部筛选（工具栏的清除按钮、空状态里的行动都用它） */
  const clearFilters = () => {
    setQuery('')
    setProgressFilter('all')
    setDateFilter('all')
    setFilterDay(0)
  }

  /**
   * 按指针纵向位置算落点。普通行分三带：上 30% 插到它前面、下 30% 插到它后面、
   * 中间 40% 放进它下 —— 任何任务都能当父级。行与行之间的缝隙、整棵树下方的空白区、
   * 第一行上方的空隙都算得出来，没有死区。
   *
   * 唯一的例外：被拖的行自己 + 它的整个子树。压在这一整块上时**不产生任何落点**（self）。
   * 因为「插到自己前面/后面」在数据上就是原地不动，同一个位置给两种说法只会让人以为
   * 有两个去处，线还会跟着上/下缘跳两处、过中带时闪一下。要放在自己旁边，走邻居行的
   * 边缘就够了：上面那行的下边缘＝插到它后面，下面那行的上边缘＝插到它前面。
   */
  const hitTest = useCallback(
    (x: number, y: number, dragging: string): DropTarget | null => {
      const list = listRef.current
      if (flatRows.length === 0 || !list) return null

      // 指针必须真的落在列表面板范围内：拖到侧栏、页头、面板外面就是「没有落点」（松手＝取消），
      // 否则会出现「鼠标都跑到别的区域了，浮窗还在报某个落点」这种莫名其妙的状态。
      const panel = panelRef.current?.getBoundingClientRect()
      if (panel && (x < panel.left || x > panel.right || y < panel.top || y > panel.bottom)) {
        return null
      }

      // 指针换算成「列表内容坐标」：行高固定，往下一切都能算出来，不用读 DOM。
      // 容器带上下内边距（给插入线和线头圆点留出缝上方的空间），所以要把这部分减掉，
      // 否则所有落点会整体下偏一个内边距。
      const listRect = list.getBoundingClientRect()
      const yInContent = y - listRect.top + list.scrollTop - listPadRef.current
      const total = flatRows.length * ROW_HEIGHT

      // 落到最后一行下方＝没有落点，松手取消：不存在「塞到最外层末尾」这种去处，
      // 想放到最后就拖到最后那一行的下边缘。
      if (yInContent >= total) return null

      const hitIndex = Math.min(
        flatRows.length - 1,
        Math.max(0, Math.floor(yInContent / ROW_HEIGHT)),
      )
      let mode: DropMode = 'before'
      if (yInContent >= 0) {
        const ratio = (yInContent - hitIndex * ROW_HEIGHT) / ROW_HEIGHT
        mode = ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'into'
      }
      // y 落在第一行上方（列表顶部内边距）→ 保持 before：插到第一行之前

      const target = flatRows[hitIndex]!
      const targetId = target.node.task.id
      const rowDepth = target.depth
      const slot = tree.slots.get(targetId)
      const targetTitle = tree.nodes.get(targetId)?.task.title ?? ''
      const draggingTitle = tree.nodes.get(dragging)?.task.title ?? ''

      /** targetId 是不是被拖节点自己、或它的某个后代（从 target 往上爬父链即可） */
      const withinSelfSubtree = (targetId: string): boolean => {
        for (let current: string | null = targetId; current; current = tree.slots.get(current)?.parentId ?? null) {
          if (current === dragging) return true
        }
        return false
      }

      // 压在「被拖的行自己 + 它的子树」上＝整块不可放置区：不画线、不高亮，页头报一句原因。
      // 放这里拦掉之后，「自己行的上/下边缘」这两个假落点就不存在了，怎么移动都是同一种状态。
      if (withinSelfSubtree(targetId)) {
        return {
          id: targetId,
          mode: 'self',
          parentId: null,
          index: undefined,
          depth: rowDepth,
          valid: false,
          label: `不能把 ${draggingTitle} 放进自己或自己的子任务里`,
        }
      }

      const from = tree.slots.get(dragging)
      /** moveTask 的 index 是「拿掉被拖节点之后」的位置：同父级里往后挪要把多算的那一位减掉，
          否则会错一位（看着是插到这一行后面，实际落到下一个兄弟后面）。 */
      const compensated = (raw: number, parent: string | null): number =>
        from && from.parentId === parent && from.index < raw ? raw - 1 : raw

      let parentId: string | null = null
      let index: number | undefined
      if (mode === 'into') {
        parentId = targetId
        index = undefined // 追加成它的最后一个子节点
      } else {
        parentId = slot?.parentId ?? null
        index = compensated(
          Math.max(0, (slot?.index ?? 0) + (mode === 'after' ? 1 : 0)),
          parentId,
        )
      }

      // 放不进自己的子树这条已经由上面的 self 区拦掉，这里再问一次领域规则是兜底：
      // 以后 canMoveTask 加了别的否决理由时，UI 不用跟着改。
      const check = canMoveTask(tree.list, dragging, parentId)

      const label = !check.ok
        ? (check.reason ?? '这个位置放不了')
        : mode === 'into'
          ? `把 ${draggingTitle} 放进 ${targetTitle} 下`
          : `把 ${draggingTitle} 插到 ${targetTitle} ${mode === 'before' ? '之前' : '之后'}`

      return {
        id: targetId,
        mode,
        parentId,
        index,
        depth: mode === 'into' ? rowDepth + 1 : rowDepth,
        valid: check.ok,
        reason: check.reason,
        label,
      }
    },
    [tree, flatRows],
  )

  useEffect(() => {
    if (!dragId) return
    const dragging = dragId
    const draggingTitle = tree.nodes.get(dragging)?.task.title ?? ''
    // 拖拽一开始量一次容器的上下内边距，落点换算要用（见 hitTest）
    const list = listRef.current
    if (list) {
      listPadRef.current = Number.parseFloat(getComputedStyle(list).paddingTop) || 0
    }

    /** 指针贴到边缘时自动滚动：长树 / 深层树里也能一次拖到很远、很深处的位置。
        纵向滚动条长在列表容器自己身上（卡片内部），直接滚它就行；
        左右同理 —— 拖到右边缘就能一路划到更深的层级，拖到左边缘划回浅层。
        只在有落点时滚：指针跑到面板外面就不该还在偷偷滚列表。 */
    const autoScroll = (x: number, y: number) => {
      const node = listRef.current
      if (!node) return
      const rect = node.getBoundingClientRect()
      // 横向触发带收窄一些：面板有近 800px 宽，44px 每侧容易误触
      if (x < rect.left + AUTO_SCROLL_EDGE_X) node.scrollBy({ left: -AUTO_SCROLL_STEP })
      else if (x > rect.right - AUTO_SCROLL_EDGE_X) node.scrollBy({ left: AUTO_SCROLL_STEP })
      if (y < rect.top + AUTO_SCROLL_EDGE_Y) node.scrollBy({ top: -AUTO_SCROLL_STEP })
      else if (y > rect.bottom - AUTO_SCROLL_EDGE_Y) node.scrollBy({ top: AUTO_SCROLL_STEP })
    }

    /** 落点完全没变就不重渲染：指针每动一下都要重算，但绝大多数帧的落点是一样的 */
    const sameTarget = (a: DropTarget | null, b: DropTarget | null) =>
      a === b ||
      (a !== null &&
        b !== null &&
        a.id === b.id &&
        a.mode === b.mode &&
        a.depth === b.depth &&
        a.valid === b.valid)

    /** 每帧最多算一次：算落点 + 贴边自动滚动 */
    const paint = () => {
      frameRef.current = 0
      const { x, y } = pointRef.current
      const next = hitTest(x, y, dragging)
      if (!sameTarget(next, dropRef.current)) {
        dropRef.current = next
        setDrop(next)
      }
      // 只在真有落点时贴边滚动：指针跑到面板外面就不该还在偷偷滚列表
      if (next) autoScroll(x, y)
    }

    const onMove = (event: PointerEvent) => {
      pointRef.current = { x: event.clientX, y: event.clientY }
      if (frameRef.current) return
      frameRef.current = requestAnimationFrame(paint)
    }

    const finish = () => {
      const target = dropRef.current
      dropRef.current = null
      setDragId(null)
      setDrop(null)
      if (!target?.valid) return

      const commit = () => {
        // 落进被折叠的父节点时先把它展开，不然刚挪过去的任务会「消失」
        if (target.parentId) {
          setCollapsed((prev) => {
            if (!prev.has(target.parentId as string)) return prev
            const next = new Set(prev)
            next.delete(target.parentId as string)
            return next
          })
        }
        void moveTaskTo(dragging, target.parentId, target.index)
      }

      // 计时中的任务不能变成容器：它自己的番茄数会失效，这一颗番茄等于白跑
      if (target.mode === 'into' && target.id === sessionTaskId) {
        toast('计时进行中，请先停止计时再调整它的子任务', 'error')
        return
      }

      // 放进某个任务下＝让那个任务第一次变成容器：它自己的时间和番茄数会被清成「不定」，先说一声
      if (target.mode === 'into' && clearsOwnPlan(target.id)) {
        const intoTitle = tree.nodes.get(target.id)?.task.title ?? ''
        setConfirm({
          title: '移动任务',
          description: `${draggingTitle} 将移入 ${intoTitle} 下；${intoTitle} 的时间与番茄数将重置为不定，全部子任务移出后才能重新设置。`,
          confirmText: '确定',
          tone: 'notice',
          action: commit,
        })
        return
      }
      commit()
    }

    const previousCursor = document.body.style.cursor
    document.body.style.cursor = 'grabbing'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    // 兜底：窗口失焦（切到别的应用等）也当作松手，绝不让拖拽状态挂在那里
    window.addEventListener('blur', finish)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      document.body.style.cursor = previousCursor
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('blur', finish)
    }
  }, [dragId, hitTest, clearsOwnPlan, tree, sessionTaskId])

  const edit = (node: TaskNode) => {
    const parentId = node.task.parentId
    setDraft({
      kind: parentId ? 'subtask' : 'top',
      initial: parentId ? subtaskViewOf(node) : topTaskViewOf(node),
      hasSubtasks: node.children.length > 0,
    })
  }

  const remove = (node: TaskNode) => {
    // 计时中的任务（含其祖先）：删掉后这一颗番茄入账会找不到任务而丢账，必须先手动停止
    if (holdsRunningTask(node.task.id)) {
      toast('计时进行中，请先停止计时再删除', 'error')
      return
    }
    const hasChildren = node.children.length > 0
    setConfirm({
      title: `删除 ${node.task.title}`,
      description: hasChildren
        ? '该任务及其子任务将被永久删除，无法恢复。'
        : '该任务将被永久删除，无法恢复。',
      action: () => void removeTask(node.task.id),
    })
  }

  /**
   * 逾期是会传染的：只要有一个后代叶子逾期，它上面每一级都跟着显示「已逾期」。
   * 不然父任务看着一切正常，点开才发现里面躺着一条过期的。
   * 判定和归档共用一份（focus-data 的 overdueTaskIds），两边口径不会走偏。
   */
  const overdueIds = useMemo(() => overdueTaskIds(tree.list), [tree.list, todayStamp])

  const renderRow = (
    node: TaskNode,
    depth: number,
    color: string | undefined,
    mark: { own: boolean; pathOnly: boolean; hits: number },
    flash: boolean,
  ): ReactNode => {
    const { task } = node
    const isContainer = node.isContainer
    const complete = node.complete
    // 逾期向上传染（见 overdueIds）：自己逾期、或任一后代逾期，都算这条逾期
    const overdue = overdueIds.has(task.id)
    // 倒数是结束日的展示，不另存字段；容器用子任务汇总出的最晚结束日
    const countdown = !complete && node.endDate > 0 ? taskCountdown(node.endDate) : null
    const quadrant = isContainer ? null : quadrantMetaOf(task.quadrant)
    const expandable = node.children.length > 0
    const open = expandable && isOpen(task.id)
    const active = drop?.id === task.id ? drop : null
    // 时间与番茄数一律显示汇总值：容器（有子任务）的这两栏由 buildTaskTree 自底向上算好
    // —— 开始取子任务里最早的、结束取最晚的、番茄数求和 —— 不再强制写成「不定」。
    // 只有两端都没设、或番茄数为 0 时才写「不定」（不空着、也不写「未设置」）。
    const from = toDateInput(node.startDate)
    const to = toDateInput(node.endDate)
    const timeTip = !from && !to ? '时间不定' : `时间 ${from || '不定'} ~ ${to || '不定'}`
    // 行内只显示月日，年份信息留在悬停提示里；把横向空间让给标题
    const compactDate = (value: string) => (value ? value.slice(5) : '不定')
    const timeValue =
      from && to && from.slice(0, 4) !== to.slice(0, 4)
        ? `${from} ~ ${to}`
        : !from && !to
          ? '不定'
          : `${compactDate(from)} ~ ${compactDate(to)}`
    // 「N 项」按最底层的叶子数算：只有叶子才真正记番茄数，直接子节点数会误导
    const leavesText = isContainer ? ` · ${node.leaves.length} 项` : ''
    const countTip =
      node.plannedTotal > 0
        ? `番茄数 ${node.doneCount}/${node.plannedTotal}${leavesText}`
        : `番茄数不定${leavesText}`
    const countValue =
      node.plannedTotal > 0 ? `${node.doneCount}/${node.plannedTotal}${leavesText}` : `不定${leavesText}`

    return (
      <div
        data-task-row={task.id}
        data-task-depth={depth}
        // 外层只负责定位（行高 44、缩进、参考线、插入线）；看得见的「卡片」是里面那层
        className="group relative"
        // 每一行都是同样宽的一块，缩进＝整块往右挪（不再靠内边距把内容挤窄），
        // 所以无论多深，卡片的左右长度都一样，右侧按钮自然也就不再对齐了。
        // 用 margin 而不是 transform：margin 会把内容撑出滚动范围，缩进超过右侧余量时
        // 底部自然出现横向滚动条（缩进不封顶）；transform 不参与滚动区计算，会被直接裁掉。
        style={{
          // 高度必须和 ROW_HEIGHT 一致：虚拟列表按它算位置
          height: ROW_HEIGHT,
          // 缩进整块右移；左边缘只留一道很小的边，收窄的宽度全部让在右边
          marginLeft: depth * INDENT + CARD_GUTTER,
          width: `calc(${CARD_WIDTH_SCALE * 100}% - ${CARD_RESERVE * CARD_WIDTH_SCALE}px)`,
          paddingLeft: 2,
        }}
      >
        {/* 缩进参考线不在行里画：整棵一份画在列表上层的 TreeGuides 里 */}

        {/* 插入线：左端从落点所属层级的缩进处起画 —— 线的起点位置就是它将来待的层级，
            这是判断「插到谁之前/之后、在哪一层」最直接的信号（Explorer / VS Code 都这么做）；
            落点在面板空白区时缩进是 0，一眼就是「最外层」。self 区不画线，见 hitTest。
            线画在卡片之间的缝正中间：卡片上下各让 2px，行与行之间的缝一共 4px，
            线高 2px、上下各留 1px，既不压卡片上/下沿，也不会顶到另一张卡。
            列表容器另外留了上下内边距，缝的上方有处可去，第一行的线头才不会被裁。 */}
        {active && (active.mode === 'before' || active.mode === 'after') ? (
          <span
            className={cn(
              'pointer-events-none absolute h-[2px] rounded-full',
              active.valid ? 'bg-primary' : 'bg-destructive',
              active.mode === 'before' ? '-top-[1px]' : '-bottom-[1px]',
            )}
            // 行的左边缘已经按自己的层级挪过了，这里只要补上「落点层级 - 本行层级」这一段的差；
            // 左边多留 2px：线头那个小圆点有宽度，不留就会被外层容器裁掉左半边
            style={{ left: 6 + (active.depth - depth) * INDENT, right: 8 }}
            aria-hidden
          >
            {/* 线头圆点 6px，圆心压在线中央 */}
            <span
              className="absolute -left-[3px] -top-[2px] size-1.5 rounded-full bg-inherit"
              aria-hidden
            />
          </span>
        ) : null}

        {/* 行本身做成一张卡：和习惯卡片同一套（浅抹茶底 + 绿描边 + 轻投影），
            卡片高 46 = 原 58 的 0.8 倍，上下各只留 2px 缝隙。 */}
        <div
          className={cn(
            'absolute inset-x-0 top-0.5 bottom-0.5 flex items-center gap-2 rounded-2xl border border-[var(--card-edge)] bg-[var(--card-surface)] pl-2 pr-4 shadow-sm transition-colors',
            // ring-inset：ring 画在盒子外侧会被外层 overflow 裁掉，改成内描边怎么都不出格。
            // 放进某行下：合法给绿底＋绿框；不合法只给红框（不铺底色）。
            active &&
              active.mode === 'into' &&
              (active.valid
                ? 'bg-sidebar-accent ring-2 ring-inset ring-sidebar-accent-foreground/35'
                : 'ring-2 ring-inset ring-destructive'),
            // 压在自己或自己子树的范围上：同样只有红框、不铺红色底
            active && active.mode === 'self' && 'ring-2 ring-inset ring-destructive',
            // 从日视图跳过来的那一行：闪 1.8 秒主色描边 + 极浅绿底，
            // 告诉你「落到的是这一条」。用 inset ring，不会把卡片撑大或顶到外面。
            flash && 'ring-2 ring-inset ring-primary/60 bg-sidebar-accent/40',
          )}
        >
        <button
          type="button"
          aria-label={matchState ? `${task.title}（筛选时不可拖动）` : `拖动 ${task.title}`}
          aria-disabled={matchState ? true : undefined}
          data-drag-handle
          onPointerDown={(event) => {
            // 筛选态一律不拖：落点按「可见行 + 兄弟槽位」算，筛掉的行让槽位序号失去意义，
            // 松手后到底插到哪一行前面说不清 —— 宁可先不让拖，清空筛选即可恢复。
            if (matchState) return
            if (event.button !== 0) return
            event.preventDefault()
            // 指针捕获：鼠标拖到窗口外面再松手时，pointerup 也一定会送回这个元素，
            // 不会留下「已经松手了、拖拽状态还挂着、提示条继续跟着鼠标」这种残局。
            event.currentTarget.setPointerCapture(event.pointerId)
            // 抓住所有行：拖拽期间树不会变，落点判定每帧只重新读它们的 rect
            // 行高固定，落点按索引算即可；拖拽期间不需要再量 DOM
            pointRef.current = { x: event.clientX, y: event.clientY }
            setDragId(task.id)
            dropRef.current = null
            setDrop(null)
          }}
          // 把手只剩这层圆角矩形底色；中间的圆环不在这里画 —— 圆环挪进了 TreeGuides
          // 那棵子树有手动色时，圆角矩形铺该色的浅底（子任务继承顶层色）
          className={cn(
            'size-6 shrink-0 cursor-grab touch-none rounded-[7px] outline-none transition-colors active:cursor-grabbing',
            color ? 'task-handle-tinted' : 'bg-foreground/[0.12] hover:bg-foreground/20',
            // 筛选态：把手压灰、光标改成禁止，一眼看出这时候拖不动
            matchState && 'cursor-not-allowed opacity-40 hover:bg-foreground/[0.12]',
          )}
          style={color ? ({ '--task-color': color } as CSSProperties) : undefined}
        />

        {/* 两行：标题 + 时间·番茄数（小图标）/ 状态徽章 + 简介；操作按钮在卡片右侧垂直居中 */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          {/* 第 1 行：标题 + 行末的「时间 / 番茄数」小图标 */}
          <div className="flex min-w-0 items-center gap-2">
            <Tip
              side="top"
              align="start"
              label={
                <span className="block max-w-[420px] whitespace-normal break-words text-left leading-[18px]">
                  {task.title}
                </span>
              }
            >
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-[15px] font-medium leading-[20px]',
                  // 路径行（祖先，自身没命中）：压淡一档，让人一眼看出它只是「路过的」
                  mark.pathOnly
                    ? 'text-muted-foreground'
                    : complete
                      ? 'text-muted-foreground line-through'
                      : overdue
                        ? 'text-destructive'
                        : 'text-foreground',
                )}
              >
                {mark.own ? highlightTerms(task.title, terms) : task.title}
              </span>
            </Tip>
            {/* 路径行右侧标一下「这条支里有几处命中」：
                不然用户只看到一串变淡的父任务，不知道它凭什么还在列表里 */}
            {mark.pathOnly ? (
              <span className="shrink-0 rounded-[4px] bg-foreground/[0.06] px-1 text-[10px] leading-[16px] text-muted-foreground">
                {mark.hits} 处命中
              </span>
            ) : null}
            {/* 时间与番茄数：钟表 / 圆点小图标 + 紧凑数值，占位比整句文字小得多；
                完整的「时间不定 / 番茄数 3/6」说法收进悬停提示 */}
            <span className="ml-auto flex shrink-0 items-center gap-2 text-[11px] leading-[16px] tabular-nums text-muted-foreground">
              <Tip label={timeTip}>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" aria-hidden />
                  <span>{timeValue}</span>
                </span>
              </Tip>
              <Tip label={countTip}>
                <span className="flex items-center gap-1">
                  <CircleDot className="size-3" aria-hidden />
                  <span className={cn(node.plannedTotal > 0 && !isContainer && 'font-mono')}>
                  {countValue}
                </span>
                </span>
              </Tip>
            </span>
          </div>

          {/* 第 2 行：展开/收起（次要入口，很小）+ 状态徽章 + 简介。
              没有展开按钮的行不留占位，内容直接顶到和标题同一左缘 */}
          <div className="flex min-h-4 min-w-0 items-center gap-1 text-[11px] leading-[16px] text-muted-foreground/80">
            {expandable ? (
              <button
                type="button"
                aria-label={open ? `收起 ${task.title}` : `展开 ${task.title}`}
                aria-expanded={open}
                onClick={() => toggle(task.id)}
                className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground/70 outline-none transition-colors hover:bg-foreground/8 hover:text-foreground"
              >
                <ChevronDown
                  className={cn('size-3 transition-transform', !open && '-rotate-90')}
                  aria-hidden
                />
              </button>
            ) : null}
            {/* 状态徽章：字号与内边距都收到最小，并且允许收缩 —— 卡片窄到放不下时
                文字用省略号收起来，绝不让徽章越过卡片右缘（和落点红框叠在一起） */}
            {complete ? (
              <Badge variant="secondary" className="h-4 min-w-0 shrink gap-0.5 px-1.5 py-0 text-[8px]">
                <CheckCircle2 className="size-2 shrink-0" aria-hidden />
                <span className="truncate">已完成</span>
              </Badge>
            ) : null}
            {/* 逾期沿用描边做法（透明底 + 红描边 + 红字）；有确切结束日时顺带给出逾期天数 */}
            {overdue ? (
              <Badge
                variant="outline"
                className="h-4 min-w-0 shrink gap-0.5 border-destructive/45 px-1.5 py-0 text-[9px] text-destructive"
              >
                <span className="truncate">
                  {countdown?.state === 'overdue' ? countdown.text : '已逾期'}
                </span>
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
            ) : null}
            {quadrant ? (
              <Badge
                variant="outline"
                title={`四象限：${quadrant.name}`}
                className={cn('h-4 shrink-0 px-1.5 py-0 text-[9px]', quadrant.badge)}
              >
                {quadrant.short}
              </Badge>
            ) : null}
            {task.desc ? (
              // 命中可能只落在简介里（标题没中），所以两处都要打高亮 ——
              // 只高亮标题的话，用户会看到一条"没有任何高亮却命中"的行
              <Tip
                side="top"
                align="start"
                label={
                  <span className="block max-w-[420px] whitespace-normal break-words text-left leading-[18px]">
                    {task.desc}
                  </span>
                }
              >
                <span className="min-w-0 flex-1 truncate">
                  {mark.own ? highlightTerms(task.desc, terms) : task.desc}
                </span>
              </Tip>
            ) : null}
          </div>
        </div>

        {/* 操作按钮：卡片右侧、垂直居中。归档在最左边：只给「已完成、顶层、没过期、
            没在计时」的行 —— 见 archiveTask 的门槛 */}
        <div className="flex shrink-0 items-center gap-0.5">
          {complete && task.parentId === null && !overdue && !holdsRunningTask(task.id) ? (
            <Tip label="归档">
              <Button
                size="icon-xs"
                variant="ghost"
                className="size-5"
                aria-label={`归档 ${task.title}`}
                onClick={() =>
                  setConfirm({
                    title: `归档 ${task.title}`,
                    description: `归档后，${task.title} 将从任务列表中移除，其下的全部子任务也会一并移除；收件箱内保留该任务的名称、简介、起止日期与番茄数，不再记录子任务明细。归档后的记录只能删除，无法恢复，请确认后继续。`,
                    confirmText: '归档',
                    tone: 'notice',
                    action: () => void archiveTask(task.id),
                  })
                }
              >
                <Archive className="size-3" aria-hidden />
              </Button>
            </Tip>
          ) : null}
          {/* 专注：容器（有子任务，番茄数由后代汇总）、已完成、已逾期一律不显示 ——
              统一隐藏，不置灰。逾期想专注，先把日期改到不过期 */}
          {isContainer || complete || overdue ? null : (
            <Tip label="专注">
              <Button
                size="icon-xs"
                variant="ghost"
                className="size-5"
                aria-label={`开始 ${task.title}`}
                onClick={() =>
                  onStart(
                    { id: task.id, name: task.title, desc: task.desc, type: task.parentId ? 3 : 2 },
                    config.pomodoroTime,
                  )
                }
              >
                <Play className="size-3" aria-hidden />
              </Button>
            </Tip>
          )}
          {/* 添加子任务：已完成、已逾期的都不显示 —— 已完成意味着这条线走到头了，
              逾期要先改日期（编辑弹窗里改），改好了按钮自然回来 */}
          {complete || overdue ? null : (
            <Tip label="添加子任务">
              <Button
                size="icon-xs"
                variant="ghost"
                className="size-5"
                aria-label={`给 ${task.title} 添加子任务`}
                onClick={() => {
                  if (task.id === sessionTaskId) {
                    toast('计时进行中，请先停止计时再添加子任务', 'error')
                    return
                  }
                  const open = () => setDraft({ kind: 'subtask', initial: null, futureId: task.id })
                  // 这个任务本来有自己的时间和番茄数，一有子任务就作废成「不定」，先说一声
                  if (!clearsOwnPlan(task.id)) return open()
                  setConfirm({
                    title: '添加子任务',
                    description: `${task.title} 的时间与番茄数将重置为不定，全部子任务移出后才能重新设置。`,
                    confirmText: '确定',
                    tone: 'notice',
                    action: open,
                  })
                }}
              >
                <Plus className="size-3" aria-hidden />
              </Button>
            </Tip>
          )}
          {/* 没有番茄计划的叶子：完成与否由用户自己决定，否则事件型任务永远收不了尾 */}
          {!isContainer && node.plannedTotal <= 0 ? (
            <Tip label={complete ? '撤销完成' : '标记完成'}>
              <Button
                size="icon-xs"
                variant="ghost"
                className="size-5"
                aria-label={`${complete ? '撤销完成' : '标记完成'} ${task.title}`}
                onClick={() => {
                  if (holdsRunningTask(task.id)) {
                    toast('计时进行中，请先停止计时再修改完成状态', 'error')
                    return
                  }
                  void toggleTaskDone(task.id, !complete)
                }}
              >
                {complete ? <RotateCcw className="size-3" aria-hidden /> : <Check className="size-3" aria-hidden />}
              </Button>
            </Tip>
          ) : null}
          <Tip label="编辑">
            <Button size="icon-xs" variant="ghost" className="size-5" aria-label={`编辑 ${task.title}`} onClick={() => edit(node)}>
              <Pencil className="size-3" aria-hidden />
            </Button>
          </Tip>
          <Tip label="删除">
            <Button size="icon-xs" variant="ghost" className="size-5" aria-label={`删除 ${task.title}`} onClick={() => remove(node)}>
              <Trash2 className="size-3" aria-hidden />
            </Button>
          </Tip>
        </div>
        </div>
      </div>
    )
  }

  // 虚拟滚动窗口：只看视口内的行，上下各多渲染几行防止快速滚动时露白
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(480)
  const hasRows = flatRows.length > 0
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const sync = () => setViewportH(el.clientHeight)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasRows])

  /**
   * 横向滚动范围：虚拟化只渲染视口内的行，深浅不一的行进出渲染窗口时，
   * 由它们撑起来的可滚动范围会忽大忽小（明明没改树，滑两下范围就变了）。
   * 这里按**整棵树的最大深度**算出一个固定宽度占住最远处：范围始终是「最多能划到哪」，
   * 与当前渲染了哪些行无关，也**与收起/展开无关** —— 收起子树只是不显示，
   * 树的形状没变，最大深度必须按整棵树算，否则一收起深层子树范围就跟着缩。
   * 最深一行超出容器右缘多少，就占多少。
   */
  const overflowX = useMemo(() => {
    const walk = (nodes: readonly TaskNode[], depth: number): number =>
      nodes.reduce((max, node) => Math.max(max, depth, walk(node.children, depth + 1)), 0)
    const maxDepth = walk(roots, 0)
    // 行宽已放大 1.2 倍：最深一行的右缘可能超出容器，可能为负（不溢出）
    return maxDepth * INDENT + CARD_GUTTER - CARD_RESERVE * CARD_WIDTH_SCALE
  }, [roots])

  /**
   * 列表滚动位置（上下左右都记）：同一次会话内保留 —— 切去别的页面再回来、
   * 在专注页里切换标签，都接着上次的位置；重启后不保留（sessionStorage 随会话清空）。
   * 只在卸载时存一次，滚动过程中不写盘，省得每帧同步 IO。
   */
  const SCROLL_POS_KEY = 'matcha-puff/tasks-scroll'

  const saveScrollPos = useCallback(() => {
    // 取滚动时记下的坐标，不在这儿现读 DOM（此刻元素多半已经被 React 摘空了）
    const { top, left } = scrollPosRef.current
    try {
      sessionStorage.setItem(SCROLL_POS_KEY, JSON.stringify({ top, left }))
    } catch {
      // 存不住不影响使用
    }
  }, [])

  // 离开页面时存一次（切走、切标签都会走这里）
  useEffect(() => saveScrollPos, [saveScrollPos])

  /**
   * 内容一渲染出来就恢复上次的位置；数据是异步来的，等行出现了再恢复。
   *
   * 【只恢复一次】依赖里的 hasRows 会在数据刷新时来回翻转，effect 跟着重跑，
   * 就会拿上一次存的值把用户当前的位置覆盖掉（跳转滚到位之后又被拽回 0，就是这么来的）。
   * 所以用 restoredRef 上锁：一次挂载只恢复一次，之后无论 hasRows 怎么变都不再插手。
   *
   * 【跳转时也要恢复】以前这里见到待跳转就跳过恢复，结果起点永远是 0，
   * 画面就成了「从最上面往下滑到目标行」。正确做法是先把上次的位置恢复出来，
   * 再让跳转从那个位置滑向目标 —— 在下面往回跳，动画就是从下往上。
   * 恢复是 layout 阶段做的，跳转的滚动在其后的 effect 里，顺序上是「先恢复、再移动」。
   */
  const restoredRef = useRef(false)
  useLayoutEffect(() => {
    if (restoredRef.current) return
    if (!hasRows) return
    const el = listRef.current
    if (!el) return
    restoredRef.current = true
    try {
      const raw = sessionStorage.getItem(SCROLL_POS_KEY)
      if (!raw) return
      const pos = JSON.parse(raw) as { top?: number; left?: number }
      const top = typeof pos.top === 'number' ? pos.top : 0
      const left = typeof pos.left === 'number' ? pos.left : 0
      // 夹到当前内容范围内：行数变少了（删任务、折叠）时旧位置会超出底部
      const maxTop = Math.max(0, el.scrollHeight - el.clientHeight)
      const maxLeft = Math.max(0, el.scrollWidth - el.clientWidth)
      const nextTop = Math.min(top, maxTop)
      const nextLeft = Math.min(left, maxLeft)
      if (nextTop > 0) el.scrollTop = nextTop
      if (nextLeft > 0) el.scrollLeft = nextLeft
      // 恢复完同步给 ref：否则刚恢复又立刻切走时，ref 里还是旧的 0
      scrollPosRef.current = { top: nextTop, left: nextLeft }
      // 纵向位置还要同步给渲染窗口，否则恢复的还是顶部那几行
      setScrollTop(nextTop)
    } catch {
      // 读不到就停在顶部
    }
  }, [hasRows])

  const OVERSCAN = 8
  // 删除/折叠后内容变短时，把旧的滚动位置夹回去，避免渲染窗口落到列表之外
  const maxTop = Math.max(0, flatRows.length * ROW_HEIGHT - viewportH)
  const topOffset = Math.min(scrollTop, maxTop)
  const visibleStart = Math.max(0, Math.floor(topOffset / ROW_HEIGHT) - OVERSCAN)
  const visibleEnd = Math.min(
    flatRows.length,
    Math.ceil((topOffset + viewportH) / ROW_HEIGHT) + OVERSCAN,
  )

  const draggingNode = dragId ? tree.nodes.get(dragId) : null

  /**
   * 参考线（连同圆环）的列位基准：量一次把手圆角矩形的真实中心当基准。
   * 圆环已经挪进 TreeGuides 那份 svg，和线同坐标系 —— 它俩之间的对齐是构造出来的；
   * 再量把手，只是为了圆环相对圆角矩形也居中，CSS 内边距改了不用手改常量。
   */
  const contentRef = useRef<HTMLDivElement>(null)
  const [ringBaseX, setRingBaseX] = useState<number | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const box = contentRef.current
      const handle = box?.querySelector<HTMLElement>('[data-drag-handle]')
      if (!box || !handle) return
      const depth = Number(handle.closest<HTMLElement>('[data-task-row]')?.dataset.taskDepth ?? 0)
      const r = handle.getBoundingClientRect()
      const base = Math.round((r.left - box.getBoundingClientRect().left + r.width / 2 - depth * INDENT) * 1000) / 1000
      setRingBaseX((prev) => (prev !== null && Math.abs(prev - base) < 0.01 ? prev : base))
    }
    measure()
    // 改窗口大小或改缩放比都会让吸附位置变，必须重测，否则线又会偏出环心
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [visibleStart, visibleEnd, flatRows])

  /** 整棵缩进参考线连同圆环：只算当前渲染窗口内的行（窗口上下各多 8 行，接缝都在屏幕外） */
  const guides = useMemo(() => {
    const base = ringBaseX ?? CARD_GUTTER + RING_COLUMN
    const colorOfRow = (row: { path: string[] }) => rootColors.get(row.path[0])
    // 每个可见行一枚圆环，列位与线的终点同源 —— 同一个数出来的，必然对齐
    const rings = flatRows.slice(visibleStart, visibleEnd).map((row, offset) => ({
      x: row.depth * INDENT + base,
      y: (visibleStart + offset) * ROW_HEIGHT + ROW_HEIGHT / 2,
      color: colorOfRow(row),
    }))
    const paths = buildGuidePaths(
      flatRows,
      (index) => guideCodes[index] ?? '',
      (index) => flatRows[index + 1]?.depth === flatRows[index].depth + 1,
      (index) => colorOfRow(flatRows[index]!),
      visibleStart,
      visibleEnd,
      base,
    )
    return { paths, rings }
  }, [flatRows, guideCodes, visibleStart, visibleEnd, ringBaseX, rootColors])

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-3 pt-2">
      <div className="flex items-center gap-3">
        {/* 左边始终是任务总数（不参与压缩，不会因为右边有状态就消失）；
            筛选时改成「命中 M / 共 N」—— M 是真正命中的节点数，不含被补进来的祖先；
            拖拽进行中，落点状态显示在右侧那条长条里：右对齐、占满到按钮之前的整段宽度，
            所以能完整显示，只有真长到顶住按钮才截断。 */}
        <p className="shrink-0 text-[11.5px] text-muted-foreground">
          {totalCount === 0
            ? '将目标拆分为多级子任务，逐项推进'
            : matchState
              ? `命中 ${matchState.hits} / 共 ${totalCount} 个任务`
              : `共 ${totalCount} 个任务`}
        </p>
        <p
          className={cn(
            'min-w-0 flex-1 truncate text-right text-[11.5px]',
            drop && !drop.valid
              ? 'text-destructive'
              : drop
                ? 'text-primary'
                : 'text-muted-foreground',
          )}
        >
          {dragId && draggingNode
            ? drop
              ? drop.label
              : `${draggingNode.task.title} 不在可放置区域内，松开将取消移动。`
            : matchState
              ? '筛选生效中，清空筛选后可调整顺序'
              : ''}
        </p>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => {
            // 新建的任务很可能被当前筛选挡住（看不见＝以为没建成），所以先清筛选再开表单
            if (matchState) clearFilters()
            setDraft({ kind: 'top', initial: null })
          }}
        >
          <Plus className="size-3.5" aria-hidden />
          新建任务
        </Button>
      </div>

      {/* 搜索与筛选：控件全部复用习惯页那套（同一个搜索框、同一个 Select、同一个日期控件），
          两页的操作手感保持一致。任务树没任务时不占一行。 */}
      {totalCount > 0 ? (
        <div className="flex items-center gap-2">
          <div
            className="min-w-0 flex-1"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation()
                if (query) setQuery('')
              }
            }}
          >
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="搜索任务标题或简介…"
              className="h-8"
            />
          </div>
          <Select
            value={progressFilter}
            onValueChange={(value) => setProgressFilter(value as ProgressFilter)}
          >
            <SelectTrigger size="sm" className="w-[104px] text-[12px]" aria-label="按进度筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} viewportClassName="scroll-thin">
              {PROGRESS_OPTIONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={dateFilter}
            onValueChange={(value) => setDateFilter(value as DateFilterMode)}
          >
            <SelectTrigger size="sm" className="w-[128px] text-[12px]" aria-label="按日期筛选">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" sideOffset={4} viewportClassName="scroll-thin">
              {DATE_OPTIONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* 「指定某天」才铺日期控件：其余四种口径不需要选日子 */}
          {dateFilter === 'day' ? (
            <DateField
              value={filterDay}
              onChange={setFilterDay}
              placeholder="选某天"
              className="h-8 w-[118px] px-2 text-[12px]"
              ariaLabel="筛选日期"
            />
          ) : null}
          {filtering ? (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={clearFilters}
              aria-label="清空搜索和筛选"
              title="清空搜索和筛选"
            >
              <RotateCcw className="size-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}

      {!ready ? <p className="px-1 text-xs text-muted-foreground">正在读取任务…</p> : null}

      {/* 始终有一张实色卡片：没任务时，空状态也在这张卡里居中，而不是浮在背景上；
          拖动时指针移出这张卡＝没有落点，松手取消。 */}
      <section
        ref={panelRef}
        className="card-solid flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel p-2.5"
      >
        {totalCount === 0 ? (
          <Empty
            icon={FolderKanban}
            title="还没有任务"
            description="新建任务后，可逐级拆分出子任务。"
            size="sm"
            className="flex-1 py-16"
          />
        ) : matchState && flatRows.length === 0 ? (
          // 树里有任务、但一条都没命中：给条退路，不然只剩一张空白卡片
          <Empty
            icon={SearchX}
            title="没有匹配的任务"
            description="换个关键字，或把筛选条件放宽一些。"
            size="sm"
            className="flex-1 py-16"
            action={
              <Button size="sm" variant="outline" onClick={clearFilters}>
                清空搜索和筛选
              </Button>
            }
          />
        ) : (
          // 落点信号全应用只留两种，别再混：插入线（同级前/后）与整行高亮（放进某行下）；
          // 被拖的行自己及其子树是 self 区，一个信号都不给，只在页头报原因；
          // 面板不再整体亮边 —— 同一个落点同时亮两种信号只会让人分不清。
          <div
            ref={listRef}
            // 上下留 4px 内边距：卡片上下各让 2px，缝一共 4px；插入线画在缝正中，
            // 第一行/最后一行的那条线和线头圆点才不会顶到容器边缘被裁掉
            className="min-h-0 flex-1 select-none overflow-auto px-0.5 py-1 scroll-thin"
            onScroll={(event) => {
              // 坐标先落到 ref，卸载时才有真值可用（见 scrollPosRef 的说明）
              scrollPosRef.current = {
                top: event.currentTarget.scrollTop,
                left: event.currentTarget.scrollLeft,
              }
              setScrollTop(event.currentTarget.scrollTop)
            }}
          >
            {/* 虚拟滚动：只渲染视口内的行（上下各多渲染几行防闪烁），几百行也只有十几个真正的 DOM */}
            <div
              ref={contentRef}
              className="relative"
              style={{ height: flatRows.length * ROW_HEIGHT, minWidth: '100%' }}
            >
              {/* 横向滚动范围占位：按全树最大深度固定占住最远处（见 overflowX）。
                  没有它，深浅不一的行随虚拟化进出渲染窗口，横向可划范围会忽大忽小。
                  高度必须是 1px 而不是 0 —— 零高度的盒子不计入可滚动溢出范围，
                  占了也白占（实测过） */}
              <div
                aria-hidden
                className="pointer-events-none h-px"
                style={{ width: `calc(${CARD_WIDTH_SCALE * 100}% + ${overflowX}px)` }}
              />
              {flatRows.slice(visibleStart, visibleEnd).map((row, offset) => {
                const index = visibleStart + offset
                const { node } = row
                const { task } = node
                const codes = guideCodes[index] ?? ''
                const hasNextChild = flatRows[index + 1]?.depth === row.depth + 1
                const isDragging = dragId === task.id
                const active = drop?.id === task.id ? `${drop.mode}${drop.valid ? '1' : '0'}` : ''
                // 子任务没有自己的颜色，继承所属顶层任务的颜色
                const color = rootColors.get(row.path[0])
                // 影响这一行外观的全部输入，拼成一个签名；不变就复用上一帧的元素
                const sig = [
                  row.depth,
                  codes,
                  hasNextChild ? 1 : 0,
                  // 筛选态下展开与否看的是 filterCollapsed，判据必须跟着走
                  isOpen(task.id) ? 1 : 0,
                  isDragging ? 1 : 0,
                  active,
                  // 颜色变化也必须重渲：行元素是缓存的，漏了它就会出现「改了色、界面不动」
                  color ?? '',
                  config.pomodoroTime,
                  task.title,
                  task.desc,
                  task.pomodoroTotal,
                  task.pomodoroCount,
                  task.startDate,
                  task.endDate,
                  task.quadrant ?? 2,
                  node.plannedTotal,
                  node.doneCount,
                  node.startDate,
                  node.endDate,
                  todayStamp,
                  node.complete ? 1 : 0,
                  node.isContainer ? 1 : 0,
                  node.children.length,
                  // 「N 项」按最底层叶子数算：子孙变了必须重渲，否则缓存会把旧数字留在行上
                  node.leaves.length,
                  // 命中相关：命中词变了要重打高亮，路径行/命中行的样式也不同
                  termKey,
                  row.own ? 1 : 0,
                  row.pathOnly ? 1 : 0,
                  row.hits,
                  // 闪烁是 1.8 秒的状态，必须进签名，否则缓存会把旧元素留下、闪不出来
                  jumpTarget === task.id ? 1 : 0,
                ].join('|')

                const cached = rowCache.current.get(task.id)
                let el = cached && cached.sig === sig ? cached.el : null
                if (!el) {
                  el = renderRow(node, row.depth, color, row, jumpTarget === task.id)
                  rowCache.current.set(task.id, { sig, el })
                }
                // 行绝对定位在 index*行高 上：滚动时只换渲染窗口，不改布局
                return (
                  <div
                    key={task.id}
                    className="absolute inset-x-0"
                    style={{ top: index * ROW_HEIGHT }}
                  >
                    {el}
                  </div>
                )
              })}
              <TreeGuides paths={guides.paths} rings={guides.rings} />
            </div>
          </div>
        )}
      </section>

      {/* 拖拽状态不再跟随鼠标浮动，改在页头右侧那块空区域里显示（见上面的 header） */}

      <TaskFormDialog draft={draft} onOpenChange={(open) => !open && setDraft(null)} />

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.title ?? ''}
        description={confirm?.description ?? ''}
        confirmText={confirm?.confirmText}
        confirmVariant={confirm?.tone === 'notice' ? 'default' : 'destructive'}
        onOpenChange={(open) => !open && setConfirm(null)}
        onConfirm={() => confirm?.action()}
      />
    </div>
  )
}
