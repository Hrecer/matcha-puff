import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'screencheck',
  version: '1.0.0',
  name: '屏幕坏点检测',
  description: '在右侧选择任意颜色后进入全屏，用纯色检查显示器坏点、亮点与色斑，按 ESC 退出。',
  category: 'webmaster',
  keywords: ['屏幕', '坏点', '亮点', '显示器', '测试'],
  legacyUrls: ['webmaster/system/screencheck'],
  desktop: {
    icon: 'Monitor',
    window: { width: 700, height: 360 },
    categories: ['webmaster-system'],
    view: 'ScreenCheckTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
