import * as React from "react"
import { cn } from "cn"

/**
 * 统一空状态（设计契约 §6）
 *
 * 全应用只允许用这一个空状态组件，避免每个页面各写一套。
 * 图标 + 一句说明 + 可选行动，三段式。
 */
function Empty({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = "default",
}: React.ComponentProps<"div"> & {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  size?: "sm" | "default"
}) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "sm" ? "gap-2 px-4 py-8" : "gap-3 px-6 py-14",
        className
      )}
    >
      {Icon ? (
        <div
          className={cn(
            // 图标卡片：用侧栏「选中项」那种绿（sidebar-accent），不是最深的主色 ——
            // 主色是最重的强调色，一屏空状态顶着一块深绿反而压得慌。
            "flex items-center justify-center rounded-lg bg-sidebar-accent text-sidebar-accent-foreground",
            size === "sm" ? "size-11" : "size-14"
          )}
        >
          <Icon className={cn(size === "sm" ? "size-5" : "size-6", "shrink-0")} />
        </div>
      ) : null}
      <div className="space-y-1">
        {/* 文字统一到全站标准字号：小号也不再缩水 */}
        <p className="text-[15px] font-medium text-foreground">{title}</p>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  )
}

export { Empty }
