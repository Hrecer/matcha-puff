import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'qrcode',
  version: '1.0.0',
  name: '二维码生成',
  description: '把网址、文本、电话等内容生成为二维码 SVG，可调容错级别与尺寸，支持下载 PNG。',
  category: 'life',
  keywords: ['二维码', 'qrcode', '扫码', '链接'],
  legacyUrls: ['life/picvideo/qrcodeencode'],
  desktop: {
    icon: 'QrCode',
    window: { width: 620, height: 460 },
    categories: ['life-image-video'],
    view: 'QrCodeTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
