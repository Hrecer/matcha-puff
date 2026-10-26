import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const charLookup = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['strokes', 'char'],
    fields: {
      strokes: { widget: 'number', label: '笔画数' },
      char: { widget: 'text', label: '查单字（可选）' },
    },
  },
  execute,
})
