import { isValidToolId, isValidVersion, toToolMetadata } from '@matcha-puff/tool-contracts'
import type { AnyToolPlugin, ToolCaller, ToolMetadata, ToolPolicy } from '@matcha-puff/tool-contracts'

export interface ValidationIssue {
  level: 'error' | 'warning'
  code: string
  message: string
  pluginId?: string
}

export interface ToolRegistryOptions {
  /** 注册时发现致命冲突是否直接抛错；校验脚本通常设为 false 以收集全部问题 */
  throwOnConflict?: boolean
}

/**
 * 工具清单的唯一运行时入口
 *
 * 内置工具在构建时注册（由 scripts/generate-tool-index.ts 生成清单，不手工维护注册代码）。
 * 启用、禁用、收藏、排序等用户态信息不在这里 —— 它们存在用户配置里，两者互不覆盖。
 */
export interface ToolRegistry {
  register(plugin: AnyToolPlugin): void
  registerAll(plugins: readonly AnyToolPlugin[]): void
  has(id: string): boolean
  get(id: string): AnyToolPlugin | undefined
  list(): ToolMetadata[]
  /** 按调用方过滤：只返回默认策略允许的工具（用户配置由 Runtime 层再叠加） */
  listForCaller(caller: ToolCaller): ToolMetadata[]
  getDefaultPolicy(id: string): ToolPolicy | undefined
  size(): number
  validate(): ValidationIssue[]
}

function allows(policy: ToolPolicy): boolean {
  return policy.enabled && policy.uiEnabled
}

export function createRegistry(options: ToolRegistryOptions = {}): ToolRegistry {
  const plugins = new Map<string, AnyToolPlugin>()

  function check(plugin: AnyToolPlugin, issues: ValidationIssue[], allowExisting: boolean): boolean {
    const id = plugin?.id
    const at = typeof id === 'string' && id ? { pluginId: id } : {}

    if (typeof id !== 'string' || !isValidToolId(id)) {
      issues.push({ level: 'error', code: 'INVALID_ID', message: `工具 ID 非法：${String(id)}`, ...at })
      return false
    }
    if (!allowExisting && plugins.has(id)) {
      issues.push({ level: 'error', code: 'DUPLICATE_ID', message: `工具 ID 重复：${id}`, pluginId: id })
      return false
    }
    if (!isValidVersion(plugin.version)) {
      issues.push({ level: 'error', code: 'INVALID_VERSION', message: '版本号需为 semver', pluginId: id })
      return false
    }
    if (!plugin.name || !plugin.description) {
      issues.push({ level: 'error', code: 'MISSING_FIELD', message: '缺少 name 或 description', pluginId: id })
      return false
    }
    if (!plugin.inputSchema || !plugin.outputSchema) {
      issues.push({ level: 'error', code: 'MISSING_SCHEMA', message: '缺少 inputSchema 或 outputSchema', pluginId: id })
      return false
    }
    if (typeof plugin.execute !== 'function') {
      issues.push({ level: 'error', code: 'MISSING_EXECUTE', message: '缺少 execute', pluginId: id })
      return false
    }
    if (!plugin.defaultPolicy) {
      issues.push({ level: 'error', code: 'MISSING_POLICY', message: '缺少 defaultPolicy', pluginId: id })
      return false
    }
    if (!plugin.keywords?.length) {
      issues.push({ level: 'warning', code: 'NO_KEYWORDS', message: '未设置 keywords，影响搜索召回', pluginId: id })
    }
    return true
  }

  function collectIssues(plugin: AnyToolPlugin, allowExisting: boolean): ValidationIssue[] {
    const issues: ValidationIssue[] = []
    check(plugin, issues, allowExisting)
    return issues
  }

  function register(plugin: AnyToolPlugin): void {
    const issues = collectIssues(plugin, false)
    const fatal = issues.find((issue) => issue.level === 'error')
    if (fatal) {
      if (options.throwOnConflict !== false) {
        throw new Error(`[${fatal.code}] ${fatal.message}`)
      }
      return
    }
    plugins.set(plugin.id, plugin)
  }

  return {
    register,

    registerAll: (list) => {
      for (const plugin of list) register(plugin)
    },

    has: (id) => plugins.has(id),

    get: (id) => plugins.get(id),

    list: () => [...plugins.values()].map(toToolMetadata),

    listForCaller: () =>
      [...plugins.values()].filter((plugin) => allows(plugin.defaultPolicy)).map(toToolMetadata),

    getDefaultPolicy: (id) => plugins.get(id)?.defaultPolicy,

    size: () => plugins.size,

    validate: () => {
      const issues: ValidationIssue[] = []
      const seenNames = new Map<string, string>()

      for (const plugin of plugins.values()) {
        issues.push(...collectIssues(plugin, true))
        const nameOwner = seenNames.get(plugin.name)
        if (nameOwner) {
          issues.push({
            level: 'warning',
            code: 'DUPLICATE_NAME',
            message: `工具名称与 ${nameOwner} 重复：${plugin.name}`,
            pluginId: plugin.id,
          })
        } else {
          seenNames.set(plugin.name, plugin.id)
        }
      }

      return issues
    },
  }
}

export type { ToolMetadata }
