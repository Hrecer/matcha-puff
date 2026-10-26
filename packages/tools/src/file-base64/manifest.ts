import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'file-base64',
  version: '1.0.0',
  name: '任意文件转Base64',
  description: '任意文件转成 Base64 或完整 data URL，可折行，体积与膨胀率一并算好。',
  category: 'webmaster',
  keywords: ['Base64', '文件', 'data URL', '编码', '内联'],
  legacyUrls: ['webmaster/service/anyfile2base64'],
  desktop: {
    icon: 'Binary',
    window: { width: 940, height: 680 },
    categories: ['webmaster-service'],
    view: 'FileBase64Tool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
