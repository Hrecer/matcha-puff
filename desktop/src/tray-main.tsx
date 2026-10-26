import React from 'react'
import ReactDOM from 'react-dom/client'
import { TrayMenu } from './windows/TrayMenu'
import './styles/theme.css'
import './styles/global.css'
import { installWebviewGuards } from './lib/webview-guards'

// 托盘菜单窗口入口（tray.html）：只渲染菜单，不走路由
installWebviewGuards()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TrayMenu />
  </React.StrictMode>,
)
