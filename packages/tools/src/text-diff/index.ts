import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const textDiff = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['left', 'right', 'mode', 'ignoreWhitespace', 'context'],
    fields: {
      left: { widget: 'code', label: '原始文本', rows: 12, fullWidth: true },
      right: { widget: 'code', label: '对比文本', rows: 12, fullWidth: true },
      mode: { widget: 'select', label: '比较粒度', help: 'lines / words / chars' },
      ignoreWhitespace: { widget: 'switch', label: '忽略空白差异' },
      context: { widget: 'number', label: '上下文行数', help: '0 表示输出全部' },
    },
    resultAs: 'diff',
  },
  execute,
})
