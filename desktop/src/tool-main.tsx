import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/theme.css'
import './styles/global.css'
import { installWebviewGuards } from './lib/webview-guards'
import { NativeTitleTooltip } from './components/ui/native-title-tooltip'
import { TooltipProvider } from './components/ui/tooltip'
import { ToolWindow } from './windows/ToolWindow'

/**
 * 插件工具子窗口入口（tool.html）
 *
 * 生产由 Rust 建窗时注入 window.__MATCHA_TOOL_ID__；
 * 浏览器预览（5183）从 ?tool=<id> 读取，方便单独验收每个工具的界面。
 */
installWebviewGuards()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={700} skipDelayDuration={0}>
      <NativeTitleTooltip />
      <ToolWindow />
    </TooltipProvider>
  </React.StrictMode>,
)
