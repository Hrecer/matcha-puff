import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const textLength = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text'],
    fields: { text: { widget: 'textarea', label: '文本', rows: 10, fullWidth: true } },
    resultAs: 'json',
  },
  execute,
})
