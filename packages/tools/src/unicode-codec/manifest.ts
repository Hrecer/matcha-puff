import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'unicode-codec',
  version: '1.0.0',
  name: 'Unicode 编码解码',
  description: '按 encodeURIComponent 规则把文本转成百分号转义，或还原为文本。',
  category: 'coding',
  keywords: ['unicode', '编码', '解码', '百分号', 'escape'],
  legacyUrls: ['programmer/convert/unicodeconvert'],
  desktop: {
    icon: 'Languages',
    window: { width: 880, height: 620 },
    categories: ['coding-encode'],
    view: 'UnicodeCodecTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
