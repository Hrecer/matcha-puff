import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const bmiCalculator = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['heightCm', 'weightKg'],
    fields: {
      heightCm: { widget: 'number', label: '身高（cm）' },
      weightKg: { widget: 'number', label: '体重（kg）' },
    },
    resultAs: 'json',
  },
  execute,
})
