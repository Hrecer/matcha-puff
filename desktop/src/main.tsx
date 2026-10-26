import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
// 设计令牌与全局样式（工具窗口同样复用）
import './styles/theme.css'
import './styles/global.css'
import { installWebviewGuards } from './lib/webview-guards'
import { MainWindow } from './windows/MainWindow'
import { NativeTitleTooltip } from './components/ui/native-title-tooltip'
import { TooltipProvider } from './components/ui/tooltip'

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('APP_ERROR', error)
  }

  render() {
    if (this.state.error) {
      return (
        <pre style={{ whiteSpace: 'pre-wrap', padding: 24, fontFamily: 'monospace', fontSize: 12 }}>
          {this.state.error.stack || this.state.error.message}
        </pre>
      )
    }
    return this.props.children
  }
}

/**
 * 入口：主窗口
 *
 * 【为什么用 HashRouter 而不是 BrowserRouter】
 * 前端产物放在 /next/ 子目录，窗口地址是 /next/index.html。
 * history 模式下路由要从 pathname 里剥离 base 才能匹配，
 * 一旦 URL 形态变化（目录、带不带 .html）就会白屏；hash 路由把路径放在 `#` 后面，
 * 无论窗口地址是什么都能正确匹配，最不容易出问题。
 *
 * 【搜索窗去哪了】独立搜索浮窗已删除，能力并入工作台。
 */
installWebviewGuards()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <HashRouter>
        <TooltipProvider delayDuration={700} skipDelayDuration={0}>
          <NativeTitleTooltip />
          <MainWindow />
        </TooltipProvider>
      </HashRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
)
