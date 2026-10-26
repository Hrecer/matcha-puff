import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'bmi-calculator',
  version: '1.0.0',
  name: 'BMI值计算器',
  description: '按身高体重计算 BMI，并给出偏瘦、正常、过重或肥胖的区间判断。',
  category: 'life',
  keywords: ['bmi', '体重', '身高', '健康', '肥胖'],
  legacyUrls: ['life/query/bmicalc'],
  desktop: {
    icon: 'HeartPulse',
    window: { width: 740, height: 560 },
    categories: ['life-query'],
    view: 'BmiTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
