/**
 * 稳定错误码
 *
 * 界面与应用内 AI 共用同一套来源；各适配层负责把它转成各自的展示形式。
 */
export const TOOL_ERROR_CODES = {
  TOOL_NOT_FOUND: 'TOOL_NOT_FOUND',
  TOOL_DISABLED: 'TOOL_DISABLED',
  CALLER_NOT_ALLOWED: 'CALLER_NOT_ALLOWED',
  INVALID_INPUT: 'INVALID_INPUT',
  INVALID_OUTPUT: 'INVALID_OUTPUT',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  EXECUTION_TIMEOUT: 'EXECUTION_TIMEOUT',
  EXECUTION_CANCELLED: 'EXECUTION_CANCELLED',
} as const

export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[keyof typeof TOOL_ERROR_CODES]

export interface ToolError {
  code: ToolErrorCode
  message: string
  /** 只放可序列化且不泄露本机信息的补充数据；生产实现会再做一次脱敏 */
  details?: unknown
}

/** 成功的执行时长等可选元信息 */
export interface ToolSuccessMeta {
  durationMs?: number
}

export type ToolResult<T> =
  | { ok: true; data: T; meta?: ToolSuccessMeta }
  | { ok: false; error: ToolError; meta?: ToolSuccessMeta }

export function toolOk<T>(data: T, meta?: ToolSuccessMeta): ToolResult<T> {
  return meta ? { ok: true, data, meta } : { ok: true, data }
}

export function toolFail(
  code: ToolErrorCode,
  message: string,
  details?: unknown,
  meta?: ToolSuccessMeta,
): ToolResult<never> {
  const error: ToolError = details === undefined ? { code, message } : { code, message, details: redactDetails(details) }
  return meta ? { ok: false, error, meta } : { ok: false, error }
}

export function isToolFailure<T>(result: ToolResult<T>): result is Extract<ToolResult<T>, { ok: false }> {
  return !result.ok
}

/**
 * 脱敏：错误详情里不允许出现本机绝对路径、堆栈或疑似密钥的内容。
 *
 * 保留结构化信息（字段名、期望类型、行号等），把可能被当作路径 / 密钥的字符串折叠掉。
 */
export function redactDetails(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value

  if (typeof value === 'string') return redactString(value)

  if (typeof value === 'number' || typeof value === 'boolean') return value

  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) }
  }

  if (depth >= 6) return '[deep]'

  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redactDetails(item, depth + 1))

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSecretKey(key) ? '[redacted]' : redactDetails(item, depth + 1)
    }
    return out
  }

  return String(value)
}

const WINDOWS_PATH = /[a-zA-Z]:[\\/][^\s"']*/
const UNIX_HOME_PATH = /(?:\/home\/|\/Users\/|\/root\/)[^\s"']*/
const SECRET_KEY = /(password|passwd|secret|token|apikey|api_key|authorization|cookie|credential)/i

function isSecretKey(key: string): boolean {
  return SECRET_KEY.test(key)
}

function redactString(input: string): string {
  let text = input
  // 先抹掉堆栈，堆栈里几乎必然包含本机路径
  if (text.includes('\n    at ')) text = `${text.split('\n    at ')[0] ?? ''} [stack omitted]`
  text = text.replace(WINDOWS_PATH, '[path]').replace(UNIX_HOME_PATH, '[path]')
  return text.length > 500 ? `${text.slice(0, 500)}…` : text
}
