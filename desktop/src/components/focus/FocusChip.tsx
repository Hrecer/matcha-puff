import { useEffect, useRef, useState } from 'react'
import { Check, CircleDot, Coffee, ExternalLink, Pause, Play, SkipForward, Square } from 'lucide-react'
import { formatRemain } from '@matcha-puff/pomodoro-core'
import { Button } from '@/components/ui/button'
import { WidgetHideIcon, WidgetShowIcon } from '@/components/focus/FocusWidgetIcons'
import { cn } from 'cn'
import { emit, invoke } from '@/ipc/bridge'
import {
  initFocusSync,
  pauseFocus,
  resumeFocus,
  skipCurrentRest,
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

function currentLabel(): string | undefined {
  return window.__TAURI_METADATA__?.__currentWindow?.label
}

function isMainWindow(): boolean {
  const label = currentLabel()
  return !label || label === 'main'
}

/**
 * 标题栏左端的专注芯片。
 *
 * 只在有计时会话（专注 / 休息 / 暂停）时出现；开始计时统一在专注页选好任务再做，
 * 这里不提供“开始一个未命名番茄钟”的入口。
 */
export function FocusChip() {
  const { ready, supported, snapshot } = useFocusStore()
  const [open, setOpen] = useState(false)
  const widgetVisible = useWidgetVisible()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void initFocusSync()
    initWidgetVisibility()
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!snapshot || snapshot.phase === 'idle') setOpen(false)
  }, [snapshot])

  if (!supported || !ready || !snapshot || snapshot.phase === 'idle') return null

  const phase = snapshot.phase
  const running = phase === 'focus'
  const resting = phase === 'rest'
  const paused = phase === 'paused'
  const awaiting = phase === 'awaiting'
  const inRest = resting || (paused && snapshot.pausedFrom === 'rest')
  const remain = formatRemain(snapshot.remainMs)
  const taskName = snapshot.task?.name ?? ''
  const dotClass = running || awaiting
    ? 'bg-primary'
    : resting
      ? 'bg-success'
      : 'bg-muted-foreground/70'

  // 工具子窗没有业务文档与弹窗宿主：休息 / 确认都交给主窗口执行
  const mainWindow = isMainWindow()
  const startRest = () => {
    if (mainWindow) {
      void startManualRest()
      return
    }
    emit('focus:quick_action', { action: 'rest' }).catch(() => {})
  }
  const dismissAwaiting = () => {
    if (mainWindow) {
      void stopFocus()
      return
    }
    emit('focus:quick_action', { action: 'dismiss' }).catch(() => {})
  }
  const toggleWidgetVisibility = () => {
    setOpen(false)
    void (widgetVisible ? hideWidget() : showWidget()).catch(() => {})
  }
  const openFocusPage = () => {
    setOpen(false)
    // 工具子窗没有主窗路由：把主窗唤出来，由它落到专注页
    if (!mainWindow) {
      invoke('show_main_window').catch(() => {})
      emit('focus:quick_action', { action: 'open-focus' }).catch(() => {})
      return
    }
    window.location.hash = '#/focus'
  }

  return (
    <div
      ref={rootRef}
      className="relative ml-1 shrink-0"
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="专注计时"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-full border border-border/60 bg-background/55 px-2.5 text-[11.5px] font-medium text-foreground outline-none transition-colors hover:border-foreground/20 hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40',
          open && 'border-foreground/20 bg-accent',
        )}
      >
        <span className={cn('size-1.5 rounded-full', dotClass, running && 'animate-pulse')} />
        <span className="font-mono tabular-nums">
          {remain.minutes}:{remain.seconds}
        </span>
        {taskName && running ? (
          <span className="max-w-[88px] truncate text-muted-foreground">{taskName}</span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-[252px] rounded-panel border border-border/70 bg-popover/95 p-3 text-popover-foreground shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <CircleDot
              className={cn(
                'size-3.5',
                running || awaiting
                  ? 'text-primary'
                  : resting
                    ? 'text-success'
                    : 'text-muted-foreground',
              )}
              aria-hidden
            />
            <span className="text-[12px] font-semibold text-foreground">
              {awaiting ? '时间到' : running ? '专注中' : resting ? '休息中' : '已暂停'}
            </span>
          </div>

          <p className="mt-2 font-mono text-[28px] leading-none tracking-tight tabular-nums text-foreground">
            {remain.minutes}:{remain.seconds}
          </p>
          {taskName ? (
            <p className="mt-1 truncate text-[11.5px] text-muted-foreground">{taskName}</p>
          ) : null}

          <div className="mt-3 flex flex-col gap-1.5">
            {awaiting ? (
              <>
                <Button size="sm" onClick={startRest}>
                  <Coffee className="size-3.5" aria-hidden />
                  开始休息
                </Button>
                <Button size="sm" variant="outline" onClick={dismissAwaiting}>
                  <Check className="size-3.5" aria-hidden />
                  知道了
                </Button>
              </>
            ) : paused ? (
              <Button size="sm" onClick={() => void resumeFocus()}>
                <Play className="size-3.5" aria-hidden />
                继续
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => void pauseFocus()}>
                <Pause className="size-3.5" aria-hidden />
                暂停
              </Button>
            )}

            {inRest ? (
              <Button size="sm" variant="outline" onClick={() => void skipCurrentRest()}>
                <SkipForward className="size-3.5" aria-hidden />
                跳过休息
              </Button>
            ) : null}

            {awaiting ? null : (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  // 与专注页、挂件、托盘的停止同一条路径：先收起面板，再弹确认。
                  // 工具子窗没有弹窗宿主，把请求递给主窗口。
                  setOpen(false)
                  if (mainWindow) {
                    requestStopConfirm()
                    return
                  }
                  invoke('show_main_window').catch(() => {})
                  emit('focus:quick_action', { action: 'ask-stop' }).catch(() => {})
                }}
              >
                <Square className="size-3" aria-hidden />
                {inRest ? '停止休息' : '停止'}
              </Button>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <Button
                size="xs"
                className="h-8 w-full"
                variant="ghost"
                onClick={toggleWidgetVisibility}
              >
                {widgetVisible ? (
                  <WidgetHideIcon className="size-3.5" />
                ) : (
                  <WidgetShowIcon className="size-3.5" />
                )}
                {widgetVisible ? '关闭挂件' : '打开挂件'}
              </Button>
              <Button size="xs" className="h-8 w-full" variant="ghost" onClick={openFocusPage}>
                <ExternalLink className="size-3.5" aria-hidden />
                打开专注页
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
