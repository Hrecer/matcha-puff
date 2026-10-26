import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'placeholder-image',
  version: '1.0.0',
  name: '占位图片生成',
  description: '按尺寸、底色与文字生成占位图，直接给 SVG data URL，也可让宿主渲成 PNG。',
  category: 'design',
  keywords: ['占位图', 'placeholder', 'SVG', '图片生成', '占位图片'],
  legacyUrls: ['designer/picvideo/placeholderimage'],
  desktop: {
    icon: 'Images',
    window: { width: 780, height: 600 },
    categories: ['design-image-video'],
    view: 'PlaceholderImageTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
