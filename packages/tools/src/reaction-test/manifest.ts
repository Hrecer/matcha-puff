import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'reaction-test',
  version: '1.0.0',
  name: '反应速度测试',
  description: '单次反应测试：背景 1–10 秒随机变色后按空格，显示反应秒数；抢按会进入失败页，可反复重测。',
  category: 'life',
  keywords: ['反应速度', '反应测试', '手速', 'reaction'],
  legacyUrls: ['life/recreation/reactionspeed'],
  desktop: {
    icon: 'Hourglass',
    window: { width: 760, height: 560 },
    categories: ['life-recreation'],
    view: 'ReactionTestTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
