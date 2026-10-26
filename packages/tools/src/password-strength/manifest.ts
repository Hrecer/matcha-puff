import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'password-strength',
  version: '1.0.0',
  name: '密码强度检测',
  description: '输入即按长度与字符种类给密码分级（低 / 中 / 高），并指出还缺哪类字符。',
  category: 'life',
  keywords: ['密码', '强度', '安全', 'password', 'strength'],
  legacyUrls: ['life/query/passwordcheck'],
  desktop: {
    icon: 'ShieldCheck',
    window: { width: 780, height: 620 },
    categories: ['life-query'],
    view: 'PasswordStrengthTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
