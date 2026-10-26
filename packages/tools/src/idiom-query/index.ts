import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const idiomQuery = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: ['keyword', 'mode', 'length', 'random', 'offset', 'limit'],
    fields: {
      keyword: { widget: 'text', label: '关键词' },
      mode: {
        widget: 'select',
        label: '匹配方式',
        help: 'contains 包含 / startsWith 开头 / endsWith 结尾 / pinyin 拼音',
      },
      length: { widget: 'number', label: '字数', help: '0 表示不限，多数成语是 4 字' },
      random: { widget: 'switch', label: '随机来一条' },
      offset: { widget: 'number', label: '起始位置' },
      limit: { widget: 'number', label: '每次条数' },
    },
    resultAs: 'table',
  },
  execute,
})
