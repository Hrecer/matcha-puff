/**
 * 关键字匹配与高亮 —— 任务树、收件箱共用同一套口径。
 *
 * 统一在这里，是为了让「搜索」在两处的行为完全一致：
 * 空格分词、不区分大小写、**全部词都要命中**（不是任一命中）。
 * 高亮样式也只写一份，改一处两页同时生效。
 */
import type { ReactNode } from 'react'

/** 拆词：空格分词并统一小写 */
export function matchTerms(query: string): string[] {
  return query.trim().toLowerCase().split(/\s+/).filter(Boolean)
}

/** 文本是否命中全部关键字（要搜多个字段时，调用方自己用换行拼起来） */
export function matchesText(text: string, terms: readonly string[]): boolean {
  if (terms.length === 0) return true
  const haystack = text.toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

/**
 * 命中词高亮：用带捕获组的正则 split，奇数位就是命中的片段
 * （比自己跑 exec 循环稳，也不会漏掉首尾相接的连续命中）。
 */
export function highlightTerms(text: string, terms: readonly string[]): ReactNode {
  if (terms.length === 0) return text
  const pattern = terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  return text.split(new RegExp(`(${pattern})`, 'gi')).map((part, index) =>
    index % 2 === 1 ? (
      <mark
        key={index}
        className="rounded-[3px] bg-sidebar-accent px-0.5 text-sidebar-accent-foreground"
      >
        {part}
      </mark>
    ) : (
      part
    ),
  )
}
