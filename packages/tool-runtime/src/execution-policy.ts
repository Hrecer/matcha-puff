export interface ExecutionPolicy {
  /** 单次执行的时间上限（毫秒）；0 表示不限制 */
  timeoutMs: number
  /** 输入序列化后的最大字节数 */
  maxInputBytes: number
  /** 输出序列化后的最大字节数 */
  maxOutputBytes: number
}

export const DEFAULT_EXECUTION_POLICY: ExecutionPolicy = {
  timeoutMs: 10_000,
  maxInputBytes: 2 * 1024 * 1024,
  maxOutputBytes: 2 * 1024 * 1024,
}

export function resolvePolicyLimits(overrides?: Partial<ExecutionPolicy>): ExecutionPolicy {
  return { ...DEFAULT_EXECUTION_POLICY, ...overrides }
}

export function measureBytes(value: unknown): number {
  if (typeof value === 'string') return value.length * 2
  try {
    return JSON.stringify(value)?.length ?? 0
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

export interface Deadline {
  signal: AbortSignal
  timedOut: () => boolean
  dispose: () => void
}

/**
 * 把外部取消信号与超时合并成一个 AbortSignal。
 *
 * 工具内部通过 context.signal 感知取消，ToolCancelledError 由 guardExecution 转成
 * EXECUTION_CANCELLED；外部超时则落到 EXECUTION_TIMEOUT。
 */
export function createDeadline(timeoutMs: number, external?: AbortSignal): Deadline {
  const controller = new AbortController()
  let timedOut = false

  const timer = timeoutMs > 0 ? setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs) : undefined

  const onExternalAbort = () => controller.abort()
  if (external) {
    if (external.aborted) controller.abort()
    else external.addEventListener('abort', onExternalAbort, { once: true })
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      if (timer) clearTimeout(timer)
      if (external) external.removeEventListener('abort', onExternalAbort)
    },
  }
}

/** 等一段时间后 reject，用于给非中断型任务兜底超时 */
export function withTimeout<T>(work: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  if (timeoutMs <= 0) return work

  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`Execution timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    const onAbort = () => {
      cleanup()
      reject(new Error('Execution cancelled'))
    }

    function cleanup() {
      clearTimeout(timer)
      if (signal) signal.removeEventListener('abort', onAbort)
    }

    if (signal) {
      if (signal.aborted) {
        onAbort()
        return
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    work.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error) => {
        cleanup()
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}
