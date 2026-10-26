import * as React from "react"
import { cn } from "cn"
import { Label } from "@/components/ui/label"

/**
 * 表单项统一骨架（设计契约 §5/§6）
 *
 * label + 控件 + 校验反馈三段式。工具参数表单必须用 Field 包裹，
 * 保证所有插件的表单版式一致。
 */
function Field({
  label,
  action,
  hint,
  error,
  required,
  htmlFor,
  children,
  className,
}: {
  label: string
  /**
   * label 行右侧的小动作（例如「重置」小按钮）。
   * 必须挂在 Label **外面**：Label 的「标注控件」是它内部第一个可标注元素，
   * 把 button 放进 Label 里，整行（含右侧空白）的点击都会被浏览器转发到那个按钮上。
   */
  action?: React.ReactNode
  /** 常驻辅助说明（占位/格式提示），与错误分开 */
  hint?: React.ReactNode
  /** 校验错误信息；有值时整体进入错误态 */
  error?: string | null
  required?: boolean
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div data-slot="field" className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor} className="text-[13px] text-foreground">
          {label}
          {required ? (
            <span className="ml-0.5 text-destructive" aria-hidden>
              *
            </span>
          ) : null}
        </Label>
        {action}
      </div>
      {children}
      {error ? (
        <p className="text-xs leading-relaxed text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export { Field }
