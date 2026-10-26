import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'constellation',
  version: '1.0.0',
  name: '十二星座查询',
  description: '左侧完整列出十二星座与日期区间，可直接点选；也支持按出生日期查询，边界按传统分界（3 月 21 日白羊起）。',
  category: 'life',
  keywords: ['星座', '白羊座', '出生日期', '星座查询', 'constellation'],
  legacyUrls: ['life/query/constellation'],
  desktop: {
    icon: 'Star',
    window: { width: 700, height: 560 },
    categories: ['life-query'],
    view: 'ConstellationTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
