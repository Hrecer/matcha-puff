import { useEffect, useRef, useState } from 'react'
import { AppWindow, Bell, Check, Coffee, Pause, Play, SkipForward, Square, Timer, X } from 'lucide-react'
import { emit, invoke } from '@/ipc/bridge'
import { initFocusSync, useFocusStore } from '@/lib/focus-store'
import { formatRemain } from '@matcha-puff/pomodoro-core'
import { cn } from 'cn'

/**
 * 卡片四周的透明留白（外阴影画在这里面），与 CSS --window-shadow-room 一致。
 * 顶部留出提示浮层的完整高度：提示画在卡片上方，留白不够会被窗口上沿削掉。
 * 24 只够单行提示，长任务名换两行就会顶出窗口，这里按两行 + 边距预留。
 */
const PAD_SIDE = 16
const PAD_TOP = 56
const PAD_BOTTOM = 16
/** 挂件左右伸缩的动画时长（毫秒） */
const WIDTH_ANIM_MS = 200

/**
 * 桌面专注挂件：一块置顶小浮窗，随时能看到剩余时间。
 *
 * 几条约束决定了这里的布局：
 *   1. 卡片可以被鼠标拖走 —— 卡片空白处是拖动区，所以那里不挂任何提示；
 *   2. 打开应用要有专门的按钮，点一下直接落到「专注 → 番茄钟」；
 *   3. 窗口尺寸跟着卡片内容走：宽度随标题伸缩，超长截断；
 *      标题被截断时由提示兜底显示全文。
 *
 * 提示一律走 `title` 属性 + 入口处挂载的 NativeTitleTooltip —— 和主窗、工具窗
 * 同一套组件、同一个 700ms 延迟，不在挂件里另写一套浮层。
 *
 * 与托盘菜单同源：动作不在这里执行，统一发 `focus:quick_action` 给主窗口的 store；
 * 这里只同步只读快照（`initFocusSync`），不碰业务文档。
 */
export function FocusWidget() {
  const { snapshot, ready } = useFocusStore()
  const cardRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLSpanElement>(null)
  /** 上一次送给宿主的窗口宽度（CSS 像素），作为下一次动画的起点 */
  const lastWidth = useRef<number | null>(null)
  /** 宽度动画进行中：这期间窗口尺寸本来就在变，不重复测量 */
  const animating = useRef(false)
  const rafId = useRef(0)
  /** 标题是否被截断：只有截断时才挂 title，提示只用来兜底看全文 */
  const [titleTruncated, setTitleTruncated] = useState(false)

  useEffect(() => {
    void initFocusSync()
  }, [])

  const phase = snapshot?.phase ?? 'idle'
  const paused = phase === 'paused'
  const pausedFrom = snapshot?.pausedFrom ?? null
  const resting = phase === 'rest' || (paused && pausedFrom === 'rest')
  const focusing = phase === 'focus' || (paused && pausedFrom === 'focus')
  const taskName = snapshot?.task?.name ?? ''

  /**
   * 量卡片在「不限制宽度」时的自然宽度，再把窗口平滑推到那个宽度。
   *
   * 卡片撑满窗口，所以窗口怎么变、卡片就怎么变 —— 动画放在窗口宽度上，
   * 前端按帧喂给宿主，看起来就是连续伸缩。标题该截断照旧截断，只是中途
   * 不再"啪"一下跳过去。
   */
  useEffect(() => {
    const card = cardRef.current
    if (!card) return

    const measure = () => {
      // 用 max-content 量：auto 仍会被当前窗口宽度夹住，而相位切换时窗口还是
      // 上一个状态的大小，标题会被暂时挤窄、误判成「已截断」；窗口变宽后又
      // 不一定有人重算，提示就会一直挂在没截断的标题上。
      const prev = card.style.width
      card.style.width = 'max-content'
      const rect = card.getBoundingClientRect()

      // 必须在还原宽度之前判断：此时标题才按不受窗口限制的自然宽度排版
      const title = titleRef.current
      if (title) {
        const next = title.scrollWidth > title.clientWidth + 1
        setTitleTruncated((p) => (p === next ? p : next))
      }

      card.style.width = prev
      const width = Math.ceil(rect.width)
      const height = Math.ceil(rect.height)
      animateWindowWidth(width + PAD_SIDE * 2, height + PAD_TOP + PAD_BOTTOM)
    }

    measure()
    // 动画期间窗口宽度每帧都在变，卡片跟着变；这时不打扰，等停下来再补量一次
    const observer = new ResizeObserver(() => {
      if (animating.current) return
      measure()
    })
    observer.observe(card)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafId.current)
    }
  }, [ready, phase, taskName])

  /** 把窗口宽度分帧推到目标值：卡片撑满窗口，于是整体是平滑伸缩的 */
  const animateWindowWidth = (toWidth: number, toHeight: number) => {
    const from = lastWidth.current ?? toWidth
    lastWidth.current = toWidth
    cancelAnimationFrame(rafId.current)
    if (from === toWidth) {
      invoke('focus_widget_resize', { width: toWidth, height: toHeight }).catch(() => {})
      return
    }
    animating.current = true
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / WIDTH_ANIM_MS)
      const eased = 1 - (1 - t) * (1 - t)
      const width = Math.round(from + (toWidth - from) * eased)
      invoke('focus_widget_resize', { width, height: toHeight }).catch(() => {})
      if (t < 1) {
        rafId.current = requestAnimationFrame(tick)
      } else {
        animating.current = false
        rafId.current = 0
      }
    }
    rafId.current = requestAnimationFrame(tick)
  }

  /** 打开主窗口并直接落到「专注 → 番茄钟」 */
  const openMain = () => {
    invoke('show_main_window').catch(() => {})
    emit('focus:quick_action', { action: 'open-focus' }).catch(() => {})
  }
  const hide = () => invoke('focus_widget_hide').catch(() => {})
  const act = (action: string) => emit('focus:quick_action', { action }).catch(() => {})
  /** 停止不可直接生效：先唤起主窗口，由它弹出确认框，确定后才真的停 */
  const askStop = () => {
    invoke('show_main_window').catch(() => {})
    emit('focus:quick_action', { action: 'ask-stop' }).catch(() => {})
  }
  /** 卡片空白处按下左键：交给宿主做原生窗口拖动 */
  const drag = (event: React.MouseEvent) => {
    if (event.button !== 0) return
    invoke('focus_widget_drag').catch(() => {})
  }

  /** 专注走完、等用户确认：卡片换成「时间到」，铃声一直响到这个状态结束 */
  if (phase === 'awaiting') {
    return (
      <div
        onMouseDown={drag}
        className="fixed inset-0 flex flex-col items-center px-4 pb-4 pt-6"
      >
        <div
          ref={cardRef}
          className="widget-shell flex h-[52px] w-full items-center gap-2 overflow-hidden pl-3.5 pr-2"
        >
          <div
            className="flex min-w-0 cursor-default select-none items-center gap-2"
          >
            <Bell className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="shrink-0 text-[13px] font-semibold leading-none text-primary">
              时间到
            </span>
            <span
              ref={titleRef}
              title={titleTruncated ? taskName || undefined : undefined}
              className={cn(
                'max-w-[120px] truncate text-[11.5px] text-muted-foreground',
                // 有真实任务名才给反馈；显示「专注已完成」这类占位时不给
                taskName && 'transition-colors duration-150 hover:text-foreground',
              )}
            >
              {taskName || '专注已完成'}
            </span>
          </div>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="flex shrink-0 items-center gap-0.5"
          >
            <WidgetButton label="打开抹茶泡芙" onClick={openMain}>
              <AppWindow className="size-3" aria-hidden />
            </WidgetButton>
            <WidgetButton label="开始休息" onClick={() => act('rest')}>
              <Coffee className="size-3" aria-hidden />
            </WidgetButton>
            <WidgetButton label="知道了" onClick={() => act('dismiss')}>
              <Check className="size-3" aria-hidden />
            </WidgetButton>
            <WidgetButton label="关闭挂件" onClick={hide}>
              <X className="size-3" aria-hidden />
            </WidgetButton>
          </div>
        </div>
      </div>
    )
  }

  if (!focusing && !resting) {
    return (
      <div
        onMouseDown={drag}
        className="fixed inset-0 flex flex-col items-center px-4 pb-4 pt-6"
      >
        <div
          ref={cardRef}
          className="widget-shell flex h-[52px] w-full items-center gap-2 overflow-hidden pl-3.5 pr-2"
        >
          <div
            className="flex cursor-default select-none items-center gap-2"
          >
            <Timer className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="whitespace-nowrap text-[12px] text-muted-foreground">未在专注</span>
          </div>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="flex shrink-0 items-center gap-0.5"
          >
            <WidgetButton label="打开抹茶泡芙" onClick={openMain}>
              <AppWindow className="size-3" aria-hidden />
            </WidgetButton>
            <WidgetButton label="关闭挂件" onClick={hide}>
              <X className="size-3" aria-hidden />
            </WidgetButton>
          </div>
        </div>
      </div>
    )
  }

  const remain = formatRemain(snapshot?.remainMs ?? 0)
  const label = resting ? '休息' : paused ? '已暂停' : '专注'
  const shownTitle = taskName || label

  return (
    <div
        onMouseDown={drag}
        className="fixed inset-0 flex flex-col items-center px-4 pb-4 pt-6"
      >
      <div
        ref={cardRef}
        className="widget-shell flex h-[52px] w-full items-center gap-1.5 overflow-hidden pl-3.5 pr-2"
      >
        <div
          className="flex min-w-0 cursor-default select-none items-center gap-2"
        >
          {resting ? (
            <Coffee className="size-4 shrink-0 text-success" aria-hidden />
          ) : (
            <Timer
              className={cn('size-4 shrink-0', paused ? 'text-muted-foreground' : 'text-primary')}
              aria-hidden
            />
          )}
          <span className="shrink-0 font-mono text-[17px] leading-none tabular-nums text-foreground">
            {remain.minutes}:{remain.seconds}
          </span>
          {/* 标题被截断时，悬停由全局提示兜底显示全文 */}
          <span
            ref={titleRef}
            // 提示只兜底：没截断就不弹，截断了一定有
            title={titleTruncated ? shownTitle : undefined}
            className={cn(
              'max-w-[160px] truncate text-[11.5px] text-muted-foreground',
              // 和左侧导航栏一个路子的极轻微反馈：文字亮一点点。
              // 显示的是「专注 / 休息 / 已暂停」这些占位文案时就不给。
              taskName && 'transition-colors duration-150 hover:text-foreground',
            )}
          >
            {shownTitle}
          </span>
        </div>

        <div
            onMouseDown={(e) => e.stopPropagation()}
            className="flex shrink-0 items-center gap-0.5"
          >
          <WidgetButton label="打开抹茶泡芙" onClick={openMain}>
            <AppWindow className="size-3" aria-hidden />
          </WidgetButton>
          <WidgetButton
            label={paused ? (resting ? '继续休息' : '继续') : resting ? '暂停休息' : '暂停'}
            onClick={() => act(paused ? 'resume' : 'pause')}
          >
            {paused ? (
              <Play className="size-3" aria-hidden />
            ) : (
              <Pause className="size-3" aria-hidden />
            )}
          </WidgetButton>
          {resting ? (
            <WidgetButton label="跳过休息" onClick={() => act('skip')}>
              <SkipForward className="size-3" aria-hidden />
            </WidgetButton>
          ) : null}
          <WidgetButton label={resting ? '停止休息' : '停止'} onClick={askStop}>
            <Square className="size-3" aria-hidden />
          </WidgetButton>
          <WidgetButton label="关闭挂件" onClick={hide}>
            <X className="size-3" aria-hidden />
          </WidgetButton>
        </div>
      </div>
    </div>
  )
}

/**
 * 挂件上的小图标按钮。
 *
 * `label` 同时作为 aria-label 与 title —— title 由 NativeTitleTooltip 接管，
 * 换成和主窗一致的奶油风提示（700ms 延迟），不会出现系统黑底提示。
 */
function WidgetButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-6 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-foreground/8 hover:text-foreground"
    >
      {children}
    </button>
  )
}
