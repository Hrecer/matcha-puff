import { defineTool } from '@matcha-puff/tool-contracts'
import { execute } from './execute'
import { manifest } from './manifest'
import { inputSchema, outputSchema } from './schema'

export const imageWatermark = defineTool({
  ...manifest,
  inputSchema,
  outputSchema,
  ui: {
    order: [
      'dataUrl',
      'text',
      'fontSize',
      'color',
      'opacity',
      'angle',
      'gapX',
      'gapY',
      'offsetX',
      'offsetY',
      'repeat',
      'staggered',
      'gap',
    ],
    fields: {
      dataUrl: { widget: 'textarea', label: '图片 data URL' },
      text: { widget: 'text', label: '水印文字' },
      fontSize: { widget: 'number', label: '字号' },
      color: { widget: 'text', label: '颜色' },
      opacity: { widget: 'number', label: '透明度' },
      angle: { widget: 'number', label: '角度（±180）' },
      gap: { widget: 'number', label: '统一间距（兼容）' },
      gapX: { widget: 'number', label: 'X 间距' },
      gapY: { widget: 'number', label: 'Y 间距' },
      offsetX: { widget: 'number', label: 'X 偏移' },
      offsetY: { widget: 'number', label: 'Y 偏移' },
      repeat: { widget: 'switch', label: '重复平铺' },
      staggered: { widget: 'switch', label: '错开排列' },
    },
  },
  execute,
})
