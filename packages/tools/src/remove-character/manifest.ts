import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'remove-character',
  version: '1.0.0',
  name: '去除特定字符',
  description: '一键移除文本中的中文、数字、英文或标点符号，保留其余内容与换行。',
  category: 'reporter',
  keywords: ['去除', '移除', '字符', '中文', '数字', '英文', '符号'],
  legacyUrls: ['reporter/edit/removechar'],
  desktop: {
    icon: 'Eraser',
    window: { width: 820, height: 580 },
    categories: ['reporter-edit'],
    view: 'RemoveCharacterTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
