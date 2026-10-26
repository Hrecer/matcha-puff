import type { ToolMetadata } from '@matcha-puff/tool-contracts'
import { allCategories } from '@/data/registry'

const ID_BY_CODE = new Map(allCategories.map((category) => [category.code, category.id]))

/** manifest.desktop.categories 里声明的工具页子分类（按声明顺序） */
export function pluginCategoryIds(meta: Pick<ToolMetadata, 'desktop'>): number[] {
  return (meta.desktop?.categories ?? [])
    .map((code) => ID_BY_CODE.get(code))
    .filter((id): id is number => id !== undefined)
}

export function pluginPrimaryCategoryId(meta: Pick<ToolMetadata, 'desktop'>): number | undefined {
  return pluginCategoryIds(meta)[0]
}
