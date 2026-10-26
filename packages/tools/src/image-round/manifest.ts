import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'image-round',
  version: '1.0.0',
  name: '图片转圆角图片',
  description: '给图片加圆角，可按像素或短边百分比设置，输出 PNG 保留透明角。',
  category: 'design',
  keywords: ['圆角', '图片圆角', '圆角矩形', 'round', 'radius'],
  legacyUrls: ['designer/picvideo/imageround'],
  desktop: {
    icon: 'Square',
    window: { width: 1080, height: 700 },
    categories: ['design-image-video'],
    view: 'ImageRoundTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
