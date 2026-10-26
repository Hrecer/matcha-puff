import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'text2image',
  version: '1.0.0',
  name: '文本转图片',
  description: '把一段文字排成图片：可调字号与对齐，自动换行，底部带生成署名，支持保存 PNG。',
  category: 'reporter',
  keywords: ['文字', '图片', '文本转图', '配图', '海报'],
  legacyUrls: ['reporter/edit/text2image'],
  desktop: {
    icon: 'FileImage',
    window: { width: 480, height: 640 },
    categories: ['reporter-edit'],
    view: 'Text2ImageTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
