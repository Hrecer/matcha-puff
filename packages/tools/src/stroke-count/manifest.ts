import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'stroke-count',
  version: '1.0.0',
  name: '汉字查询笔画数',
  description: '统计整段中文的总笔画，并给出每个字的笔画数；非汉字会被跳过。',
  category: 'reporter',
  keywords: ['笔画', '汉字', '笔顺', 'stroke'],
  legacyUrls: ['reporter/chinesechar/querystroke'],
  desktop: {
    icon: 'Pencil',
    window: { width: 980, height: 660 },
    categories: ['reporter-chinese-char'],
    view: 'StrokeCountTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
