/**
 * 日期控件：自绘触发器 + 自绘月历。
 *
 * 不用 `<input type="date">`：它的面板是 WebView2 的原生控件，里面「清除/今天」是蓝色，
 * 样式完全改不了，和「全 UI 唯一强调色＝抹茶绿」直接冲突。
 *
 * 视觉与交互对齐成熟的区间选择器：
 * 区间模式一屏铺**两个月**，可以和「‹‹ ‹  …  › ››」跨月/跨年翻页，选中的区间连成一条底色带。
 *
 * 三种用法：
 * - `DateField`：单个日期（触发器 + 浮层）
 * - `DateRangeField`：开始~到期（触发器 + 浮层，双月）
 * - `CalendarPanel`：裸面板；`inline` 时给模态弹窗内联展开用 —— 弹窗会把浮层的外部交互
 *   当成「点外面」，所以弹窗里不能用 portal 浮层。
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from 'cn'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

/**
 * 月历的统一形状语言：
 * 所有格子都是「小圆角矩形」，不再混用方圆 —— 项目的 --radius 是 12px，
 * 直接写 rounded-md 在 25×28 的格子上半径就有 10px，看起来几乎是个圆，
 * 和区间中段那条直角底色带放在一起就非常割裂。所以这里一律用 4px。
 */
const CELL_SHAPE = 'rounded-[4px]'

/** 区间形状：中段直角连成整条带，只有起点圆左侧、终点圆右侧；单日选中四角都圆 */
function edgeShape(lo: number, hi: number, stamp: number): string {
  if (lo <= 0 || hi <= 0 || lo === hi) return CELL_SHAPE
  if (stamp === lo) return 'rounded-l-[4px] rounded-r-none'
  return 'rounded-l-none rounded-r-[4px]'
}

/** 翻页按钮：每个月份面板各一套（双箭头跨年、单箭头跨月）。悬停底色＝侧栏选中项那种绿 */
const NAV_BTN =
  'flex size-6 shrink-0 items-center justify-center rounded-[6px] text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'

/** 面板内小按钮的悬停态：和侧栏「选中项」同一个绿，比默认的 accent 更深一档 */
const SOFT_BTN = 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'

/**
 * 面板表面：和页面上的卡片同一支淡抹茶（--card-surface）+ 同一条抹茶描边（--card-edge）。
 *
 * 原来这里是「外层 16px 圆角 + 内层 12px 圆角」两层描边套在一起（中间还夹 2px 缝），
 * 内层那圈还盖了一层 3% 黑，把卡片绿压成了灰奶色 —— 于是看着既不是卡片那种绿，
 * 边框也像重影。现在只留一层：底色、描边、圆角全交给面板自己，浮层外框只负责投影。
 */
const PANEL_SURFACE = 'rounded-xl border border-[var(--card-edge)] bg-[var(--card-surface)]'

/** 月历格子的高度：26px。原来 28px 六行加起来就多出 12px 的纵向空隙 */
const CELL_H = 'h-[26px]'

/** 毫秒时间戳 → `yyyy-mm-dd`（0 或空 → 空串） */
export function toDateInput(ms: number): string {
  if (!ms) return ''
  const date = new Date(ms)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** `yyyy-mm-dd` → 毫秒时间戳（本地零点） */
export function fromDateInput(text: string): number {
  if (!text) return 0
  const [year, month, day] = text.split('-').map(Number)
  if (!year || !month || !day) return 0
  return new Date(year, month - 1, day).getTime()
}

/** 当天零点的时间戳，用来比较「同一天」 */
function dayStamp(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

export interface DateRange {
  start: number
  end: number
}

interface Cursor {
  year: number
  month: number
}

function cursorOf(ms: number): Cursor {
  const date = ms > 0 ? new Date(ms) : new Date()
  return { year: date.getFullYear(), month: date.getMonth() }
}

function shiftCursor(cursor: Cursor, delta: number): Cursor {
  const next = new Date(cursor.year, cursor.month + delta, 1)
  return { year: next.getFullYear(), month: next.getMonth() }
}

/** 从第一个面板的月份往后铺 count 个月：面板各自独立，初始状态是连续的两个月 */
function spreadCursors(start: Cursor, count: number): Cursor[] {
  return Array.from({ length: count }, (_, index) => shiftCursor(start, index))
}

/** 月份的绝对序号（年 * 12 + 月），用来判断某一格翻过去会不会撞上隔壁面板 */
function monthOrdinal(cursor: Cursor): number {
  return cursor.year * 12 + cursor.month
}

/** 区间触发器的文案：两端都给 → `a ~ b`；只给了一端也要看得见。
    「没设」一律写「不定」—— 不定本身就是可选的一个口径，不写成「未设置」。 */
export function toRangeInput(range: DateRange): string {
  if (range.start <= 0 && range.end <= 0) return ''
  return `${range.start > 0 ? toDateInput(range.start) : '不定'} ~ ${
    range.end > 0 ? toDateInput(range.end) : '不定'
  }`
}

interface DayCell {
  date: Date | null
  stamp: number
}

function monthCells(cursor: Cursor): DayCell[] {
  const first = new Date(cursor.year, cursor.month, 1)
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
  const leading = (first.getDay() + 6) % 7
  const cells: DayCell[] = []
  for (let i = 0; i < leading; i += 1) cells.push({ date: null, stamp: 0 })
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(cursor.year, cursor.month, day)
    cells.push({ date, stamp: dayStamp(date) })
  }
  // 一律补满 6 行（42 格）：不少月份只要 5 行，不补的话面板高度会随翻月忽高忽低，
  // 右上角的清除/今天也会跟着上下跳。空格与日期格同高，行才不会塌。
  while (cells.length < 42) cells.push({ date: null, stamp: 0 })
  return cells
}

/** 空占位格的 key：按「月份 + 序号」给，避免用随机数破坏渲染稳定性 */
function itemKeyOf(cursor: Cursor, index: number): string {
  return `${cursor.year}-${cursor.month}-${index}`
}

/**
 * 月历面板。
 *
 * `mode='range'` 时：第一次点选起点，第二次点选终点（中间跟随鼠标预览高亮），
 * 两次都点完才回调 `onPickRange`。
 */
export function CalendarPanel({
  mode = 'single',
  value = 0,
  range = { start: 0, end: 0 },
  months,
  min,
  max,
  onPickDate,
  onPickRange,
}: {
  mode?: 'single' | 'range'
  value?: number
  range?: DateRange
  /** 一屏铺几个月；区间模式默认两个月，单日期默认一个月 */
  months?: number
  min?: number
  max?: number
  onPickDate?: (ms: number) => void
  onPickRange?: (next: DateRange) => void
}) {
  const isRange = mode === 'range'
  const count = months ?? (isRange ? 2 : 1)

  const anchor = isRange ? range.start || range.end : value
  // 每个月份面板各自记住自己停在哪个月，各翻各的：
  // 左面板翻走了右面板不动，所以区间两端离得再远也能同时停在视野里，两头都选得到。
  const [cursors, setCursors] = useState<Cursor[]>(() => spreadCursors(cursorOf(anchor), count))
  // 区间模式：已经点了起点、等终点
  const [pending, setPending] = useState(0)
  const [hover, setHover] = useState(0)

  useEffect(() => {
    // 只清掉「还在等第二个点」的临时状态。面板停在哪个月一律由用户自己翻、不跟着值跳：
    // 否则点完到期那一月，两个面板会立刻弹回起始月份，刚选的那端直接从视野里消失。
    setPending(0)
    setHover(0)
  }, [isRange, value, range.start, range.end])

  const shiftPanel = (index: number, delta: number) =>
    setCursors((prev) => prev.map((item, i) => (i === index ? shiftCursor(item, delta) : item)))

  const startStamp = isRange && range.start > 0 ? dayStamp(new Date(range.start)) : 0
  const endStamp = isRange && range.end > 0 ? dayStamp(new Date(range.end)) : 0

  // 预览：点了起点之后，底色带跟着鼠标走
  const lo = isRange
    ? pending > 0
      ? Math.min(pending, hover > 0 ? hover : pending)
      : startStamp
    : 0
  const hi = isRange
    ? pending > 0
      ? Math.max(pending, hover > 0 ? hover : pending)
      : endStamp
    : 0
  const singleStamp = !isRange && value > 0 ? dayStamp(new Date(value)) : 0
  const todayStamp = dayStamp(new Date())

  const pick = (stamp: number) => {
    if (!isRange) {
      onPickDate?.(stamp)
      return
    }
    if (pending <= 0) {
      // 重置式（主流区间选择器都是这套）：
      // 已经选好一段时，再点一天就是「重新开始」—— 旧区间立刻丢掉，点中的这天成为新起点
      // （界面上只看得到这一个点），再点一下才定终点。想彻底清空成「不定」按右上角的清除。
      setPending(stamp)
      setHover(0)
      return
    }
    const next = { start: Math.min(pending, stamp), end: Math.max(pending, stamp) }
    setPending(0)
    setHover(0)
    onPickRange?.(next)
  }

  const renderCell = (cell: DayCell, index: number, month: Cursor) => {
    // 空占位格也要给同样的高度：整行都是空格时（补满的第 6 行）这一行才不会塌成 0 高
    if (!cell.date) return <span key={`empty-${itemKeyOf(month, index)}`} aria-hidden className={CELL_H} />
    const stamp = cell.stamp
    const blocked =
      (min !== undefined && stamp < dayStamp(new Date(min))) ||
      (max !== undefined && stamp > dayStamp(new Date(max)))
    const edge = isRange ? stamp === lo || stamp === hi : stamp === singleStamp
    const between = isRange && lo > 0 && hi > 0 && stamp > lo && stamp < hi

    const isToday = stamp === todayStamp

    return (
      <button
        key={stamp}
        type="button"
        disabled={blocked}
        onClick={() => pick(stamp)}
        onPointerEnter={() => (isRange && pending > 0 ? setHover(stamp) : undefined)}
        onPointerLeave={() => (isRange && pending > 0 ? setHover(0) : undefined)}
        className={cn(
          'relative flex items-center justify-center text-[11.5px] tabular-nums outline-none transition-colors',
          CELL_H,
          blocked
            ? 'cursor-not-allowed text-muted-foreground/35'
            : edge
              ? cn('bg-primary font-semibold text-primary-foreground', edgeShape(lo, hi, stamp))
              : between
                ? // 中段直角、左右不留缝，才连得成一整条底色带
                  'bg-primary/15 text-foreground hover:bg-primary/25'
                : // 悬停也用抹茶绿：面板现在是绿的，原来那层 10% 黑在绿底上会发灰
                  cn(CELL_SHAPE, 'text-foreground hover:bg-primary/[0.09]'),
        )}
      >
        {cell.date.getDate()}
        {/* 今天＝数字底下一条深绿色横线（和起止日期用的是同一个深绿）。
            原来用描边框，今天一旦落进区间中段就会被那层浅底色盖掉，根本看不出来；
            横线画在数字下方，任何底色上都看得见。
            今天正好是起点/终点时，横线在深绿底上反向挖空成浅色（位置粗细一模一样）。 */}
        {isToday && !blocked ? (
          <span
            aria-hidden
            className={cn(
              // 矩形、又粗又宽、贴着数字（底下留 1px 缝）：比原来那根细圆条显眼得多
              'pointer-events-none absolute bottom-[2px] left-1/2 h-[3px] w-[16px] -translate-x-1/2 rounded-none',
              edge ? 'bg-primary-foreground' : 'bg-primary',
            )}
          />
        ) : null}
      </button>
    )
  }

  return (
    <div className={cn(PANEL_SURFACE, 'p-2')}>
      {/* 清除 / 今天挪到右上角（原来压在右下角） */}
      <div className="mb-0.5 flex items-center justify-end gap-0.5">
        <Button
          size="xs"
          variant="ghost"
          className={cn(SOFT_BTN, 'h-5 px-1.5 text-[11px]')}
          onClick={() => {
            // 本地必须一起清：调用方本来就还没选（值没变）时，上面的 useEffect 不会触发，
            // 只靠回调是清不掉「正在等第二个点」那格高亮的 —— 那时点清除看起来没反应。
            setPending(0)
            setHover(0)
            if (isRange) onPickRange?.({ start: 0, end: 0 })
            else onPickDate?.(0)
          }}
        >
          清除
        </Button>
        <Button
          size="xs"
          variant="ghost"
          className={cn(SOFT_BTN, 'h-5 px-1.5 text-[11px]')}
          onClick={() => {
            // 光选中还不够，面板也得弹到今天 —— 否则选中的那一格待在别的月份里，等于什么都没看见
            setCursors(spreadCursors(cursorOf(todayStamp), count))
            setPending(0)
            setHover(0)
            if (isRange) onPickRange?.({ start: todayStamp, end: todayStamp })
            else onPickDate?.(todayStamp)
          }}
        >
          今天
        </Button>
      </div>

      {/* 每个月份面板各带一整套翻页按钮：
          面板里就是「« ‹ 月份 › »」，标题居中、四颗按钮左右到边；
          两个面板离得远时，标题之间就夹着四颗按钮（左面板的 › » 和右面板的 « ‹），
          贴在一起时这四颗自动隐藏 —— 见下面的 canBack / canAhead。
          左面板的按钮只翻左面板、右面板的只翻右面板，两边才能各自停在自己那一端。 */}
      <div className="flex">
        {cursors.map((item, index) => {
          const prev = cursors[index - 1]
          const next = cursors[index + 1]
          const mine = monthOrdinal(item)
          /* 每个面板四颗按钮都在，但「会撞上隔壁面板」的那两颗是
             隐藏的 —— 所以两个面板永远不会翻成前后颠倒（左 2027、右 2026 这种事不可能发生）。
             这里用 invisible 而不是直接不渲染：占位还在，标题才不会因为按钮数量变化跑偏。 */
          const canBack = (delta: number) => mine - delta > (prev ? monthOrdinal(prev) : Number.NEGATIVE_INFINITY)
          const canAhead = (delta: number) => mine + delta < (next ? monthOrdinal(next) : Number.POSITIVE_INFINITY)

          return (
            <div
              key={`month-${item.year}-${item.month}`}
              className={cn(
                'min-w-0 flex-1 px-1.5',
                // 两个月之间留一条分隔线：原来两边的日期直接挤在一起，中间连条缝都没有
                index > 0 && 'border-l border-foreground/10',
              )}
            >
              <div className="flex items-center">
                <button
                  type="button"
                  aria-label="上一年"
                  disabled={!canBack(12)}
                  className={cn(NAV_BTN, !canBack(12) && 'invisible')}
                  onClick={() => shiftPanel(index, -12)}
                >
                  <ChevronsLeft className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="上个月"
                  disabled={!canBack(1)}
                  className={cn(NAV_BTN, !canBack(1) && 'invisible')}
                  onClick={() => shiftPanel(index, -1)}
                >
                  <ChevronLeft className="size-3.5" aria-hidden />
                </button>
                <span className="min-w-0 flex-1 truncate text-center text-[12px] font-semibold tabular-nums text-foreground">
                  {item.year} 年 {item.month + 1} 月
                </span>
                <button
                  type="button"
                  aria-label="下个月"
                  disabled={!canAhead(1)}
                  className={cn(NAV_BTN, !canAhead(1) && 'invisible')}
                  onClick={() => shiftPanel(index, 1)}
                >
                  <ChevronRight className="size-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label="下一年"
                  disabled={!canAhead(12)}
                  className={cn(NAV_BTN, !canAhead(12) && 'invisible')}
                  onClick={() => shiftPanel(index, 12)}
                >
                  <ChevronsRight className="size-3.5" aria-hidden />
                </button>
              </div>

              {/* 横向不留缝：区间中段才能连成一整条底色带（纵向保留细缝，行与行才分得开） */}
              <div className="mt-0.5 grid grid-cols-7 gap-y-0.5">
                {WEEKDAYS.map((label) => (
                  <span key={label} className="pb-0.5 text-center text-[10.5px] text-muted-foreground">
                    {label}
                  </span>
                ))}
                {monthCells(item).map((cell, cellIndex) => renderCell(cell, cellIndex, item))}
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}

/** 触发器外观（单日期 / 区间共用）：单日期还要把触发器 ref 交给浮层定位 */
function triggerClass(active: boolean, empty: boolean, className?: string) {
  return cn(
    'flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-md border bg-transparent px-3 text-left text-[13px] outline-none transition-[color,box-shadow]',
    active ? 'border-ring ring-[3px] ring-ring/50' : 'border-input hover:border-ring/60',
    empty ? 'text-muted-foreground' : 'tabular-nums text-foreground',
    className,
  )
}

/** 浮层面板的公共部分：贴触发器下方，必要时往上翻 */
function usePanelAnchor(months: number) {
  const [anchor, setAnchor] = useState({ left: 0, top: 0, width: 0 })
  // 内边距收到 8px、格子 26px 高之后整体收紧了一号，宽度也跟着退一点，
  // 单月 240 / 双月 492 —— 再宽数字之间就空得散了。
  const width = months > 1 ? 492 : 240
  // 月历底部固定留满 6 行，单月/双月面板一样高，所以高度是个常量
  const height = 268

  return {
    width,
    anchor,
    place: (trigger: HTMLElement | null) => {
      const rect = trigger?.getBoundingClientRect()
      if (!rect) return
      const below = rect.bottom + 6
      const top = below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 6) : below
      const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8)
      setAnchor({ left, top, width })
    },
  }
}

/** 日期面板一律由用户手动开合（点一次展开、再点一次收起），不因为焦点跑到别处就自动收。 */

export function DateField({
  value,
  onChange,
  placeholder = '未设置',
  disabled = false,
  min,
  max,
  inline = false,
  className,
  id,
  ariaLabel,
}: {
  value: number
  onChange: (ms: number) => void
  placeholder?: string
  disabled?: boolean
  min?: number
  max?: number
  /** 内联展开（模态弹窗里用，浮层会被外部交互拦截逻辑吃掉） */
  inline?: boolean
  className?: string
  id?: string
  ariaLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { anchor, width, place } = usePanelAnchor(1)

  // 禁用时（例如实时模式接管）弹层必须立刻收起，不能留在页面上
  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const panelBody = (
    <CalendarPanel
      value={value}
      min={min}
      max={max}
      onPickDate={(ms) => {
        onChange(ms)
        if (!inline) setOpen(false)
      }}
    />
  )

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => {
          if (inline) {
            setOpen(!open)
            return
          }
          if (open) setOpen(false)
          else {
            place(triggerRef.current)
            setOpen(true)
          }
        }}
        className={cn(
          triggerClass(open, value <= 0, className),
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span className="truncate">{value > 0 ? toDateInput(value) : placeholder}</span>
        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {/* 内联展开的面板也必须挂上 panelRef：否则「点外部收起」会把面板里的每一次点击
          都当成点在面板外面，点任何按钮都会立刻把月历收掉。 */}
      {inline ? (
        <div ref={panelRef} className={open ? 'mt-1.5' : 'hidden'}>
          {panelBody}
        </div>
      ) : null}
      {!inline && open
        ? createPortal(
            <div ref={panelRef} className="fixed z-[80]" style={{ left: anchor.left, top: anchor.top, width }}>
              <div className="rounded-xl shadow-e3">{panelBody}</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/** 开始~到期：一个控件选两端，双月铺开 */
export function DateRangeField({
  value,
  onChange,
  placeholder = '不定',
  disabled = false,
  min,
  max,
  inline = false,
  withPanel = true,
  open: openProp,
  onOpenChange,
  className,
  id,
  ariaLabel,
}: {
  value: DateRange
  onChange: (next: DateRange) => void
  placeholder?: string
  disabled?: boolean
  min?: number
  max?: number
  inline?: boolean
  /** false＝面板不在这里铺，改由调用方自己放（弹窗要让它横跨整行时用） */
  withPanel?: boolean
  /** 受控开合；不给就自己管 */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  id?: string
  ariaLabel?: string
}) {
  const [innerOpen, setInnerOpen] = useState(false)
  const open = openProp ?? innerOpen
  const setOpen = (next: boolean) => (openProp === undefined ? setInnerOpen(next) : onOpenChange?.(next))
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const { anchor, width, place } = usePanelAnchor(2)

  const text = toRangeInput(value)
  const panelBody = (
    <CalendarPanel
      mode="range"
      range={value}
      min={min}
      max={max}
      onPickRange={(next) => {
        onChange(next)
        if (!inline) setOpen(false)
      }}
    />
  )

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => {
          if (inline) {
            setOpen(!open)
            return
          }
          if (open) setOpen(false)
          else {
            place(triggerRef.current)
            setOpen(true)
          }
        }}
        className={cn(triggerClass(open, !text, className), disabled && 'pointer-events-none opacity-50')}
      >
        <span className="truncate">{text || placeholder}</span>
        <CalendarDays className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {inline && withPanel ? (
        <div ref={panelRef} className={open ? 'mt-1.5' : 'hidden'}>
          {panelBody}
        </div>
      ) : null}
      {!inline && withPanel && open
        ? createPortal(
            <div ref={panelRef} className="fixed z-[80]" style={{ left: anchor.left, top: anchor.top, width }}>
              <div className="rounded-xl shadow-e3">{panelBody}</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
