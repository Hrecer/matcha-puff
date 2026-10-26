import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const storageSize = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['value', 'unit'],
    fields: {
      value: { widget: 'number', label: '数值' },
      unit: { widget: 'select', label: '输入单位' },
    },
    resultAs: 'table',
  },
  execute,
})
