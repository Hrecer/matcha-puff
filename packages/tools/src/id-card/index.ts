import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const idCard = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['id'],
    fields: { id: { widget: 'text', label: '身份证号' } },
    resultAs: 'table',
  },
  execute,
})
