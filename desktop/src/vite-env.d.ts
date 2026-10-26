/// <reference types="vite/client" />

interface Window {
  /** 工具子窗口的插件 ID：由 Rust 建窗时注入（浏览器预览从 ?tool= 读取） */
  __MATCHA_TOOL_ID__?: string
}

/** 编译期注入的应用版本号，来源是 src-tauri/tauri.conf.json（见 vite.config.ts） */
declare const __APP_VERSION__: string
