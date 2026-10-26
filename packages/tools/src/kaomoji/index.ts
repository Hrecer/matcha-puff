import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const kaomoji = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['keyword', 'limit'],
    fields: {
      keyword: { widget: 'text', label: '关键词' },
      limit: { widget: 'number', label: '条数上限' },
    },
    resultAs: 'table',
  },
  execute,
})
