/**
 * 内置工具插件集合
 *
 * 注册清单由 `pnpm plugin:index` 从插件目录自动生成，新增工具不需要改这里。
 */
import type { AnyToolPlugin } from '@matcha-puff/tool-contracts'
import { builtinPlugins as generated, builtinPluginIds } from './generated/tool-index'

/** 以统一类型导出，避免各插件自身的泛型泄漏到使用方 */
export const builtinPlugins: readonly AnyToolPlugin[] = generated
export { builtinPluginIds }

export * from './generated/tool-exports'

export { STORAGE_GROUPS } from './shared/units'
export type { UnitDef, UnitGroup } from './shared/units'
export { TRENDING_LANGUAGES } from './github-trending/languages'
export type { TrendingLanguage } from './github-trending/languages'
export * from './shared/datetime'
