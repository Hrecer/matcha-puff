import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'special-symbols',
  version: '1.0.0',
  name: '特殊符号',
  description: '下标上标、货币、箭头、图形、办公等 31 组共 2059 个特殊符号，支持分组与关键词查找。',
  category: 'life',
  keywords: ['特殊符号', '符号', '箭头', '打勾', '上标', '下标', 'symbols'],
  legacyUrls: ['life/recreation/specialsymbols'],
  desktop: {
    icon: 'Shapes',
    window: { width: 900, height: 660 },
    categories: ['life-recreation'],
    view: 'SpecialSymbolsTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
