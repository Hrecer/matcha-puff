/**
 * 校验所有插件定义
 *
 * 检查项：ID / 版本格式、必填字段、Schema 存在性、名称重复、清单一致性、
 * 桌面元数据（图标 / 窗口 / 分类 / 界面组件）是否指向真实资源。
 * 有 error 级别问题时以非零码退出，便于放进 CI。
 */
import { readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRegistry } from '@matcha-puff/tool-runtime'
import type { ValidationIssue } from '@matcha-puff/tool-runtime'
import { builtinPlugins } from '../packages/tools/src/generated/tool-index.ts'

const here = dirname(fileURLToPath(import.meta.url))
const toolsRoot = resolve(here, '../packages/tools/src')
const viewsRoot = resolve(here, '../desktop/src/pages/tools')

async function collectViewExports(dir: string, found = new Map<string, string>()): Promise<Map<string, string>> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      await collectViewExports(path, found)
      continue
    }
    if (!entry.name.endsWith('.tsx')) continue
    const source = await readFile(path, 'utf8')
    for (const match of source.matchAll(/export (?:function|const) (\w+)/g)) {
      found.set(match[1]!, path)
    }
  }
  return found
}

async function main(): Promise<void> {
  const registry = createRegistry({ throwOnConflict: false })
  registry.registerAll(builtinPlugins)

  const issues: ValidationIssue[] = registry.validate()

  // 配套文件检查：manifest / schema / execute / 测试
  for (const plugin of builtinPlugins) {
    const target = join(toolsRoot, plugin.id)
    for (const file of ['manifest.ts', 'schema.ts', 'execute.ts', 'index.test.ts']) {
      if (!existsSync(join(target, file))) {
        issues.push({ level: 'warning', code: 'MISSING_FILE', message: `缺少 ${file}`, pluginId: plugin.id })
      }
    }
  }

  const categories = JSON.parse(
    await readFile(resolve(here, '../desktop/src/data/categories.json'), 'utf8'),
  ) as Array<{ id: number; code: string; parent_id: number }>
  const topCodes = new Set(categories.filter((item) => item.parent_id === 0).map((item) => item.code))
  const categoryByCode = new Map(categories.map((item) => [item.code, item]))
  const topCodeOf = (code: string): string | undefined => {
    const category = categoryByCode.get(code)
    if (!category) return undefined
    const top = category.parent_id === 0
      ? category
      : categories.find((item) => item.id === category.parent_id)
    return top?.code
  }

  const views = await collectViewExports(viewsRoot)
  const iconSource = await readFile(resolve(here, '../desktop/src/lib/plugin-tools.ts'), 'utf8')
  const iconSection = iconSource.slice(
    iconSource.indexOf('const ICON_COMPONENTS'),
    iconSource.indexOf('export function pluginIcon'),
  )

  const claimed = new Map<string, string>()
  for (const plugin of builtinPlugins) {
    if (!topCodes.has(plugin.category)) {
      issues.push({
        level: 'error',
        code: 'UNKNOWN_CATEGORY',
        message: `category「${plugin.category}」不在允许的顶层分类里`,
        pluginId: plugin.id,
      })
    }

    const desktop = plugin.desktop
    if (!desktop) {
      issues.push({
        level: 'error',
        code: 'MISSING_DESKTOP',
        message: '缺少 desktop 元数据（图标 / 窗口 / 分类 / 界面组件）',
        pluginId: plugin.id,
      })
    } else {
      if (!(desktop.window.width > 0 && desktop.window.height > 0)) {
        issues.push({ level: 'error', code: 'INVALID_WINDOW', message: '窗口尺寸必须为正数', pluginId: plugin.id })
      }
      if (!desktop.icon || !new RegExp(`\\b${desktop.icon}\\b`).test(iconSection)) {
        issues.push({
          level: 'error',
          code: 'UNKNOWN_ICON',
          message: `图标「${desktop.icon}」不在共享图标词表里`,
          pluginId: plugin.id,
        })
      }
      if (desktop.view && !views.has(desktop.view)) {
        issues.push({
          level: 'error',
          code: 'MISSING_VIEW',
          message: `界面组件「${desktop.view}」不存在`,
          pluginId: plugin.id,
        })
      }
      if (!desktop.view) {
        issues.push({
          level: 'warning',
          code: 'NO_VIEW',
          message: '未声明界面组件，工具窗口会显示「界面正在接入」',
          pluginId: plugin.id,
        })
      }
      if (desktop.categories.length === 0) {
        issues.push({ level: 'error', code: 'NO_CATEGORY', message: '未声明工具页子分类', pluginId: plugin.id })
      }
      for (const code of desktop.categories) {
        if (!categoryByCode.has(code)) {
          issues.push({
            level: 'error',
            code: 'UNKNOWN_SUBCATEGORY',
            message: `子分类「${code}」不存在`,
            pluginId: plugin.id,
          })
        }
      }
      const tops = desktop.categories.map(topCodeOf).filter(Boolean)
      if (tops.length > 0 && !tops.includes(plugin.category)) {
        issues.push({
          level: 'error',
          code: 'CATEGORY_MISMATCH',
          message: `desktop.categories（${tops.join('/')}）与 category「${plugin.category}」不一致`,
          pluginId: plugin.id,
        })
      }
    }

    for (const url of plugin.legacyUrls ?? []) {
      const owner = claimed.get(url)
      if (owner) {
        issues.push({
          level: 'error',
          code: 'DUPLICATE_LEGACY_URL',
          message: `工具 ${url} 同时被 ${owner} 与 ${plugin.id} 接管`,
          pluginId: plugin.id,
        })
      } else {
        claimed.set(url, plugin.id)
      }
    }
  }

  // 清单一致性
  try {
    const manifestRaw = await readFile(join(toolsRoot, 'generated/tool-manifest.json'), 'utf8')
    const listed = new Set<string>((JSON.parse(manifestRaw) as { tools: Array<{ id: string }> }).tools.map((t) => t.id))
    for (const plugin of builtinPlugins) {
      if (!listed.has(plugin.id)) {
        issues.push({
          level: 'error',
          code: 'STALE_MANIFEST',
          message: '工具未写入清单，请运行 plugin:index',
          pluginId: plugin.id,
        })
      }
    }
  } catch {
    issues.push({ level: 'warning', code: 'NO_MANIFEST', message: '未找到 generated/tool-manifest.json' })
  }

  const errors = issues.filter((issue) => issue.level === 'error')
  const warnings = issues.filter((issue) => issue.level === 'warning')

  console.log(`插件总数：${builtinPlugins.length}`)
  for (const issue of [...errors, ...warnings]) {
    console.log(`  [${issue.level}] ${issue.code} ${issue.pluginId ?? '-'}: ${issue.message}`)
  }

  if (errors.length > 0) {
    console.error(`\n校验未通过：${errors.length} 个错误`)
    process.exit(1)
  }
  console.log(`\n校验通过（${warnings.length} 个提示）`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
