import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'color-list',
  version: '1.0.0',
  name: '超多配色',
  description: '1741 个常用颜色（中国传统色、日本传统色、Material Design、Flat UI、WEB 安全色），点色块在右侧调色板里细调并复制。',
  category: 'design',
  keywords: ['颜色', '色板', '中国传统色', '取色', 'hex', 'palette'],
  legacyUrls: ['designer/color/colorlist'],
  desktop: {
    icon: 'Palette',
    window: { width: 1024, height: 640 },
    categories: ['design-color'],
    view: 'ColorListTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
