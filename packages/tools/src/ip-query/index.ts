import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const ipQuery = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['ip'],
    fields: { ip: { widget: 'text', label: '要查询的IP地址' } },
  },
  execute,
})
