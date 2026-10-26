/**
 * 简介输入框：固定两行高、超出就在内部滚动，右下角不给拉伸把手。
 *
 * 任务和习惯两处的简介是同一个东西，所以统一收在这里，别再各写一份 className。
 *
 * 高度＝2 行 + 上下内边距(0.5rem×2) + 上下边框(1px×2) = calc(2lh + 1.125rem)：
 * 用 CSS 的 lh 单位直接取**当前真实行高**。项目在 theme.css 里用 !important 整体放大过字号
 * （text-sm 实际 16px），按字号硬算出来的高度装不下两行，会一直冒滚动条。
 * min/max 一起钉住：控件基础样式是 field-sizing-content，不钉住会被内容撑高。
 */
import type { ComponentProps } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from 'cn'

export function DescTextarea({ className, ...props }: ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      rows={2}
      className={cn(
        'max-h-[calc(2lh+1.125rem)] min-h-[calc(2lh+1.125rem)] resize-none overflow-y-auto scroll-thin',
        className,
      )}
      {...props}
    />
  )
}
