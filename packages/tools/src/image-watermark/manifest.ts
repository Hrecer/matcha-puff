import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'image-watermark',
  version: '1.0.0',
  name: '图片全屏水印',
  description: '在整张图上铺满斜向重复文字水印，可调内容、字号、颜色、透明度与角度。',
  category: 'design',
  keywords: ['水印', '全屏水印', '防盗图', 'watermark'],
  legacyUrls: ['designer/picvideo/fullscreenwatermark'],
  desktop: {
    icon: 'Stamp',
    window: { width: 1080, height: 720 },
    categories: ['design-image-video'],
    view: 'ImageWatermarkTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
