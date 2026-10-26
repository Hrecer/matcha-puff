
















type Label = string

declare global {
  interface Window {
    __TAURI_IPC__?: (message: Record<string, unknown>) => Promise<unknown>
    __TAURI_METADATA__?: { __currentWindow?: { label: string }; __windows?: { label: string }[] }
    [key: `_${number}`]: ((payload: unknown) => void) | undefined
  }
}

export const inTauri = (): boolean => typeof window.__TAURI_IPC__ === 'function'

const winLabel = (): Label =>
  window.__TAURI_METADATA__?.__currentWindow?.label ??
  (location.pathname.replace(/^\//, '').split('/')[0] || 'main')

let seq = 1
/** 回调 id → resolver。后端通过 window["_<id>"](payload) 回投结果 */
const pending = new Map<number, (value: unknown) => void>()

function registerCallback<T>(resolve: (v: T) => void, reject: (e: unknown) => void) {
  const id = seq++
  window[`_${id}` as `_${number}`] = (payload: unknown) => {
    delete window[`_${id}` as `_${number}`]
    pending.delete(id)
    resolve(payload as T)
  }
  // 后端出错时走 error 回调，这里复用同一 id 兜底超时
  pending.set(id, () => reject(new Error('ipc cancelled')))
  return id
}

/** 调用一个后端命令（对应 ipc.rs 里的 dispatch_command 分支） */
export async function invoke<T = unknown>(cmd: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!inTauri()) return mockInvoke<T>(cmd, payload)
  return new Promise<T>((resolve, reject) => {
    const callback = registerCallback<T>(resolve, reject)
    window.__TAURI_IPC__!({ cmd, callback, error: callback, ...payload })
  })
}

/** 调用一个后端模块（Window / Event / Http / Shell / Dialog / App …） */
export async function invokeModule<T = unknown>(
  module: string,
  message: Record<string, unknown>,
): Promise<T> {
  if (!inTauri()) return mockInvoke<T>(`${module}:${String(message.cmd)}`, message)
  return new Promise<T>((resolve, reject) => {
    const callback = registerCallback<T>(resolve, reject)
    window.__TAURI_IPC__!({
      cmd: 'tauri',
      __tauriModule: module,
      message,
      callback,
      error: callback,
    })
  })
}

// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------

type WinCmd = 'hide' | 'show' | 'close' | 'setFocus' | 'minimize' | 'toggleMaximize' | 'startDragging'

export function windowCmd(type: WinCmd, label: Label = winLabel()) {
  return invokeModule('Window', { cmd: 'manage', data: { label, cmd: { type } } })
}


export const hideWindow = (label?: Label) => windowCmd('hide', label)
/** 显示主窗口 */
export const showMain = () => windowCmd('show', 'main')
export const focusWindow = (label?: Label) => windowCmd('setFocus', label)
export const minimizeWindow = () => windowCmd('minimize')
export const toggleMaximize = () => windowCmd('toggleMaximize')
export const startDragging = () => windowCmd('startDragging')

export type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

/** 无边框窗口没有原生缩放边，由前端边缘热区调用系统缩放 */
export const startResizeDragging = (direction: ResizeDirection) =>
  invokeModule('Window', {
    cmd: 'manage',
    data: { label: winLabel(), cmd: { type: 'startResizeDragging', direction } },
  })

export const isVisible = () =>
  invokeModule<boolean>('Window', { cmd: 'manage', data: { label: winLabel(), cmd: { type: 'isVisible' } } })


export const isMaximized = () =>
  invokeModule<boolean>('Window', { cmd: 'manage', data: { label: winLabel(), cmd: { type: 'isMaximized' } } })

// ---------------------------------------------------------------------------
// 事件（后端 emit → window["_<handler>"]）
// ---------------------------------------------------------------------------

const listeners = new Map<string, Set<(payload: unknown) => void>>()

/** 监听后端事件；返回取消订阅函数 */
export function listen<T = unknown>(event: string, cb: (payload: T) => void): () => void {
  if (!inTauri()) {
    if (!listeners.has(event)) listeners.set(event, new Set())
    listeners.get(event)!.add(cb as (p: unknown) => void)
    return () => listeners.get(event)?.delete(cb as (p: unknown) => void)
  }
  const id = seq++
  window[`_${id}` as `_${number}`] = (payload) => cb(payload as T)
  invokeModule('Event', { cmd: 'listen', event, windowLabel: winLabel(), handler: id }).catch(() => {})
  return () => {
    delete window[`_${id}` as `_${number}`]
    invokeModule('Event', { cmd: 'unlisten', event, eventId: id }).catch(() => {})
  }
}

/** 主动向后端/其他窗口发送事件（后端会把 payload 原样投给监听者） */
export const emit = (event: string, payload: unknown, windowLabel: Label = winLabel()) =>
  invokeModule('Event', { cmd: 'emit', event, windowLabel, payload })

// ---------------------------------------------------------------------------
// 业务快捷方法（统一走 v1_ipc 信封）
// ---------------------------------------------------------------------------

export interface AppConf {
  /** 主题取值 system / light / dark；配置默认值为 auto，两者都接受 */
  theme: 'auto' | 'system' | 'light' | 'dark'
  startup: boolean
  /** 启动后主窗口落到的页面：index / favorites / focus */
  home_page: string
}

export const getConf = () => invoke<AppConf>('get_app_conf')
export const saveConf = (conf: AppConf) => invoke<AppConf>('set_app_conf', { data: conf })
export const getAppVersion = () => invokeModule<string>('App', { cmd: 'getAppVersion' })
export const searchCommandByCode = (code: string) => invoke<CommandItem[]>('search_command_by_code', { code })
/**
 * 读剪贴板（走宿主直连命令 read_clipboard）
 */
export const readClipboardText = () => invoke<string | null>('read_clipboard')

/** 按类型查搜索源（设置页用）：0=全部，2=官方搜索源，4=自定义搜索源 */
export const findSearchByType = (searchType: number) =>
  invoke<CommandItem[]>('find_search_by_type', { searchType })

/** 写剪贴板（走 Clipboard 模块：{ cmd:"writeText", data }） */
export const writeClipboardText = (data: string) =>
  invokeModule('Clipboard', { cmd: 'writeText', data })

export interface CommandItem {
  id: number
  type_id: number
  icon: string
  name: string
  description: string
  command: string
  code?: string
  color?: string
  /** 排序用（commands 表字段），设置页排序 tab 用它做上下移动 */
  weight?: number
  /** 是否启用（0/1），设置页的开关用 */
  state?: number
  /** 是否常驻搜索列表（1 = 搜索源，空搜索时展示） */
  always_show?: number
}

export interface Category {
  id: number
  code: string
  icon: string
  name: string
  parent_id: number
}

/** 直连命令（工具调用系统 shell 用） */
export const runShell = (program: string, args: string[]) =>
  invokeModule('Shell', { cmd: 'execute', program, args, options: {} })

export interface ShellResult {
  status: number | null
  stdout: string
  stderr: string
}

/** 等待进程结束并拿到输出（导出音频等需要确认完成的场景） */
export const runShellWait = (program: string, args: string[]) =>
  invokeModule<ShellResult>('Shell', {
    cmd: 'execute',
    program,
    args,
    options: { wait: true },
  })

/** 用系统默认方式打开链接/文件（走宿主 Shell 模块的 open） */
export const openExternal = (path: string) => invokeModule('Shell', { cmd: 'open', path })

// ---------------------------------------------------------------------------
// HTTP（走宿主 Http 模块）
// 信封：createClient → httpRequest → dropClient
// ---------------------------------------------------------------------------

const RESP_TEXT = 2 // responseType 枚举：JSON=1 / Text=2 / Binary=3

/**
 * 响应解码：请求一律按 Text 发出，**默认再 JSON.parse 一次**
 * （只有显式要 Text / Binary 才不解析）。宿主对 JSON 也返回字符串，
 * 所以这里必须解析，否则调用方拿到的是一段文本而不是对象。
 */
function decode<T>(data: unknown): T {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as T
    } catch {
      return data as unknown as T
    }
  }
  return data as T
}

async function withClient<T>(fn: (client: number) => Promise<T>): Promise<T> {
  const client = await invokeModule<number>('Http', { cmd: 'createClient', options: {} })
  try {
    return await fn(client)
  } finally {
    invokeModule('Http', { cmd: 'dropClient', client }).catch(() => {})
  }
}

export function httpGet<T = unknown>(url: string, headers?: Record<string, string>): Promise<T> {
  return withClient(async (client) => {
    const res = await invokeModule<{ status: number; data: T }>('Http', {
      cmd: 'httpRequest',
      client,
      options: { url, method: 'GET', headers: headers ?? {}, responseType: RESP_TEXT },
    })
    return decode<T>(res?.data)
  })
}

export function httpPostJson<T = unknown>(url: string, payload: unknown): Promise<T> {
  return withClient(async (client) => {
    const res = await invokeModule<{ status: number; data: T }>('Http', {
      cmd: 'httpRequest',
      client,
      options: {
        url,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: { type: 'Json', payload },
        responseType: RESP_TEXT,
      },
    })
    return decode<T>(res?.data)
  })
}

/** 浏览器预览用的 mock（只在没有 Tauri 宿主时生效） */

import commandsJson from '@/data/commands.json'

const mockConf: AppConf = {
  theme: 'auto',
  startup: false,
  home_page: 'index',
}

/**
 * 预览态的文档存储：pomo_doc_get / pomo_doc_set 在没有宿主时本来一律返回 null，
 * 专注模块读不到任何东西（任务表永远是空的）。这里让它落到 localStorage，
 * 预览时新建、编辑、拖拽的结果刷新后还在，和真机一致。
 */
const MOCK_DOC_PREFIX = 'matcha-puff/doc/'

/**
 * 内存兜底：有些预览环境会禁掉 localStorage（无源上下文、隐私模式、配额满），
 * 这时候 getItem / setItem 是**直接抛异常**的。读写一律容错，拿不到就退回这份
 * Map —— 最多是刷新后丢数据，绝不能让整个页面白屏。
 */
const memoryDocs = new Map<string, unknown>()

const mockDocRead = (key: string): unknown => {
  const id = MOCK_DOC_PREFIX + key
  try {
    const raw = localStorage.getItem(id)
    if (raw === null) return memoryDocs.get(id) ?? null
    return JSON.parse(raw) as unknown
  } catch {
    return memoryDocs.get(id) ?? null
  }
}

const mockDocWrite = (key: string, value: unknown): void => {
  const id = MOCK_DOC_PREFIX + key
  // 先存内存，保证下一帧一定读得到；再落盘，失败也不影响读写链路
  memoryDocs.set(id, value)
  try {
    localStorage.setItem(id, JSON.stringify(value))
  } catch {
    // 落盘失败就只留内存副本
  }
}

async function mockInvoke<T>(cmd: string, payload: Record<string, unknown>): Promise<T> {
  switch (cmd) {
    case 'get_app_conf':
      return mockConf as T
    case 'search_command_by_code': {
      // 与后端同口径：空搜索返回 state=1 且 always_show=1 的命令（即搜索源）
      const code = String(payload.code ?? '').toLowerCase()
      const cmds = (commandsJson as unknown as CommandItem[]).filter(
        (c) => c.state === 1 && c.always_show === 1,
      )
      if (!code) return cmds as T
      return cmds.filter(
        (c) =>
          c.name.toLowerCase().includes(code) ||
          c.command.toLowerCase().includes(code) ||
          (c.code ?? '').toLowerCase().includes(code),
      ) as T
    }
    case 'find_search_by_type': {
      // 设置页：0=排序用全部，其余按 type_id 过滤（与后端同一张 commands 表）
      const st = Number(payload.searchType ?? 0)
      const cmds = commandsJson as unknown as CommandItem[]
      return (st === 0 ? cmds : cmds.filter((c) => c.type_id === st)) as T
    }
    case 'read_clipboard':
      return null as T
    case 'pomo_doc_get':
      return mockDocRead(String(payload.key ?? '')) as T
    case 'pomo_doc_set':
      mockDocWrite(String(payload.key ?? ''), payload.value)
      return null as T
    case 'App:getAppVersion':
      // 浏览器预览拿不到 Tauri 的 App 模块，用编译期注入的版本号（与 tauri.conf.json 同源）
      return __APP_VERSION__ as T
    case 'Window:manage':
      return true as T
    default:
      return null as T
  }
}


// ---------------------------------------------------------------------------
// 文件对话框与写文件（走宿主 Dialog / Fs 模块）
// ---------------------------------------------------------------------------

export interface DialogOptions {
  title?: string
  filters?: { name: string; extensions: string[] }[]
  defaultPath?: string
}

/** 弹出保存对话框，返回选中的路径；取消时返回 null */
export const saveDialog = (options: DialogOptions = {}) =>
  invokeModule<string | null>('Dialog', { cmd: 'saveDialog', options })

/** 弹出打开对话框，返回选中的路径；取消时返回 null */
export const openDialog = (options: DialogOptions & { multiple?: boolean; directory?: boolean } = {}) =>
  invokeModule<string | null | string[]>('Dialog', { cmd: 'openDialog', options })

/** 把字节写到指定路径（宿主 Fs.writeFile 只收 number[]） */
export const writeFileBytes = (path: string, bytes: number[]) =>
  invokeModule('Fs', { cmd: 'writeFile', path, contents: bytes })

export const createDirectory = (path: string) =>
  invokeModule('Fs', { cmd: 'createDir', path })

export const fileExists = (path: string) =>
  invokeModule<boolean>('Fs', { cmd: 'exists', path })

export const readFileBase64 = (path: string) =>
  invokeModule<string>('Fs', { cmd: 'readFile', path })

export const pathJoin = (...paths: string[]) =>
  invokeModule<string>('Path', { cmd: 'join', paths })
