import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'getcolorthief',
  version: '1.0.0',
  name: '图片生成色卡',
  description: '从图片里提取主色与配色板（MMCQ 中位切分量化），给出十六进制与 RGB 值。',
  category: 'design',
  keywords: ['取色', '主色', '配色', '色板', 'colorthief'],
  legacyUrls: ['designer/color/getcolorthief'],
  desktop: {
    icon: 'Pipette',
    window: { width: 940, height: 680 },
    categories: ['design-color'],
    view: 'ColorThiefTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
