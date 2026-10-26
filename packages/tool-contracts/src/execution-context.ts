import type { ToolResult } from './tool-result'

/**
 * 调用方
 *
 * 目前只有界面一个入口。保留这个标记是为了让执行上下文和日志能区分来源，
 * 权限判断不再按调用方分支 —— 能在界面执行就是唯一标准。
 */
export const TOOL_CALLERS = ['ui'] as const
export type ToolCaller = (typeof TOOL_CALLERS)[number]

export function isToolCaller(value: unknown): value is ToolCaller {
  return typeof value === 'string' && (TOOL_CALLERS as readonly string[]).includes(value)
}

export interface ToolLogMeta {
  [key: string]: unknown
}

/** 受控日志：禁止工具自行 console.*，便于统一控制输出目标与脱敏 */
export interface ToolLogger {
  debug(message: string, meta?: ToolLogMeta): void
  info(message: string, meta?: ToolLogMeta): void
  warn(message: string, meta?: ToolLogMeta): void
  error(message: string, meta?: ToolLogMeta): void
}

export interface ClipboardService {
  readText(): Promise<string | null>
  writeText(text: string): Promise<void>
}

export interface FileService {
  readText(path: string): Promise<string>
  writeText(path: string, content: string): Promise<void>
}

export interface HttpRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
}

export interface HttpResponse {
  status: number
  body: string
}

export interface HttpService {
  request(url: string, options?: HttpRequestOptions): Promise<HttpResponse>
}

/**
 * 按需注入的共享能力。
 *
 * 刻意不把整个 Tauri API、Node 运行时或不受限的系统能力塞进来：
 * 工具只能用到宿主明确提供的这些接口，纯计算类工具拿到的就是一个空对象。
 */
/** 图像处理操作：裁剪、缩放、圆角、水印与重编码 */
export interface ImageOps {
  crop?: { x: number; y: number; width: number; height: number }
  resize?: { width?: number; height?: number; scale?: number }
  round?: { radius: number }
  watermark?: {
    text: string
    fontSize?: number
    color?: string
    opacity?: number
    angle?: number
    gap?: number
  }
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number
}

export interface ImageInfo {
  width: number
  height: number
  /** 输入里的 MIME 类型，如 image/png */
  type: string
}

export interface ImagePixels {
  width: number
  height: number
  /** RGBA 四通道，长度 = width * height * 4 */
  data: Uint8ClampedArray | number[]
}

/**
 * 图像处理能力。
 *
 * 桌面端用 canvas 实现；没有注入这一层的宿主
 * 工具必须检查它是否存在并给出明确错误，而不是崩溃。
 */
export interface ImageService {
  info(dataUrl: string): Promise<ImageInfo>
  transform(dataUrl: string, ops: ImageOps): Promise<string>
  /**
   * 采样像素（取色类工具用）。宿主可先降采样再返回，
   * maxDimension 控制长边像素数，默认由宿主决定。
   */
  pixels?(dataUrl: string, options?: { maxDimension?: number }): Promise<ImagePixels>
}

/**
 * 工具私有的键值存储。
 *
 * 桌面端落 localStorage；不注入这一层的宿主
 * 有状态的工具必须检查它是否存在，并给出「这个宿主不支持保存」而不是崩溃。
 */
export interface StorageService {
  get<T>(key: string): Promise<T | null>
  set(key: string, value: unknown): Promise<void>
  remove(key: string): Promise<void>
}

export interface ToolServices {
  clipboard?: ClipboardService
  file?: FileService
  http?: HttpService
  image?: ImageService
  storage?: StorageService
  /** 可注入的时间源，便于测试固定时间相关的行为 */
  now?: () => number
}

export interface ToolExecutionContext {
  readonly toolId: string
  readonly caller: ToolCaller
  readonly requestId: string
  readonly logger: ToolLogger
  readonly services: ToolServices
  readonly signal?: AbortSignal
  readonly locale?: string
}

export class ToolCancelledError extends Error {
  constructor(message = 'Execution cancelled') {
    super(message)
    this.name = 'ToolCancelledError'
  }
}

export class ToolTimeoutError extends Error {
  constructor(message = 'Execution timed out') {
    super(message)
    this.name = 'ToolTimeoutError'
  }
}

/** 长任务应在循环中调用它，让取消 / 超时有机会中断执行 */
export function throwIfAborted(context: ToolExecutionContext): void {
  if (context.signal?.aborted) throw new ToolCancelledError()
}

const SILENT_LOGGER: ToolLogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

export interface CreateContextOptions {
  toolId: string
  caller: ToolCaller
  requestId?: string
  logger?: ToolLogger
  services?: ToolServices
  signal?: AbortSignal
  locale?: string
}

let sequence = 0

export function createExecutionContext(options: CreateContextOptions): ToolExecutionContext {
  sequence += 1
  return {
    toolId: options.toolId,
    caller: options.caller,
    requestId: options.requestId ?? `req_${Date.now().toString(36)}_${sequence.toString(36)}`,
    logger: options.logger ?? SILENT_LOGGER,
    services: options.services ?? {},
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.locale ? { locale: options.locale } : {}),
  }
}

/** 把工具的返回值收敛成 ToolResult，避免未捕获异常穿透到调用方 */
export async function guardExecution<T>(
  fn: () => Promise<ToolResult<T>> | ToolResult<T>,
): Promise<ToolResult<T>> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof ToolCancelledError) {
      return { ok: false, error: { code: 'EXECUTION_CANCELLED', message: '执行已取消' } }
    }
    if (error instanceof ToolTimeoutError) {
      return { ok: false, error: { code: 'EXECUTION_TIMEOUT', message: '执行超时' } }
    }
    return {
      ok: false,
      error: {
        code: 'EXECUTION_FAILED',
        message: error instanceof Error ? error.message : '执行失败',
      },
    }
  }
}
