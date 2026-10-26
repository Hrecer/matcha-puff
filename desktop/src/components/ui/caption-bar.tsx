import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import logo from '@/assets/logo.png'
import { FocusChip } from '@/components/focus/FocusChip'
import { Tip } from '@/components/ui/tooltip'
import { cn } from 'cn'
import { startDragging, toggleMaximize, windowCmd } from '@/ipc/bridge'



















export function CaptionBar({
  brand = '抹茶泡芙',
  icon: Icon,
  maximized = false,
  className,
}: {
  /** 品牌名（标题栏左端） */
  brand?: string
  /** 左端图标；工具子窗口传插件图标，主窗口用品牌 logo */
  icon?: LucideIcon
  /** 是否最大化：由外壳统一轮询后传入（按钮图标切换用） */
  maximized?: boolean
  className?: string
}) {
  




  const drag = React.useRef({ down: false, moved: false, x: 0, y: 0 })

  React.useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const state = drag.current
      if (!state.down || state.moved) return
      if (Math.hypot(e.clientX - state.x, e.clientY - state.y) < 4) return
      state.moved = true
      state.down = false
      startDragging().catch(() => {})
    }
    const onUp = () => {
      drag.current.down = false
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const onDragMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    // 第二次按下立即切换，和 Windows 原生标题栏一样不等第二次松手
    if (e.detail === 2) {
      drag.current.down = false
      toggleMaximize().catch(() => {})
      return
    }
    drag.current = { down: true, moved: false, x: e.clientX, y: e.clientY }
  }

  return (
    <header
      className={cn(
        'caption flex h-11 shrink-0 select-none items-stretch',
        className
      )}
    >
      {}
      <div
        role="presentation"
        onMouseDown={onDragMouseDown}
        className="flex min-w-0 flex-1 items-center gap-2.5 pl-4"
      >
        {Icon ? (
          <span className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-accent text-accent-foreground">
            <Icon className="size-3" />
          </span>
        ) : (
          <img
            src={logo}
            alt=""
            aria-hidden
            draggable={false}
            className="size-[18px] shrink-0 rounded-[5px]"
          />
        )}
        <span className="truncate pr-[2px] text-[13.5px] font-semibold tracking-tight text-foreground">
          {brand}
        </span>
        <FocusChip />
      </div>

      {}
      <div className="flex items-stretch">
        <CapButton label="最小化" onClick={() => windowCmd('minimize').catch(() => {})}>
          <MinimizeGlyph />
        </CapButton>
        <CapButton
          label={maximized ? '还原' : '最大化'}
          onClick={() => toggleMaximize().catch(() => {})}
        >
          {maximized ? <RestoreGlyph /> : <MaximizeGlyph />}
        </CapButton>
        <CapButton label="关闭" close onClick={() => windowCmd('close').catch(() => {})}>
          <CloseGlyph />
        </CapButton>
      </div>
    </header>
  )
}

/** 自绘窗口按钮：46px 通高，悬停灰底，关闭悬停红底（Windows 原生语义） */
function CapButton({
  label,
  close,
  onClick,
  children,
}: {
  label: string
  close?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn('cap-btn', close && 'cap-btn-close')}
      >
        {children}
      </button>
    </Tip>
  )
}

/* ── 自绘图标：10px 视窗、圆头描边，不用图标库的窗口按钮 ── */

function MinimizeGlyph() {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
      <path d="M1.6 5h6.8" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" />
    </svg>
  )
}

function MaximizeGlyph() {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
      <rect
        x="1.2"
        y="1.2"
        width="7.6"
        height="7.6"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
      />
    </svg>
  )
}

function RestoreGlyph() {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
      {/* 前窗（左下大框） */}
      <rect
        x="1"
        y="3"
        width="6"
        height="6"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
      />
      {/* 后窗（右上小框）：只画露出来的部分——被前窗遮住的边不描 */}
      <path
        d="M3 3V2.5a1.5 1.5 0 0 1 1.5-1.5H8a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5H7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  )
}

function CloseGlyph() {
  return (
    <svg viewBox="0 0 10 10" className="size-2.5" aria-hidden>
      <path
        d="M2.4 2.4l5.2 5.2M7.6 2.4L2.4 7.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
    </svg>
  )
}
