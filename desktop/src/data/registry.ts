/**
 * 分类注册表
 *
 * 分类是工具页的展示骨架，数据来自构建期快照 src/data/categories.json。
 * 工具本身已全部由插件 manifest 提供，这里不再保存任何工具目录。
 */
import categoriesJson from '@/data/categories.json'
import type { Category } from '@/ipc/bridge'

export const allCategories = categoriesJson as unknown as Category[]

export const topCategories = () => allCategories.filter((c) => c.parent_id === 0)

export const childrenOf = (parentId: number) => allCategories.filter((c) => c.parent_id === parentId)

export const categoryById = (id: number) => allCategories.find((c) => c.id === id)
