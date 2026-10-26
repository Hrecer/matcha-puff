import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from 'cn'
import { Badge } from '@/components/ui/badge'
import { rangeText, type PlanEntry } from '@/components/focus/calendar-utils'

/** 任务分组的展开状态：只在本次运行内记住，重启/刷新即清空 */
const groupOpenMemory = new Map<string, boolean>()

/**
 * 一个顶层主线的计划分组：标题一行（可折叠）＋组内每条计划。
 *
 * 日历详情弹窗和日视图卡片共用这一份，两处展示口径完全一致：
 * 逾期排最前、已完成沉到最后、组标题右侧是 `已完成/总数`。
 *
 * `compact` 给日视图用：省掉简介和路径，只留标题、徽章与起止区间 ——
 * 日视图要在一屏里同时放下专注、习惯和任务，不能靠滚动。
 */
export function PlanGroupView({
  group,
  selectedKey,
  todayKey,
  color,
  compact = false,
  onJump,
}: {
  group: { rootId: string; rootTitle: string; items: PlanEntry[] }
  selectedKey: string
  todayKey: string
  color: string
  compact?: boolean
  /** 点主线名 / 点某条计划：跳到任务页对应的任务（顶层任务或其叶子） */
  onJump: (taskId: string) => void
}) {
  const [open, setOpen] = useState(
    () => groupOpenMemory.get(group.rootId) ?? group.items.some((plan) => !plan.complete),
  )
  const toggleOpen = () => {
    setOpen((value) => {
      const next = !value
      groupOpenMemory.set(group.rootId, next)
      return next
    })
  }
  const done = group.items.filter((plan) => plan.complete).length
  const items = [...group.items].sort((a, b) => {
    const aOverdue = selectedKey < todayKey && !a.complete
    const bOverdue = selectedKey < todayKey && !b.complete
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
    if (a.complete !== b.complete) return a.complete ? 1 : -1
    return a.start - b.start
  })

  return (
    <div className="rounded-lg bg-foreground/[0.04] px-2.5 py-1.5">
      {/* 一行两个可点区域，各管各的：
          - 左边那颗箭头：只负责展开 / 收起；
          - 主线名字：跳到任务页的那条顶层任务。
          以前整行都是折叠按钮，想跳转就没法点，点标题也只能收起，很别扭。 */}
      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          aria-label={`${open ? '收起' : '展开'} ${group.rootTitle}`}
          className="flex size-4 shrink-0 items-center justify-center rounded outline-none transition-colors hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronDown
            className={cn(
              'size-3 text-muted-foreground transition-transform',
              !open && '-rotate-90',
            )}
            aria-hidden
          />
        </button>
        <button
          type="button"
          onClick={() => onJump(group.rootId)}
          title={`打开任务：${group.rootTitle}`}
          className="group/root flex min-w-0 items-center gap-2 text-left outline-none"
        >
          <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
          <span className="min-w-0 truncate text-[11.5px] font-semibold text-foreground group-hover/root:text-primary">
            {group.rootTitle}
          </span>
        </button>
        <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
          {done}/{group.items.length}
        </span>
      </div>

      {open ? (
        <div className={cn('mt-1.5', compact && 'space-y-0.5')}>
          {items.map((plan) => {
            const overdue = selectedKey < todayKey && !plan.complete
            return (
              <div
                key={plan.id}
                className={cn(
                  !compact && 'mt-2 border-t border-foreground/20 pt-2 first:mt-0 first:border-0 first:pt-0',
                  compact && 'flex items-center gap-2',
                )}
              >
                <div className={cn('flex items-center gap-2', compact && 'min-w-0 flex-1')}>
                  <button
                    type="button"
                    onClick={() => onJump(plan.id)}
                    title={`打开任务：${plan.title}`}
                    className={cn(
                      'min-w-0 truncate text-left text-[12.5px] font-medium text-foreground outline-none hover:text-primary',
                      compact && 'text-[11.5px]',
                    )}
                  >
                    {plan.title}
                  </button>
                  {overdue ? (
                    <Badge variant="outline" className="ml-auto shrink-0 border-destructive/45 text-[9px] text-destructive">
                      已逾期
                    </Badge>
                  ) : plan.complete ? (
                    <Badge variant="secondary" className="ml-auto shrink-0 text-[9px]">
                      已完成
                    </Badge>
                  ) : null}
                </div>
                {!compact ? (
                  // 固定预留两行：路径 0/1/多行都不改变条目高度，悬停看未截断的完整路径
                  <p
                    className="mt-0.5 line-clamp-2 min-h-[32px] break-words text-[10.5px] leading-[16px] text-muted-foreground/80"
                    title={plan.path || undefined}
                  >
                    {plan.path}
                  </p>
                ) : null}
                {!compact && plan.desc ? (
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{plan.desc}</p>
                ) : null}
                {compact ? null : (
                  <p className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground/80">
                    {rangeText(plan.start, plan.end)}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
