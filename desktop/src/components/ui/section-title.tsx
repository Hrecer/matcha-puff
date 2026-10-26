import type { ReactNode } from 'react'

/** 卡片标题行（统一版式）：标题 + 右侧说明，无装饰竖条，统一无衬线字体。 */
export function SectionTitle({
  children,
  trailing,
}: {
  children: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 font-sans">
      <span className="shrink-0 text-[12px] font-semibold text-foreground">{children}</span>
      {trailing ? (
        <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/70">
          {trailing}
        </span>
      ) : null}
    </div>
  )
}
