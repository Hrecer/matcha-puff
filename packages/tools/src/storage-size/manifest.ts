import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'storage-size',
  version: '1.0.0',
  name: '存储文件大小换算',
  description: '在 bit、Byte、KB、MB、GB、TB 之间按 1024 进制换算。',
  category: 'life',
  keywords: ['存储', '文件大小', '字节', 'kb', 'mb', 'gb', 'tb'],
  legacyUrls: ['life/convert/storagecalc'],
  desktop: {
    icon: 'HardDrive',
    window: { width: 820, height: 620 },
    categories: ['life-convert'],
    view: 'StorageSizeTool',
  },
  sideEffects: ['none'],
  defaultPolicy: {
    enabled: true,
    uiEnabled: true,
  },
}
