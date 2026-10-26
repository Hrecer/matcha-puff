import {
  createExecutionContext,
  redactDetails,
  toolFail,
  toolOk,
} from '@matcha-puff/tool-contracts'
import type {
  ToolCaller,
  ToolLogger,
  ToolMetadata,
  ToolResult,
  ToolServices,
} from '@matcha-puff/tool-contracts'
import { defaultToggle } from '@matcha-puff/tool-settings'
import type { SettingsStore } from '@matcha-puff/tool-settings'
import { createDeadline, measureBytes, resolvePolicyLimits, withTimeout } from './execution-policy'
import type { ExecutionPolicy } from './execution-policy'
import { isAllowed, resolvePolicy } from './permissions'
import type { ToolRegistry } from './registry'

export interface ExecuteToolParams {
  toolId: string
  input: unknown
  caller: ToolCaller
  signal?: AbortSignal
  timeoutMs?: number
  requestId?: string
  /** 本次调用额外注入的服务，与 Runtime 全局服务合并（同名以本次为准） */
  services?: ToolServices
}

export interface ToolRuntimeOptions {
  registry: ToolRegistry
  settings: SettingsStore
  logger?: ToolLogger
  /** 全局共享服务；工具只能拿到这里明确提供的能力 */
  services?: ToolServices
  policy?: Partial<ExecutionPolicy>
  locale?: string
}

/**
 * 所有工具调用的唯一入口。
 *
 * 界面与应用内 AI 都只能通过它执行工具 —— 任何绕过它直接调用插件 execute 的行为都会
 * 跳过启用状态、权限与参数校验，是必须避免的。
 */
export interface ToolRuntime {
  execute<TOutput = unknown>(params: ExecuteToolParams): Promise<ToolResult<TOutput>>
  listForCaller(caller: ToolCaller): Promise<ToolMetadata[]>
  getMetadata(toolId: string): ToolMetadata | undefined
}

const SILENT_LOGGER: ToolLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

export function createConsoleLogger(prefix = '[tool]'): ToolLogger {
  const emit =
    (level: 'debug' | 'info' | 'warn' | 'error') =>
    (message: string, meta?: Record<string, unknown>): void => {
      const line = `${prefix} [${level}] ${message}`
      if (meta && Object.keys(meta).length > 0) {
        console.error(line, redactDetails(meta))
        return
      }
      console.error(line)
    }
  return { debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error') }
}

function isToolResult(value: unknown): value is ToolResult<unknown> {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as { ok?: unknown }
  return typeof candidate.ok === 'boolean'
}

export function createRuntime(options: ToolRuntimeOptions): ToolRuntime {
  const { registry, settings } = options
  const logger = options.logger ?? SILENT_LOGGER
  const limits = resolvePolicyLimits(options.policy)
  const baseServices = options.services ?? {}

  async function execute<TOutput>(params: ExecuteToolParams): Promise<ToolResult<TOutput>> {
    const startedAt = Date.now()
    const duration = () => ({ durationMs: Date.now() - startedAt })

    // ① 查找工具
    const plugin = registry.get(params.toolId)

    // ② 验证工具是否存在
    if (!plugin) {
      logger.warn('tool not found', { toolId: params.toolId, caller: params.caller })
      return toolFail('TOOL_NOT_FOUND', `未找到工具：${params.toolId}`, undefined, duration())
    }

    // ③ 检查工具是否启用  ④ 检查是否在界面上可见
    //    用户配置只能收紧默认策略，不能放宽
    const toggle = await settings.getPluginToggle(params.toolId).catch(() => defaultToggle())
    const policy = resolvePolicy(plugin.defaultPolicy, toggle)

    if (!policy.enabled) {
      return toolFail('TOOL_DISABLED', `工具已禁用：${plugin.name}`, undefined, duration())
    }
    if (!policy.uiEnabled) {
      return toolFail(
        'CALLER_NOT_ALLOWED',
        `工具已在界面上隐藏：${plugin.name}`,
        undefined,
        duration(),
      )
    }

    // ⑤ 校验输入参数
    const parsedInput = plugin.inputSchema.safeParse(params.input ?? {})
    if (!parsedInput.success) {
      return toolFail(
        'INVALID_INPUT',
        `参数校验失败：${plugin.name}`,
        { issues: parsedInput.error.issues.slice(0, 20) },
        duration(),
      )
    }
    if (measureBytes(parsedInput.data) > limits.maxInputBytes) {
      return toolFail(
        'INVALID_INPUT',
        `输入内容过大，上限 ${Math.floor(limits.maxInputBytes / 1024)} KB`,
        undefined,
        duration(),
      )
    }

    // ⑥ 创建执行上下文
    const timeoutMs = params.timeoutMs ?? limits.timeoutMs
    const deadline = createDeadline(timeoutMs, params.signal)
    const context = createExecutionContext({
      toolId: plugin.id,
      caller: params.caller,
      requestId: params.requestId,
      logger,
      services: { ...baseServices, ...params.services },
      signal: deadline.signal,
      ...(options.locale ? { locale: options.locale } : {}),
    })

    let raw: unknown
    try {
      // ⑦ 执行业务函数
      logger.debug('execute', { toolId: plugin.id, caller: params.caller, requestId: context.requestId })
      raw = await withTimeout(Promise.resolve(plugin.execute(parsedInput.data, context)), timeoutMs, deadline.signal)
    } catch (error) {
      const meta = duration()
      if (deadline.timedOut()) {
        logger.warn('execution timeout', { toolId: plugin.id, requestId: context.requestId })
        return toolFail('EXECUTION_TIMEOUT', `执行超时（${timeoutMs}ms）：${plugin.name}`, undefined, meta)
      }
      const aborted = params.signal?.aborted || deadline.signal.aborted
      if (aborted || (error instanceof Error && error.name === 'ToolCancelledError')) {
        return toolFail('EXECUTION_CANCELLED', '执行已取消', undefined, meta)
      }
      logger.error('execution failed', {
        toolId: plugin.id,
        requestId: context.requestId,
        message: error instanceof Error ? error.message : String(error),
      })
      return toolFail(
        'EXECUTION_FAILED',
        error instanceof Error ? error.message : '执行失败',
        undefined,
        meta,
      )
    } finally {
      deadline.dispose()
    }

    if (!isToolResult(raw)) {
      // ⑨ 标准化结果：返回值必须是 ToolResult
      return toolFail(
        'EXECUTION_FAILED',
        `工具返回值不是合法的 ToolResult：${plugin.name}`,
        undefined,
        duration(),
      )
    }

    if (!raw.ok) {
      logger.info('execution returned failure', { toolId: plugin.id, code: raw.error.code })
      return raw as ToolResult<TOutput>
    }

    // ⑧ 校验返回值
    const parsedOutput = plugin.outputSchema.safeParse(raw.data)
    if (!parsedOutput.success) {
      logger.error('invalid output', { toolId: plugin.id, issues: parsedOutput.error.issues.slice(0, 10) })
      return toolFail(
        'INVALID_OUTPUT',
        `返回值不符合声明的 Schema：${plugin.name}`,
        { issues: parsedOutput.error.issues.slice(0, 10) },
        duration(),
      )
    }
    if (measureBytes(parsedOutput.data) > limits.maxOutputBytes) {
      return toolFail(
        'INVALID_OUTPUT',
        `输出内容过大，上限 ${Math.floor(limits.maxOutputBytes / 1024)} KB`,
        undefined,
        duration(),
      )
    }

    // ⑨ 成功
    const meta = duration()
    logger.debug('execute ok', { toolId: plugin.id, durationMs: meta.durationMs })
    return toolOk(parsedOutput.data as TOutput, meta)
  }

  return {
    execute,

    listForCaller: async (caller) => {
      const toggleMap = await settings.get().catch(() => null)
      return registry
        .listForCaller(caller)
        .filter((metadata) => {
          if (!toggleMap) return true
          const toggle = toggleMap.plugins[metadata.id] ?? defaultToggle()
          return isAllowed(resolvePolicy(metadata.defaultPolicy, toggle))
        })
    },

    getMetadata: (toolId) => registry.list().find((metadata) => metadata.id === toolId),
  }
}
