import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const charStrokeOrder = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['text'],
    fields: { text: { widget: 'textarea', label: '汉字', rows: 3 } },
    resultAs: 'table',
  },
  execute,
})
