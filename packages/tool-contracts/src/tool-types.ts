import type { ZodType } from 'zod'
import type { ToolExecutionContext } from './execution-context'
import type { ToolResult } from './tool-result'

/**
 * 插件的两种控制项
 *
 * 它们是彼此独立的开关：
 *   enabled     —— 是否可执行（总闸）
 *   uiEnabled   —— 是否在界面中出现
 *
 * 「隐藏」不等于「关闭」：隐藏只影响界面是否展示与能否从界面调用，
 * 插件本身的默认策略不受影响，两个开关互不覆盖。
 */
export interface ToolPolicy {
  enabled: boolean
  uiEnabled: boolean
}

export const TOOL_SIDE_EFFECTS = [
  'none',
  'clipboard-write',
  'file-read',
  'file-write',
  'network-read',
  'network-write',
  'process',
] as const
export type ToolSideEffect = (typeof TOOL_SIDE_EFFECTS)[number]

/** 描述单个输入字段如何渲染；未声明的字段走通用推断 */
export interface ToolFieldMeta {
  label?: string
  placeholder?: string
  help?: string
  widget?: 'auto' | 'text' | 'textarea' | 'number' | 'switch' | 'select' | 'code'
  /** code 控件用：语言提示，如 json / markdown */
  language?: string
  rows?: number
  /** 长文本是否默认全宽一行显示 */
  fullWidth?: boolean
}

export type ToolResultKind = 'auto' | 'text' | 'json' | 'diff' | 'table'

/**
 * 表单与结果的展示元数据
 *
 * 键名用 string 而不是 keyof TInput：插件需要能被统一收纳进 AnyToolPlugin，
 * 带输入泛型的键名会让它无法赋值。字段名是否与 inputSchema 一致，
 * 由 `pnpm plugin:validate` 在校验阶段检查。
 */
export interface ToolUiMeta {
  fields?: Record<string, ToolFieldMeta>
  /** 表单字段顺序；未列出的排在后面 */
  order?: string[]
  /** 结果的推荐展示方式 */
  resultAs?: ToolResultKind
}

export interface ToolDesktopMeta {
  /** Lucide 图标导出名，由桌面端解析 */
  icon: string
  /** 独立工具窗口的设计尺寸 */
  window: { width: number; height: number }
  /** 工具页子分类 code，第一个为主分类 */
  categories: string[]
  /** 界面组件导出名；缺省表示界面尚未接入 */
  view?: string
}

export interface ToolManifest {
  id: string
  version: string
  name: string
  description: string
  category: string
  keywords?: string[]
  desktop?: ToolDesktopMeta
  legacyUrls?: string[]
  defaultPolicy: ToolPolicy
  sideEffects?: ToolSideEffect[]
}

/**
 * 一个工具的完整定义：身份、Schema、策略与执行入口。
 *
 * 名称、描述、ID、参数 Schema、返回类型和权限声明只在这里维护一份，
 * 工具导航、详情页元数据、AI 工具清单、文档与测试 Schema 全部由它派生。
 */
export interface ToolPlugin<TInput, TOutput> extends ToolManifest {
  inputSchema: ZodType<TInput>
  outputSchema: ZodType<TOutput>
  ui?: ToolUiMeta
  execute(
    input: TInput,
    context: ToolExecutionContext,
  ): Promise<ToolResult<TOutput>> | ToolResult<TOutput>
}

/**
 * 任意工具的公共类型。
 *
 * 这里刻意不写 any：把它声明为 unknown 即可收纳所有具体插件
 * —— execute 是方法语法，参数按双变处理，因此 ToolPlugin<Foo, Bar> 可以赋给 ToolPlugin<unknown, unknown>。
 */
export type AnyToolPlugin = ToolPlugin<unknown, unknown>

/** 保留输入输出类型推导的工厂函数 */
export function defineTool<TInput, TOutput>(plugin: ToolPlugin<TInput, TOutput>): ToolPlugin<TInput, TOutput> {
  return plugin
}

export type ToolMetadata = Pick<
  ToolManifest,
  'id' | 'version' | 'name' | 'description' | 'category'
> & {
  keywords: string[]
  legacyUrls: string[]
  desktop?: ToolDesktopMeta
  sideEffects: ToolSideEffect[]
  defaultPolicy: ToolPolicy
  hasCustomView: boolean
  ui?: ToolUiMeta
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

export function isValidToolId(id: string): boolean {
  return ID_PATTERN.test(id) && id.length <= 64
}

export function isValidVersion(version: string): boolean {
  return VERSION_PATTERN.test(version)
}

/** 取出工具的元数据视图（给导航、AI 清单复用） */
export function toToolMetadata(plugin: AnyToolPlugin): ToolMetadata {
  return {
    id: plugin.id,
    version: plugin.version,
    name: plugin.name,
    description: plugin.description,
    category: plugin.category,
    keywords: plugin.keywords ?? [],
    legacyUrls: plugin.legacyUrls ?? [],
    ...(plugin.desktop ? { desktop: plugin.desktop } : {}),
    sideEffects: plugin.sideEffects ?? ['none'],
    defaultPolicy: plugin.defaultPolicy,
    hasCustomView: false,
    ...(plugin.ui ? { ui: plugin.ui } : {}),
  }
}
