import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'image-compress',
  version: '1.0.0',
  name: '图片压缩工具',
  description: '按缩放比例与画质压缩图片（PNG / JPEG / WebP），并给出压缩前后的体积对比。',
  category: 'design',
  keywords: ['压缩', '图片压缩', '画质', '体积', 'compress'],
  legacyUrls: ['designer/convertcompress/imagecompress'],
  desktop: {
    icon: 'ImageDown',
    window: { width: 1080, height: 700 },
    categories: ['design-convertcompress'],
    view: 'ImageCompressTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
