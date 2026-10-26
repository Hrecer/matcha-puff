import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'color-select',
  version: '1.0.0',
  name: '颜色选择器',
  description: '拖动饱和度/明度方块与色相条取色，或直接输入 HEX / RGB / HSL，一键复制当前颜色。',
  category: 'design',
  keywords: ['颜色', '取色', 'HEX', 'RGB', 'HSL', 'CMYK', '对比度', 'color'],
  legacyUrls: ['designer/color/colorselect'],
  desktop: {
    icon: 'Palette',
    window: { width: 460, height: 620 },
    categories: ['design-color'],
    view: 'ColorSelectTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
