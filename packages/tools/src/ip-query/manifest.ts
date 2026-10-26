import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'ip-query',
  version: '1.0.0',
  name: 'IP地址信息查询',
  description: '输入 IPv4 地址，查询归属地、经纬度、时区、运营商、组织与邮编。',
  category: 'webmaster',
  keywords: ['IP查询', 'IP归属地', 'ipapi', 'ip address'],
  legacyUrls: ['webmaster/network/ipquery'],
  desktop: {
    icon: 'MapPin',
    window: { width: 460, height: 500 },
    categories: ['webmaster-network'],
    view: 'IpQueryTool',
  },
  sideEffects: ['network-read'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
