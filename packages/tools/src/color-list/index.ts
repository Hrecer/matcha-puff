import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const colorList = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['keyword', 'group'],
    fields: {
      keyword: { widget: 'text', label: '关键词' },
      group: { widget: 'select', label: '色板' },
    },
    resultAs: 'table',
  },
  execute,
})
