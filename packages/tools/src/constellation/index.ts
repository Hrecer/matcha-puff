import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const constellation = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['date'],
    fields: {
      date: { widget: 'text', label: '出生日期' },
    },
  },
  execute,
})
