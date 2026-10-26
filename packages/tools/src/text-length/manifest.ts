import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'text-length',
  version: '1.0.0',
  name: '字符串长度计算',
  description: '统计字符数、码点数、UTF-8 字节数、行数、单词数与中文字数。',
  category: 'reporter',
  keywords: ['长度', '字符', '字节', '行数', '字数', '统计'],
  legacyUrls: ['reporter/edit/textcount'],
  desktop: {
    icon: 'Ruler',
    window: { width: 700, height: 560 },
    categories: ['reporter-edit'],
    view: 'TextLengthTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
