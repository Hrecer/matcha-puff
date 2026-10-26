import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const passwordStrength = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['password'],
    fields: {
      password: { widget: 'text', label: '密码' },
    },
  },
  execute,
})
