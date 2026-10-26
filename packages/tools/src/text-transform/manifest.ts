import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'text-transform',
  version: '1.0.0',
  name: '文本去重与批量替换',
  description: '按行去除重复内容，或对整段文本做字面 / 正则批量替换，并给出替换次数统计。',
  category: 'reporter',
  keywords: ['去重', '替换', 'replace', 'dedupe', '文本处理'],
  desktop: {
    icon: 'Replace',
    window: { width: 900, height: 680 },
    categories: ['reporter-edit'],
    view: 'TextTransformTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
