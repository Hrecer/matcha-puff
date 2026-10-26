import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'image-viewer', caller: 'ui' })

describe('image-viewer', () => {
  it('列出文件选择器支持的图片格式', () => {
    const result = execute({}, context)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.formats).toEqual([
      'gif',
      'png',
      'jpg',
      'jpeg',
      'webp',
      'bmp',
      'ico',
      'tiff',
      'tif',
    ])
    expect(result.data.note).toContain('选择文件进行预览')
  })
})
