import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'id-card',
  version: '1.0.0',
  name: '身份证信息查询',
  description: '校验身份证号（15 / 18 位）并解析出地区、生日、性别、年龄与星座。',
  category: 'life',
  keywords: ['身份证', '身份证号', '校验', '属地', '生日', 'idcard'],
  legacyUrls: ['life/query/idcardquery'],
  desktop: {
    icon: 'IdCard',
    window: { width: 760, height: 620 },
    categories: ['life-query'],
    view: 'IdCardTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
