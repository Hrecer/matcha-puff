import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const githubTrending = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['language', 'since'],
    fields: {
      language: { widget: 'select', label: '语言' },
      since: { widget: 'select', label: '榜单周期' },
    },
  },
  execute,
})
