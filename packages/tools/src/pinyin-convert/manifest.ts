import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'pinyin-convert',
  version: '1.0.0',
  name: '中文转拼音',
  description: '把中文转成拼音：带声调、纯小写、首字母或多音字全列，可自定义分隔符。',
  category: 'reporter',
  keywords: ['拼音', '汉字', '首字母', '多音字', 'pinyin'],
  legacyUrls: ['reporter/chinesechar/simplified2pinyin'],
  desktop: {
    icon: 'Languages',
    window: { width: 980, height: 660 },
    categories: ['reporter-chinese-char'],
    view: 'PinyinConvertTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
