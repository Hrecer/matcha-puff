import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * 抹茶泡芙 · 前端构建配置
 *
 * 三个入口，对应 Rust 侧的窗口：
 *  - index.html   主窗口（Rust: WebviewUrl::App("next/index.html")）
 *  - tool.html    插件工具子窗口（Rust: WebviewUrl::App("next/tool.html")，工具 ID 由注入脚本给出）
 *  - tray.html    托盘右键菜单浮窗（Rust: WebviewUrl::App("next/tray.html")）
 *
 * 【产物目录】
 * frontendDist 为 `../frontend`，其中只保留 `next/`（全部界面入口）：
 *   - 主窗口 → /next/index.html
 *   - 工具窗口 → /next/tool.html
 *   - 托盘菜单 → /next/tray.html
 *
 * 输出目录只有一个：`../frontend/next`。
 * Tauri 的 frontendDist 指向 `../frontend`，所有窗口入口都在 `next/` 下，
 * 因此不再有第二个输出目录 —— 以前 `vite build`（不带 mode）会写到 `dist-self`，
 * 和 `frontend/next` 内容完全重复，已经彻底去掉。
 */
export default defineConfig(() => {
  // 版本号唯一来源：src-tauri/tauri.conf.json 的 version。
  // 注入成编译期常量，界面与「浏览器预览」的兜底值都用它，不会再出现两处不一致。
  const appVersion = JSON.parse(
    readFileSync(resolve(__dirname, 'src-tauri/tauri.conf.json'), 'utf8'),
  ).version as string
  return {
    base: '/next/',
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
    },
    // Tailwind CSS 4 走官方 Vite 插件
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: [
        { find: '@', replacement: resolve(__dirname, 'src') },
        // monaco 0.57 的 exports 映射会把 esm/vs 子路径重复拼接，显式指到真实文件
        {
          find: /^monaco-editor\/esm\/vs/,
          replacement: resolve(__dirname, 'node_modules/monaco-editor/esm/vs'),
        },
      ],
    },
    build: {
      target: 'esnext',
      outDir: resolve(__dirname, 'frontend/next'),
      emptyOutDir: true,
      chunkSizeWarningLimit: 4096,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'index.html'),
          tool: resolve(__dirname, 'tool.html'),
          tray: resolve(__dirname, 'tray.html'),
          widget: resolve(__dirname, 'widget.html'),
        },
      },
    },
    optimizeDeps: {
      // 依赖里存在现代语法，预打包按 esnext 处理
      esbuildOptions: { target: 'esnext' },
      // monaco 的 ?worker 子路径交给 Vite 直接处理，预打包会生成 404 的 deps URL
      exclude: ['monaco-editor', '@monaco-editor/react'],
    },
    server: {
      port: 5183,
      strictPort: true,
      // 运行中的 exe 会锁住 src-tauri/target/.../EBWebView 缓存；
      // 监听它会让 Vite 在 Windows 上直接 EBUSY 崩溃（实测）。
      watch: { ignored: ['**/src-tauri/**', '**/frontend/**'] },
    },
  }
})
