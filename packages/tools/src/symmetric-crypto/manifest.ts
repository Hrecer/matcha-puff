import type { ToolManifest } from '@matcha-puff/tool-contracts'

export const manifest: ToolManifest = {
  id: 'symmetric-crypto',
  version: '1.0.0',
  name: '对称加密',
  description: 'AES / DES / 3DES / RC4 / Rabbit 的加解密，可选 CBC、ECB、CFB、OFB、CTR 模式与多种填充。',
  category: 'coding',
  keywords: ['AES', 'DES', '3DES', 'RC4', 'Rabbit', '加密', '解密', 'cipher'],
  legacyUrls: [
    'programmer/endecode/aesendecode',
    'programmer/endecode/desendecode',
    'programmer/endecode/tripledesendecode',
    'programmer/endecode/rc4endecode',
    'programmer/endecode/rabbitendecode',
  ],
  desktop: {
    icon: 'Lock',
    window: { width: 900, height: 700 },
    categories: ['coding-encryption'],
    view: 'SymmetricCryptoTool',
  },
  sideEffects: ['none'],
  defaultPolicy: { enabled: true, uiEnabled: true },
}
