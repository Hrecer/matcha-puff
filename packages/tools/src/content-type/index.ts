import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const contentType = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['keyword'],
    fields: {
      keyword: { widget: 'text', label: '关键词' },
    },
    resultAs: 'table',
  },
  execute,
})
