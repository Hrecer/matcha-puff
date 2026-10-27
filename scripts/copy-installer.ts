import { copyFileSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** 把本次构建的 NSIS 安装包复制到固定位置：工作区根目录（仓库的上一级）。 */
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(repoRoot, '..')

const config = JSON.parse(
  readFileSync(join(repoRoot, 'desktop', 'src-tauri', 'tauri.conf.json'), 'utf8'),
) as { productName: string; version: string }

const bundleDir = join(repoRoot, 'desktop', 'src-tauri', 'target', 'release', 'bundle', 'nsis')
const sourceName = `${config.productName}_${config.version}_x64-setup.exe`
const source = join(bundleDir, sourceName)
const fileName = `matcha-puff_${config.version}_x64-setup.exe`

if (!existsSync(source)) {
  const existing = existsSync(bundleDir)
    ? readdirSync(bundleDir).filter((name) => name.endsWith('_x64-setup.exe'))
    : []
  throw new Error(
    `未找到 ${config.version} 的安装包：${source}` +
      (existing.length > 0 ? `\n目录内现有：${existing.join('、')}` : ''),
  )
}

const destination = join(workspaceRoot, fileName)
copyFileSync(source, destination)
console.log(`安装包已复制到工作区根目录：${destination}`)
