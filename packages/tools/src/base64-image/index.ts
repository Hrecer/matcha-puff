import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const base64Image = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text', 'operation'],
    fields: {
      operation: { widget: 'select', label: '转换方向' },
      text: { widget: 'textarea', label: '内容' },
    },
  },
  execute,
})
