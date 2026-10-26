/**
 * 错误码 → 人话映射（设计契约 §5）
 *
 * UI 不把原始错误直接抛给用户：先按稳定错误码翻译成可读原因 + 可操作建议；
 * message 保留展示（已由内核脱敏），但版式以这里的文案为主。
 */
import type { ToolErrorCode } from '@matcha-puff/tool-contracts'

export interface ErrorCopy {
  /** 一句话原因 */
  title: string
  /** 可操作建议 */
  hint: string
}

export const ERROR_COPY: Record<ToolErrorCode, ErrorCopy> = {
  TOOL_NOT_FOUND: {
    title: '工具不存在',
    hint: '它可能已被移除或改名，试试重新搜索。',
  },
  TOOL_DISABLED: {
    title: '该工具已停用',
    hint: '可在侧栏「插件中心」中重新启用。',
  },
  CALLER_NOT_ALLOWED: {
    title: '当前入口不允许调用此工具',
    hint: '该工具限制了可用入口，可在插件的权限设置里调整。',
  },
  INVALID_INPUT: {
    title: '输入不符合要求',
    hint: '请检查各参数的格式与必填项后重试。',
  },
  INVALID_OUTPUT: {
    title: '工具返回了无效结果',
    hint: '这是工具本身的问题，可以尝试更新或反馈给作者。',
  },
  EXECUTION_FAILED: {
    title: '执行失败',
    hint: '请检查输入内容；若持续失败，可反馈给工具作者。',
  },
  EXECUTION_TIMEOUT: {
    title: '执行超时',
    hint: '输入可能过大，尝试减少内容后重试。',
  },
  EXECUTION_CANCELLED: {
    title: '执行已取消',
    hint: '结果不可用，可重新执行。',
  },
}

/** 兜底：未知码也不至于白屏 */
export function errorCopy(code: string | undefined): ErrorCopy {
  if (code && code in ERROR_COPY) return ERROR_COPY[code as ToolErrorCode]
  return {
    title: '出了点问题',
    hint: '请重试；若持续出现，请反馈。',
  }
}
