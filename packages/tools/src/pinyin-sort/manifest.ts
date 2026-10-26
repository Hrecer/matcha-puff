import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'pinyin-sort',
  version: '1.0.0',
  name: '拼音排序字符串',
  description: '把多行文本按拼音或笔画排序，中英混排也能用。',
  category: 'reporter',
  keywords: ['拼音排序', '笔画排序', '排序', 'sort'],
  legacyUrls: ['reporter/chinesechar/sortpinyin'],
  desktop: {
    icon: 'ArrowDownAZ',
    window: { width: 980, height: 660 },
    categories: ['reporter-chinese-char'],
    view: 'PinyinSortTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
