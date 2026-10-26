import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const zeroWidthCodec = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text', 'mode', 'carrier'],
    fields: {
      text: { widget: 'textarea', label: '文本 / 含密文的文本' },
      mode: { widget: 'select', label: '模式' },
      carrier: { widget: 'text', label: '载体文字' },
    },
  },
  execute,
})
