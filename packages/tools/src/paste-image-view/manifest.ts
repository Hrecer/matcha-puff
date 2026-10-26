import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'paste-image-view',
  version: '1.0.0',
  name: '剪切板图片查看下载',
  description: '读取剪贴板里的图片并全屏查看，右下角可保存为图片文件；关闭后清空预览。',
  category: 'life',
  keywords: ['剪贴板', '剪切板', '图片', '粘贴', 'clipboard'],
  legacyUrls: ['life/picvideo/pasteimageview'],
  desktop: {
    icon: 'ClipboardPaste',
    window: { width: 700, height: 600 },
    categories: ['life-image-video'],
    view: 'PasteImageViewTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
