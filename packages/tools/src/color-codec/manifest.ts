import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'color-codec',
  version: '1.0.0',
  name: '颜色转换',
  description: 'RGB 与 #RRGGBB 颜色值双向转换，支持三位缩写十六进制。',
  category: 'design',
  keywords: ['rgb', 'hex', '十六进制', '颜色', '色值'],
  legacyUrls: ['designer/color/rgbtohex'],
  desktop: {
    icon: 'Palette',
    window: { width: 780, height: 620 },
    categories: ['design-color'],
    view: 'ColorCodecTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
