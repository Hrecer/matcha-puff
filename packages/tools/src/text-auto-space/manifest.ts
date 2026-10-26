import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'text-auto-space',
  version: '1.0.0',
  name: '中英文间加空格',
  description: '基于 pangu 完整排版规则：中文与英文、数字、标点、引号、括号、百分号之间自动补空格，也可把半角标点转全角。',
  category: 'reporter',
  keywords: ['中英文空格', '盘古之白', '排版', '标点', '全角', 'pangu'],
  legacyUrls: ['reporter/edit/textautospace'],
  desktop: {
    icon: 'AlignHorizontalSpaceAround',
    window: { width: 900, height: 620 },
    categories: ['reporter-edit'],
    view: 'TextAutoSpaceTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
