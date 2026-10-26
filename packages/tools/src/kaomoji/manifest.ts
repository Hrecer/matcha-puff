import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'kaomoji',
  version: '1.0.0',
  name: '颜文字表情',
  description: '999 个带名称的颜文字表情，按关键词筛选后一键复制。',
  category: 'life',
  keywords: ['颜文字', '表情', 'kaomoji', 'emoji'],
  legacyUrls: ['life/recreation/kaomoji'],
  desktop: {
    icon: 'FaceGrinning',
    window: { width: 920, height: 660 },
    categories: ['life-recreation'],
    view: 'KaomojiTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
