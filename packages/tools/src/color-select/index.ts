import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const colorSelect = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['value'],
    fields: { value: { widget: 'text', label: '颜色值' } },
  },
  execute,
})
