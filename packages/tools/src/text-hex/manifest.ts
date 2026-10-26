import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'text-hex',
  version: '1.0.0',
  name: '十六进制文本转换',
  description: '把 UTF-8 文本转为十六进制字节串，或把十六进制还原为文本；空格可忽略。',
  category: 'coding',
  keywords: ['hex', '十六进制', '编码', '解码'],
  legacyUrls: ['programmer/convert/hex2str'],
  desktop: {
    icon: 'Hash',
    window: { width: 880, height: 620 },
    categories: ['coding-encode'],
    view: 'TextHexTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
