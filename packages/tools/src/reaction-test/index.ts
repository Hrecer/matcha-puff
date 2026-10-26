import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const reactionTest = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['trials'],
    fields: { trials: { widget: 'text', label: '反应时间（毫秒，逗号分隔）' } },
    resultAs: 'table',
  },
  execute,
})
