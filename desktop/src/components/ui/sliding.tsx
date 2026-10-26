import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { cn } from 'cn'

type Motion = 'side' | 'spring'

const MOTION: Record<Motion, { duration: number; ease: string }> = {
  side: { duration: 240, ease: 'cubic-bezier(0.33, 1, 0.68, 1)' },
  spring: { duration: 300, ease: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
}

/** 首末项的回弹会冲出控件边缘：保持同样的弹簧节奏，只把回弹幅度压到约 1/8 */
const EDGE_SPRING_EASE = 'cubic-bezier(0.34, 1.2, 0.64, 1)'









export function useSlidingIndicator(
  activeKey: string | number | undefined,
  {
    motion = 'side',
    extraKey,
    fast = false,
    edge = false,
  }: { motion?: Motion; extraKey?: string | number; fast?: boolean; edge?: boolean } = {},
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<CSSProperties | null>(null)
  const [animate, setAnimate] = useState(false)
  const measured = useRef(false)
  const lastKey = useRef<string | number | undefined>(activeKey)

  const measure = useCallback((withAnimation: boolean) => {
    const el = containerRef.current
    if (!el) return
    const target = el.querySelector<HTMLElement>('[data-sliding-active="true"]')
    if (!target) {
      setStyle(null)
      return
    }
    setStyle({
      width: target.offsetWidth,
      height: target.offsetHeight,
      transform: `translate3d(${target.offsetLeft}px, ${target.offsetTop}px, 0)`,
    })
    setAnimate(withAnimation)
  }, [])

  useLayoutEffect(() => {
    const changed = lastKey.current !== activeKey
    lastKey.current = activeKey
    measure(changed && measured.current)
    measured.current = true
  }, [activeKey, extraKey, measure])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => measure(false))
    ro.observe(el)
    return () => ro.disconnect()
  }, [measure])

  const m = MOTION[motion]
  const ease = motion === 'spring' && edge ? EDGE_SPRING_EASE : m.ease
  /** 按住拖动：短促追随（100ms），既跟手又有「滑过去」的过程，不是硬跳 */
  const dragTransition =
    'transform 100ms cubic-bezier(0.2, 0, 0.3, 1), width 100ms cubic-bezier(0.2, 0, 0.3, 1), height 100ms cubic-bezier(0.2, 0, 0.3, 1)'
  const indicatorStyle: CSSProperties = style
    ? {
        ...style,
        transition: fast ? dragTransition : !animate ? 'none' : `transform ${m.duration}ms ${ease}, width ${m.duration}ms ${ease}, height ${m.duration}ms ${ease}`,
      }
    : { display: 'none' }

  return { containerRef, indicatorStyle }
}

/**
 * 横向分段选择器：文字按钮 + 平滑滑动胶囊。
 * 点击选中；按住横向拖动时胶囊跟随指针在按钮间滑动，松手落定（点击链路不受影响）。
 */
export function SlidingSegmented<T extends string | number>({
  options,
  value,
  onValueChange,
  motion = 'spring',
  size = 'sm',
  bare = false,
  className,
  ariaLabel,
}: {
  options: { value: T; label: ReactNode; disabled?: boolean }[]
  value?: T
  onValueChange: (value: T) => void
  motion?: Motion
  size?: 'sm' | 'md'
  /** true = 不加外层胶囊底，只保留按钮与滑动指示器（吸顶条里用） */
  bare?: boolean
  className?: string
  ariaLabel?: string
}) {
  const extraKey = options.map((o) => String(o.value)).join('|')
  const [fast, setFast] = useState(false)
  const atEdge =
    value !== undefined &&
    (value === options[0]?.value || value === options[options.length - 1]?.value)
  const { containerRef, indicatorStyle } = useSlidingIndicator(value, {
    motion,
    extraKey,
    fast,
    edge: atEdge,
  })
  /** 真正的滚动容器；胶囊画在它外面，回弹冲过首末项时才不会被它裁掉 */
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollLeft, setScrollLeft] = useState(0)
  const drag = useRef({
    down: false,
    startX: 0,
    startY: 0,
    moved: false,
    suppressClick: false,
    last: undefined as T | undefined,
  })

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      // 没有横向溢出就不要吃掉滚轮，否则页面的纵向滚动会在这一小段失效
      if (el.scrollWidth <= el.clientWidth) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const findOption = (clientX: number, clientY: number): T | undefined => {
    const el = document
      .elementFromPoint(clientX, clientY)
      ?.closest<HTMLElement>('[data-seg-item]')
    if (!el) return undefined
    const raw = el.dataset.segItem
    const opt = options.find((o) => String(o.value) === raw)
    return opt && !opt.disabled ? opt.value : undefined
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    // 注意：这里绝不能立刻 setPointerCapture —— 捕获后 click 会落到容器上，

    const hit = findOption(e.clientX, e.clientY)
    drag.current = {
      down: true,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      suppressClick: false,
      last: hit ?? value,
    }
    // 按下即切换（不等松手、不等移动）：指示器立刻弹到目标项
    if (hit !== undefined && hit !== value) {
      drag.current.suppressClick = true
      onValueChange(hit)
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current.down) return
    // 鼠标已经松开但 pointerup 丢失：只取消拖拽，绝不补发 drag-end。
    // 按下时会立刻切换并滚动，条子可能已经从指针下移走，pointerup 就落到别处；
    // 此时若补发 drag-end，会把用户已经滚走的页面硬拉回上一个子项。
    if ((e.buttons & 1) === 0) {
      drag.current.down = false
      drag.current.moved = false
      drag.current.suppressClick = false
      setFast(false)
      const el = scrollRef.current
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      return
    }
    const dx = e.clientX - drag.current.startX
    const dy = e.clientY - drag.current.startY
    if (!drag.current.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
      drag.current.moved = true
      setFast(true)
      scrollRef.current?.setPointerCapture(e.pointerId)
    }
    if (!drag.current.moved) return
    // 不松手也立即切换：滑到哪一项就直接回调哪一项
    const next = findOption(e.clientX, e.clientY)
    if (next !== undefined && next !== drag.current.last) {
      drag.current.last = next
      onValueChange(next)
    }
  }

  const finishDrag = (e: ReactPointerEvent<HTMLDivElement>, commit: boolean) => {
    if (!drag.current.down) return
    drag.current.down = false
    if (commit && drag.current.moved) {
      drag.current.suppressClick = true
      const id = drag.current.last
      window.dispatchEvent(
        new CustomEvent('matcha:tools-drag-end', {
          detail: { id: typeof id === 'number' ? id : undefined },
        })
      )
    }
    setFast(false)
    const el = scrollRef.current
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
  }

  const onClickCapture = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!drag.current.suppressClick) return
    drag.current.suppressClick = false
    e.preventDefault()
    e.stopPropagation()
  }

  const h = size === 'md' ? 'h-9' : 'h-8'
  const pad = size === 'md' ? 'px-3 text-[14px]' : 'px-2.5 text-[13.5px]'

  return (
    <div
      ref={containerRef}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => finishDrag(e, true)}
      onPointerCancel={(e) => finishDrag(e, false)}
      onClickCapture={onClickCapture}
      className={cn(
        'relative flex min-w-0 select-none items-center',
        bare ? 'p-0' : 'p-0.5',
        className,
      )}
    >
      {/* 胶囊画在滚动容器外：回弹冲过首末项时才不会被 overflow 裁成一条直线 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0"
        style={{ transform: `translate3d(${-scrollLeft}px, 0, 0)` }}
      >
        <span
          className="glass-select pointer-events-none absolute left-0 top-0 rounded-md"
          style={indicatorStyle}
        />
      </div>
      <div
        ref={scrollRef}
        onScroll={(event) => setScrollLeft(event.currentTarget.scrollLeft)}
        className={cn(
          'z-10 flex min-w-0 items-center gap-0.5 overflow-x-auto',
          '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        )}
      >
        {options.map((o) => {
          const on = value === o.value
          return (
            <button
              key={String(o.value)}
              type="button"
              disabled={o.disabled}
              data-seg-item={String(o.value)}
              data-sliding-active={on ? 'true' : undefined}
              onClick={() => onValueChange(o.value)}
              className={cn(
                'relative z-10 flex shrink-0 cursor-pointer items-center rounded-md font-semibold outline-none transition-colors duration-150',
                'focus-visible:ring-[3px] focus-visible:ring-ring/40',
                h,
                pad,
                on
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground',
                o.disabled && 'cursor-not-allowed opacity-35 hover:text-muted-foreground',
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
