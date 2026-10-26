import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'char-stroke-order',
  version: '1.0.0',
  name: '汉字笔顺查询',
  description: '查汉字笔顺，并用 cnchar.draw 演示笔顺步骤、循环动画或描写练习；同时列出笔画名称与总笔画数。',
  category: 'life',
  keywords: ['笔顺', '笔画', '写字', '汉字', 'stroke order'],
  legacyUrls: ['life/query/querychardraw'],
  desktop: {
    icon: 'PenTool',
    window: { width: 780, height: 640 },
    categories: ['life-query'],
    view: 'CharStrokeOrderTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
