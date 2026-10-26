import {
  SETTINGS_SCHEMA_VERSION,
  defaultToggle,
  emptySettings,
  type PluginToggle,
  type ToolSettings,
} from './settings-schema'

export interface MigrationWarning {
  path: string
  reason: string
}

export interface MigrationResult {
  settings: ToolSettings
  /** 是否发生过修复或升级，宿主据此决定是否回写 */
  changed: boolean
  warnings: MigrationWarning[]
}

const MAX_RECENT = 50

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringList(value: unknown, path: string, warnings: MigrationWarning[]): string[] {
  if (!Array.isArray(value)) {
    warnings.push({ path, reason: 'not an array' })
    return []
  }
  const out: string[] = []
  for (const item of value) {
    if (typeof item === 'string' && item.length > 0 && item.length <= 64) {
      if (!out.includes(item)) out.push(item)
    } else {
      warnings.push({ path, reason: 'dropped invalid entry' })
    }
  }
  return out.slice(0, MAX_RECENT)
}

function pluginMap(value: unknown, warnings: MigrationWarning[]): Record<string, PluginToggle> {
  const out: Record<string, PluginToggle> = {}
  if (!isRecord(value)) {
    if (value !== undefined) warnings.push({ path: 'plugins', reason: 'not an object' })
    return out
  }
  for (const [id, raw] of Object.entries(value)) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || id.length > 64) {
      // 未知或非法插件 ID 直接忽略：既可能是插件已删除，也可能是配置损坏
      warnings.push({ path: `plugins.${id}`, reason: 'invalid plugin id' })
      continue
    }
    const source = isRecord(raw) ? raw : {}
    const bool = (key: keyof PluginToggle): boolean => {
      const v = source[key]
      if (typeof v === 'boolean') return v
      return defaultToggle()[key]
    }
    out[id] = {
      enabled: bool('enabled'),
      uiEnabled: bool('uiEnabled'),
    }
  }
  return out
}

/**
 * 把任意来源的配置还原成合法结构。
 *
 * 原则：无效配置安全恢复而不是整体丢弃 —— 能抢救的字段保留，
 * 抢救不了的落到默认值，并把原因记进 warnings，供宿主诊断。
 */
export function migrateSettings(raw: unknown): MigrationResult {
  const warnings: MigrationWarning[] = []

  if (!isRecord(raw)) {
    if (raw !== undefined && raw !== null) warnings.push({ path: '$', reason: 'root is not an object' })
    return { settings: emptySettings(), changed: true, warnings }
  }

  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0
  const changed = version !== SETTINGS_SCHEMA_VERSION

  const settings: ToolSettings = {
    schemaVersion: SETTINGS_SCHEMA_VERSION,
    plugins: pluginMap(raw.plugins, warnings),
    favorites: stringList(raw.favorites, 'favorites', warnings),
    pinnedTools: stringList(raw.pinnedTools, 'pinnedTools', warnings),
    recentTools: stringList(raw.recentTools, 'recentTools', warnings),
  }

  return { settings, changed: changed || warnings.length > 0, warnings }
}
