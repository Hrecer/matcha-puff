import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'fullwidth-halfwidth',
  version: '1.0.0',
  name: '全角半角转换',
  description: '在 ASCII 半角与全角字符之间转换，空格会同步转为全角空格或半角空格。',
  category: 'reporter',
  keywords: ['全角', '半角', '全宽', '半宽', '字符'],
  legacyUrls: ['reporter/edit/fullhalf'],
  desktop: {
    icon: 'Scaling',
    window: { width: 820, height: 580 },
    categories: ['reporter-edit'],
    view: 'FullwidthHalfwidthTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
