import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'gif2frames',
  version: '1.0.0',
  name: 'GIF图片转帧',
  description: '把 GIF 动画逐帧拆成 PNG：显示尺寸与张数，可全选/取消、复制单张或整批保存到文件夹。',
  category: 'design',
  keywords: ['GIF', '拆帧', '帧提取', '动图', 'frames'],
  legacyUrls: ['designer/convertcompress/gif2frames'],
  desktop: {
    icon: 'Grid3X3',
    window: { width: 930, height: 560 },
    categories: ['design-convertcompress'],
    view: 'GifFramesTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
