import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'simplified-traditional',
  version: '1.0.0',
  name: '简繁转换',
  description: '简体转繁体、繁体转简体，另附火星文（非主流）转换；逐字对照给出改了哪些字。',
  category: 'reporter',
  keywords: ['简体', '繁体', '简繁转换', '火星文', 'traditional'],
  legacyUrls: ['reporter/chinesechar/simplified2hant', 'life/recreation/simplified2spark'],
  desktop: {
    icon: 'Type',
    window: { width: 980, height: 660 },
    categories: ['reporter-chinese-char', 'life-recreation'],
    view: 'SimplifiedTraditionalTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
