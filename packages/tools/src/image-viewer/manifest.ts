import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'image-viewer',
  version: '1.0.0',
  name: '图片预览查看',
  description: '一次选择多张本地图片，网格预览，点开可全屏切换；右下角一键关闭全部预览。',
  category: 'life',
  keywords: ['图片预览', '查看图片', '图片浏览', 'image viewer'],
  legacyUrls: ['life/picvideo/imageview'],
  desktop: {
    icon: 'Images',
    window: { width: 860, height: 600 },
    categories: ['life-image-video'],
    view: 'ImageViewerTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
