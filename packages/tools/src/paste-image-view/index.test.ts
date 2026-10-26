import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'paste-image-view', caller: 'ui' })

describe('paste-image-view', () => {
  it('返回标题与保存提示', () => {
    const result = execute({}, context)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.title).toBe('剪切板图片预览')
    expect(result.data.subtitle).toContain('右下角可对图片进行保存')
    expect(result.data.note).toContain('Ctrl+V')
  })
})
