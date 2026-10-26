import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'text-diff',
  version: '1.0.0',
  name: '文本对比工具',
  description: '按行、词或字符比较两段文本的差异，输出可读的增删统计与差异片段。',
  category: 'coding',
  keywords: ['diff', '差异', '对比', '比较', '文本'],
  legacyUrls: ['programmer/coding/textdiff'],
  desktop: {
    icon: 'GitCompare',
    window: { width: 1080, height: 720 },
    categories: ['coding-code'],
    view: 'TextDiffTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
