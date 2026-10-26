import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'url-codec',
  version: '1.0.0',
  name: 'URL编码解码',
  description: '按 encodeURI / decodeURI 规则编码或解码 URL，保留 :/?#[]@ 等结构字符。',
  category: 'coding',
  keywords: ['url', '编码', '解码', 'encode', 'decode', '转义'],
  legacyUrls: ['programmer/convert/urlendecode'],
  desktop: {
    icon: 'Link2',
    window: { width: 880, height: 620 },
    categories: ['coding-encode'],
    view: 'UrlCodecTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
