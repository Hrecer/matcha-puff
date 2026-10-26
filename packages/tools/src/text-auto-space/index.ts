import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const textAutoSpace = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text', 'operation'],
    fields: {
      text: { widget: 'textarea', label: '文本' },
      operation: { widget: 'select', label: '处理方式' },
    },
  },
  execute,
})
