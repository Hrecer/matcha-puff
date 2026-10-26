import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'current-ip',
  version: '1.0.0',
  name: '当前IP信息',
  description: '列出本机各网卡地址，并查询出口 IP 与所属地区；地址点击即可复制。',
  category: 'webmaster',
  keywords: ['当前IP', '本机IP', '出口IP', '网卡', 'ip'],
  legacyUrls: ['webmaster/network/currentip'],
  desktop: {
    icon: 'Network',
    window: { width: 730, height: 446 },
    categories: ['webmaster-network'],
    view: 'CurrentIpTool',
  },
  sideEffects: ['network-read'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
