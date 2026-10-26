import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'zero-width-codec',
  version: '1.0.0',
  name: '隐藏字符加密解密',
  description: '把文字藏进看不见的零宽字符里（复制粘贴可见原文、实际带着密文），也能还原出来。',
  category: 'life',
  keywords: ['零宽字符', '隐藏字符', '隐写', '水印', 'zero width'],
  legacyUrls: ['life/convert/hidecharconvert'],
  desktop: {
    icon: 'EyeOff',
    window: { width: 860, height: 660 },
    categories: ['life-convert'],
    view: 'ZeroWidthCodecTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
