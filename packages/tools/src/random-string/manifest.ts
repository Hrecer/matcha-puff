import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'random-string',
  version: '1.0.0',
  name: '随机字符串生成',
  description: '按所选字符集批量生成随机字符串，可控制长度、数量与是否允许重复。',
  category: 'coding',
  keywords: ['随机', '密码', '字符串', 'random', 'password', '生成'],
  legacyUrls: ['programmer/coding/randpass'],
  desktop: {
    icon: 'Dices',
    window: { width: 900, height: 620 },
    categories: ['coding-code'],
    view: 'RandomStringTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
