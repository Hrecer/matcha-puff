import * as React from "react"
import { Tip } from "@/components/ui/tooltip"
import { PlayingBars } from "@/components/ui/playing-bars"
import { cn } from "cn"















function NavIcon({
  icon: Icon,
  active,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  active?: boolean
  className?: string
}) {
  return (
    <Icon
      className={cn(
        "size-4",
        active ? "text-sidebar-primary" : "text-muted-foreground/90 group-hover:text-foreground",
        className
      )}
    />
  )
}

function NavItem({
  icon: Icon,
  label,
  active,
  collapsed,
  catId,
  navKey,
  onClick,
  className,
  pulse,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
  /** 收起态：只显示图标 */
  collapsed?: boolean
  /** 顶层分类 id：侧栏按住上下拖时用于命中预览 */
  catId?: number
  /** 上/下导航组的拖拽命中 key（工作台/收藏/设置/关于） */
  navKey?: string
  onClick?: () => void
  className?: string
  /** 有内容正在后台运行时点亮的呼吸点 */
  pulse?: boolean
}) {
  const downAt = React.useRef(0)
  const button = (
    <button
      type="button"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        downAt.current = performance.now()
        onClick?.()
      }}
      onClick={() => {
        // 按下时已经切过了；随后的 click 不重复触发
        if (performance.now() - downAt.current < 500) return
        onClick?.()
      }}
      aria-current={active ? "page" : undefined}
      data-sliding-active={active ? "true" : undefined}
      data-cat-id={catId}
      data-nav-key={navKey}
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      className={cn(
        "group relative z-10 flex h-10 w-full cursor-pointer select-none items-center overflow-hidden rounded-md text-[14.5px] font-semibold outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/40",
        active ? "text-sidebar-primary" : "text-muted-foreground hover:text-foreground",
        className
      )}
      style={{
        transition: "background-color 150ms ease, color 150ms ease",
      }}
    >
      {/* 唯一图标：展开态钉在左缘 10px；收起态按钮 40px 宽，左缘 12px 才真正居中 */}
      <NavIcon
        icon={Icon}
        active={active}
        className={cn('absolute', collapsed ? 'left-3' : 'left-2.5')}
      />
      {/* 文字：不参与任何自身动画；随按钮/侧栏宽度被连续裁切（单一连续动作） */}
      <span
        aria-hidden={collapsed}
        draggable={false}
        className={cn(
          'block select-none overflow-hidden whitespace-nowrap pl-9',
          // 收起后按钮 40px 宽，文字起点 36px 会漏出半截字形，直接隐藏
          collapsed && 'invisible'
        )}
      >
        {label}
      </span>
      {pulse ? (
        collapsed ? (
          /* 收起态：40px 按钮里图标居中，律动条缩成右下角一枚 8px 小角标 */
          <PlayingBars className="absolute bottom-1 right-1 h-2" />
        ) : (
          <PlayingBars className="absolute right-2 top-1/2 h-3.5 -translate-y-1/2" />
        )
      ) : null}
    </button>
  )
  return collapsed ? (
    <Tip label={label} side="right" sideOffset={2}>
      {button}
    </Tip>
  ) : (
    button
  )
}

export { NavItem }
