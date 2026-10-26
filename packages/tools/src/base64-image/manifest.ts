import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'base64-image',
  version: '1.0.0',
  name: 'Base64/图片转换',
  description: '图片与 Base64 字符串互转：粘贴 data URL 出 Base64，粘贴 Base64 出可直接引用的 data URL。',
  category: 'design',
  keywords: ['Base64', '图片', 'data URL', 'base64img', '互转'],
  legacyUrls: ['designer/convertcompress/base64imgconvert'],
  desktop: {
    icon: 'FileImage',
    window: { width: 900, height: 640 },
    categories: ['design-convertcompress'],
    view: 'Base64ImageTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
