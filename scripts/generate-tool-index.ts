/**
 * 生成内置工具清单
 *
 * 新增一个插件目录（含 index.ts）后运行 `npm run plugin:index`，
 * 注册代码会自动更新 —— 不需要在多个文件里手工添加 import。
 *
 * 产物：
 *   packages/tools/src/generated/tool-index.ts      运行时引用
 *   packages/tools/src/generated/tool-manifest.json 静态清单（文档与排查用）
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const toolsRoot = resolve(here, '../packages/tools/src')
const outputDir = join(toolsRoot, 'generated')

const SKIP = new Set(['generated', 'shared'])

interface Discovered {
  dir: string
  exportName: string
  id: string
  name: string
  version: string
  category: string
  description: string
}

async function discover(): Promise<Discovered[]> {
  const entries = await readdir(toolsRoot, { withFileTypes: true })
  const found: Discovered[] = []

  for (const entry of entries) {
    if (!entry.isDirectory() || SKIP.has(entry.name)) continue
    const indexPath = join(toolsRoot, entry.name, 'index.ts')
    let source: string
    try {
      source = await readFile(indexPath, 'utf8')
    } catch {
      continue
    }

    const exported = /export const (\w+)\s*=\s*defineTool/.exec(source)
    if (!exported?.[1]) {
      console.warn(`[skip] ${entry.name}：未在 index.ts 中找到 \`export const X = defineTool(...)\``)
      continue
    }

    const manifestPath = join(toolsRoot, entry.name, 'manifest.ts')
    const manifestSource = await readFile(manifestPath, 'utf8').catch(() => '')
    const pick = (key: string): string => {
      const matched = new RegExp(`${key}:\\s*'([^']*)'`).exec(manifestSource)
      return matched?.[1] ?? ''
    }

    found.push({
      dir: entry.name,
      exportName: exported[1],
      id: pick('id'),
      name: pick('name'),
      version: pick('version'),
      category: pick('category'),
      description: pick('description'),
    })
  }

  return found.sort((a, b) => a.id.localeCompare(b.id))
}

async function main(): Promise<void> {
  const plugins = await discover()
  await mkdir(outputDir, { recursive: true })

  const imports = plugins.map((p) => `import { ${p.exportName} } from '../${p.dir}/index'`).join('\n')
  const items = plugins.map((p) => `  ${p.exportName}`).join(',\n')

  const indexSource = `// 由 scripts/generate-tool-index.ts 自动生成，请勿手工修改

${imports}

/** 内置工具插件清单（顺序按工具 ID 排序） */
export const builtinPlugins = [
${items}
]

export const builtinPluginIds = builtinPlugins.map((plugin) => plugin.id)
`

  await writeFile(join(outputDir, 'tool-index.ts'), indexSource, 'utf8')

  const exportsSource = `// 由 scripts/generate-tool-index.ts 自动生成，请勿手工修改

${plugins.map((p) => `export { ${p.exportName} } from '../${p.dir}/index'`).join('\n')}
`

  await writeFile(join(outputDir, 'tool-exports.ts'), exportsSource, 'utf8')

  await writeFile(
    join(outputDir, 'tool-manifest.json'),
    `${JSON.stringify(
      {
        count: plugins.length,
        tools: plugins.map(({ dir, exportName, ...rest }) => rest),
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  console.log(`已生成 ${plugins.length} 个工具的注册清单：`)
  for (const plugin of plugins) console.log(`  - ${plugin.id}  ${plugin.name} (${plugin.version})`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
