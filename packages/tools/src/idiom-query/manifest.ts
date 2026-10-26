import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'idiom-query',
  version: '1.0.0',
  name: '成语接龙小助手',
  description: '30741 条汉语成语：支持汉字包含/开头/结尾与拼音检索，可按字数筛选、随机抽一条并分页加载。',
  category: 'life',
  keywords: ['成语', '词典', '汉语', '四字词', 'idiom'],
  legacyUrls: ['life/recreation/queryidiom'],
  desktop: {
    icon: 'BookText',
    window: { width: 720, height: 620 },
    categories: ['life-recreation'],
    view: 'IdiomQueryTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
