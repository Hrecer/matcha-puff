import * as React from "react"
import { AlertTriangle, ChevronDown } from "lucide-react"
import { cn } from "cn"
import { errorCopy } from "@/lib/error-copy"

/**
 * 统一错误视图（设计契约 §5/§6）
 *
 * 结构：错误码徽标 + 人话标题 + 可操作建议 + 可折叠的原始 message（已脱敏）。
 * 全应用错误展示只允许走这一个组件。
 */
function ErrorState({
  code,
  message,
  className,
  compact = false,
}: {
  /** 稳定错误码（TOOL_ERROR_CODES 之一，未知码走兜底） */
  code?: string
  /** 内核返回的原始 message（已脱敏） */
  message?: string
  className?: string
  /** 紧凑版：用于结果区内嵌，不带大图标 */
  compact?: boolean
}) {
  const copy = errorCopy(code)
  const [open, setOpen] = React.useState(false)

  return (
    <div
      data-slot="error-state"
      role="alert"
      className={cn(
        "rounded-lg border border-destructive/25 bg-destructive-bg",
        compact ? "p-3" : "p-4",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/12 text-destructive">
          <AlertTriangle className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-destructive">
              {copy.title}
            </p>
            {code ? (
              <span className="rounded-sm bg-destructive/10 px-1.5 py-px font-mono text-[10px] leading-4 text-destructive/80">
                {code}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {copy.hint}
          </p>

          {message ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1 rounded text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40"
              >
                <ChevronDown
                  className={cn(
                    "size-3.5 transition-transform duration-200",
                    open && "rotate-180"
                  )}
                />
                {open ? "收起详情" : "查看详情"}
              </button>
              {open ? (
                <pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted/70 p-2.5 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap text-foreground/85">
                  {message}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export { ErrorState }
