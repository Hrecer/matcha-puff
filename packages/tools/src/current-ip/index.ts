import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const currentIp = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: { order: [], fields: {} },
  execute,
})
