/**
 * WebView 全局行为修正（每个入口装一次）。
 *
 * 1. 焦点环只在「键盘 Tab 导航」时出现
 *    Chromium 的 `:focus-visible` 会在一堆非键盘场景下误触发：按下 Shift / Ctrl / Alt、
 *    鼠标按住按钮不松手再敲修饰键、窗口程序化聚焦…… 表现就是按钮突然多出一圈描边。
 *    这里不再猜测浏览器的判定，改为自己认定：只有按 Tab 才算键盘导航，
 *    按下鼠标立即退出该状态。CSS 侧据此决定要不要画焦点环。
 *
 * 2. 原生右键菜单屏蔽
 *    WebView2 会在网页没有阻止 `contextmenu` 时弹出浏览器菜单（返回 / 刷新 /
 *    另存为 / 打印），在桌面应用里非常突兀。这里统一拦掉，粘贴改用 Ctrl+V。
 */
const KEYBOARD_NAV_CLASS = 'keyboard-nav'
const INSTALLED_FLAG = '__matchaWebviewGuardsInstalled'

export function installWebviewGuards(): void {
  if (typeof window === 'undefined') return
  const flags = window as unknown as Record<string, boolean>
  if (flags[INSTALLED_FLAG]) return
  flags[INSTALLED_FLAG] = true

  installFocusRingPolicy()
  installContextMenuBlock()
}

function installFocusRingPolicy(): void {
  const root = document.documentElement
  const enterKeyboardNav = (): void => root.classList.add(KEYBOARD_NAV_CLASS)
  const exitKeyboardNav = (): void => root.classList.remove(KEYBOARD_NAV_CLASS)

  window.addEventListener(
    'keydown',
    (event) => {
      // 只有 Tab（含 Shift+Tab 反向导航）才进入键盘导航态
      if (event.key === 'Tab') enterKeyboardNav()
    },
    true,
  )
  // 任何鼠标按下都立刻退出：包括「按住按钮再敲 Shift」这种组合
  window.addEventListener('mousedown', exitKeyboardNav, true)
  window.addEventListener('pointerdown', exitKeyboardNav, true)
  window.addEventListener('blur', exitKeyboardNav)
}

function installContextMenuBlock(): void {
  // 捕获阶段拦截：任何组件都不该把 WebView2 的原生菜单放出来
  window.addEventListener(
    'contextmenu',
    (event) => {
      event.preventDefault()
    },
    true,
  )
}
