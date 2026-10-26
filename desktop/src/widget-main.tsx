import React from 'react'
import ReactDOM from 'react-dom/client'
import { FocusWidget } from './components/focus/FocusWidget'
import { NativeTitleTooltip } from './components/ui/native-title-tooltip'
import './styles/theme.css'
import './styles/global.css'
import { installWebviewGuards } from './lib/webview-guards'

// 桌面专注挂件窗口入口（widget.html）：只渲染浮窗，不走路由
installWebviewGuards()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* 与主窗、工具窗同一套提示：title 一律换成奶油风浮层，不出现系统黑底提示 */}
    <NativeTitleTooltip />
    <FocusWidget />
  </React.StrictMode>,
)
