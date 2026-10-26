import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const symmetricCrypto = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text', 'key', 'iv', 'algorithm', 'mode', 'padding', 'operation', 'keyFormat', 'output'],
    fields: {
      text: { widget: 'textarea', label: '文本 / 密文' },
      key: { widget: 'text', label: '密钥' },
      iv: { widget: 'text', label: 'IV' },
      algorithm: { widget: 'select', label: '算法' },
      mode: { widget: 'select', label: '模式' },
      padding: { widget: 'select', label: '填充' },
      operation: { widget: 'select', label: '方向' },
      keyFormat: { widget: 'select', label: '密钥格式' },
      output: { widget: 'select', label: '输出格式' },
    },
  },
  execute,
})
