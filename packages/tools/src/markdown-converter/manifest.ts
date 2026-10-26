import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'markdown-converter',
  version: '1.0.0',
  name: 'Markdown编辑器',
  description: '把 Markdown 转成 HTML，并可同时提取标题大纲与字数统计。',
  category: 'reporter',
  keywords: ['markdown', 'md', 'html', '转换', 'convert'],
  legacyUrls: ['reporter/edit/markdown'],
  desktop: {
    icon: 'FileText',
    window: { width: 1040, height: 700 },
    categories: ['reporter-edit'],
    view: 'MarkdownConverterTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
