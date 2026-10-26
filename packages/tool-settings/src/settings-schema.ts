import { z } from 'zod'


export const SETTINGS_SCHEMA_VERSION = 1

export const pluginToggleSchema = z.object({
  enabled: z.boolean(),
  uiEnabled: z.boolean(),
})

export type PluginToggle = z.infer<typeof pluginToggleSchema>

/**
 * 用户偏好
 *
 * 只包含「用户怎么使用工具」的信息：启用状态、权限、收藏、置顶、最近使用。
 * 刻意不包含工具的 ID、Schema、执行代码或默认策略 —— 那些属于插件定义，用户配置不得覆盖。
 */
export const toolSettingsSchema = z.object({
  schemaVersion: z.number().int().positive(),
  plugins: z.record(z.string(), pluginToggleSchema),
  favorites: z.array(z.string()),
  pinnedTools: z.array(z.string()),
  recentTools: z.array(z.string()),
})

export type ToolSettings = z.infer<typeof toolSettingsSchema>

export const pluginIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, '插件 ID 只接受小写字母、数字与连字符')
  .max(64)

export function emptySettings(): ToolSettings {
  return {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    plugins: {},
    favorites: [],
    pinnedTools: [],
    recentTools: [],
  }
}

/** 缺省兜底：某个插件从未配置过时的取值 */
export function defaultToggle(): PluginToggle {
  return { enabled: true, uiEnabled: true }
}
