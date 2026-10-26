import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'char-lookup',
  version: '1.0.0',
  name: '笔画数查询汉字',
  description: '输入笔画数，列出这个笔画数的全部汉字，并可查单字的拼音与笔画。',
  category: 'reporter',
  keywords: ['汉字', '笔画', '查字', '字典', 'chinese'],
  legacyUrls: ['reporter/chinesechar/querychinesechar'],
  desktop: {
    icon: 'BookOpen',
    window: { width: 780, height: 640 },
    categories: ['reporter-chinese-char'],
    view: 'CharLookupTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
