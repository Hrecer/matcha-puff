import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'file-hash',
  version: '1.0.0',
  name: '计算文件Hash值',
  description: '算文件的 MD5 / SHA-1 / SHA-256 / SHA-512，一次列出多个算法结果，便于核对下载是否完整。',
  category: 'webmaster',
  keywords: ['文件哈希', 'MD5', 'SHA256', '校验', '校验和', 'checksum'],
  legacyUrls: ['webmaster/service/getfilehash'],
  desktop: {
    icon: 'Hash',
    window: { width: 860, height: 600 },
    categories: ['webmaster-service'],
    view: 'FileHashTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
