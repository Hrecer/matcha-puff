import { useEffect, type ComponentType } from 'react'
import { AppWindow, Check, Coffee, Pause, Play, Power, SkipForward, Square } from 'lucide-react'
import { emit, hideWindow, invoke } from '@/ipc/bridge'
import { WidgetHideIcon, WidgetShowIcon } from '@/components/focus/FocusWidgetIcons'
import { initFocusSync, useFocusStore } from '@/lib/focus-store'
import { initWidgetVisibility, toggleWidget, useWidgetVisible } from '@/lib/widget-visibility'
import { cn } from 'cn'

/**
 * 托盘右键菜单（自绘浮窗）。
 *
 * 专注控制不在这里执行：菜单只负责把动作发给主窗口（`focus:quick_action`），
 * 由主窗口的 focus-store 统一执行 —— 入账、音频、自动流转只有一条路径。
 * 计时快照用只读的 `initFocusSync` 同步，绝不 Load 业务文档（否则会重复入账）。
 */
export function TrayMenu() {
  const { snapshot } = useFocusStore()
  const widgetVisible = useWidgetVisible()

  useEffect(() => {
    void initFocusSync()
    initWidgetVisibility()
  }, [])

  // Esc 收起（菜单窗有焦点时）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hideWindow().catch(() => {})
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const pick = (fn: () => Promise<unknown> | void) => () => {
    // 先隐藏自己（动作可能让别的窗口抢焦点，触发失焦隐藏是同一个效果）
    hideWindow().catch(() => {})
    void fn()
  }

  const phase = snapshot?.phase ?? 'idle'
  const paused = phase === 'paused'
  const pausedFrom = snapshot?.pausedFrom ?? null
  const resting = phase === 'rest' || (paused && pausedFrom === 'rest')
  const focusing = phase === 'focus' || (paused && pausedFrom === 'focus')
  const awaiting = phase === 'awaiting'

  // 时间到：等用户确认，第一行给「开始休息」，第二行给「知道了」
  const primary = awaiting
    ? { icon: Coffee, label: '开始休息', action: 'rest' }
    : paused
      ? { icon: Play, label: pausedFrom === 'rest' ? '继续休息' : '继续专注', action: 'resume' }
      : resting
        ? { icon: Pause, label: '暂停休息', action: 'pause' }
        : focusing
          ? { icon: Pause, label: '暂停专注', action: 'pause' }
          : { icon: Play, label: '开始专注', action: 'start' }

  return (
    /* 面板精确填满窗口：不留 padding 空隙——空隙区的方角会透明外露，
       圆角外的桌面透出即干净圆角 */
    <div className="fixed inset-0">
      <div className="tray-panel flex h-full w-full flex-col overflow-hidden p-1">
        <MenuRow
          icon={AppWindow}
          label="显示窗口"
          onClick={pick(() => invoke('show_main_window'))}
        />
        <div className="mx-2 my-0.5 border-t border-border/60" />
        <MenuRow
          icon={primary.icon}
          label={primary.label}
          onClick={pick(() => emit('focus:quick_action', { action: primary.action }))}
        />
        {resting ? (
          <MenuRow
            icon={SkipForward}
            label="跳过休息"
            onClick={pick(() => emit('focus:quick_action', { action: 'skip' }))}
          />
        ) : null}
        <MenuRow
          icon={awaiting ? Check : Square}
          label={awaiting ? '知道了' : resting ? '停止休息' : '停止专注'}
          disabled={phase === 'idle'}
          onClick={pick(() => {
            // 时间到不是中断：确认一下直接离开响铃态，不走停止确认
            if (awaiting) {
              emit('focus:quick_action', { action: 'dismiss' }).catch(() => {})
              return
            }
            // 停止也要过确认：唤起主窗口，由它弹确认框
            invoke('show_main_window').catch(() => {})
            emit('focus:quick_action', { action: 'ask-stop' }).catch(() => {})
          })}
        />
        {/* 图标与文案表示「下一步动作」：开着给关闭，关着给打开 */}
        <MenuRow
          icon={widgetVisible ? WidgetHideIcon : WidgetShowIcon}
          label={widgetVisible ? '关闭挂件' : '打开挂件'}
          onClick={pick(() => {
            toggleWidget().catch(() => {})
          })}
        />
        <div className="mx-2 my-0.5 border-t border-border/60" />
        <MenuRow
          icon={Power}
          label="退出"
          danger
          onClick={pick(() => invoke('quit_app'))}
        />
      </div>
    </div>
  )
}

function MenuRow({
  icon: Icon,
  label,
  danger = false,
  disabled = false,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>
  label: string
  danger?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex min-h-8 flex-1 items-center gap-2 rounded-md px-2.5 text-[12.5px] font-medium outline-none transition-colors duration-150',
        'focus-visible:ring-[3px] focus-visible:ring-ring/40',
        disabled
          ? 'cursor-default text-muted-foreground/40'
          : danger
            ? 'text-muted-foreground hover:bg-destructive-bg hover:text-destructive'
            : 'text-foreground/90 hover:bg-foreground/8 hover:text-foreground',
      )}
    >
      <Icon className="size-3.5 shrink-0" />
      {label}
    </button>
  )
}
