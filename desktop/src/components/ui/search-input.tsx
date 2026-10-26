import * as React from "react"
import { Search } from "lucide-react"
import { cn } from "cn"

/**
 * 带图标与快捷键提示的搜索框（设计契约 §6）
 *
 * 全应用统一搜索入口样式：主窗口导航、搜索浮窗、列表页过滤都用它。
 */
function SearchInput({
  value,
  onValueChange,
  placeholder = "搜索工具…",
  shortcut,
  autoFocus,
  onFocus,
  onKeyDown,
  className,
  size = "default",
}: {
  value: string
  onValueChange: (v: string) => void
  placeholder?: string
  /** 快捷键提示（如 "Ctrl K"），仅展示，不负责绑定 */
  shortcut?: string
  autoFocus?: boolean
  onFocus?: React.FocusEventHandler<HTMLInputElement>
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>
  className?: string
  size?: "default" | "lg"
}) {
  return (
    <div
      data-slot="search-input"
      className={cn(
        // 与全站玻璃同一标准：叠层玻璃、无描边（白边来源），聚焦只用外发光环
        "glass-layer group flex items-center gap-2 rounded-panel px-3 transition-shadow duration-150",
        "focus-within:ring-[3px] focus-within:ring-ring/30",
        size === "lg" ? "h-12" : "h-10",
        className
      )}
    >
      <Search
        className={cn(
          "shrink-0 text-muted-foreground transition-colors group-focus-within:text-primary",
          size === "lg" ? "size-4.5" : "size-4"
        )}
      />
      <input
        type="text"
        role="searchbox"
        value={value}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className={cn(
          "h-full w-full min-w-0 bg-transparent font-medium text-foreground outline-none",
          "placeholder:text-muted-foreground/70",
          size === "lg" ? "text-[16px]" : "text-[15px]"
        )}
      />
      {shortcut && !value ? (
        <kbd className="shrink-0 rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] leading-4 text-muted-foreground">
          {shortcut}
        </kbd>
      ) : null}
    </div>
  )
}

export { SearchInput }
