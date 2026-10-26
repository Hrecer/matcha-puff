import { describe, expect, it, vi } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const makeCtx = (info: { width: number; height: number }, out = 'data:image/png;base64,AAAA') =>
  createExecutionContext({
    toolId: 'image-crop',
    caller: 'ui',
    services: { image: { info: vi.fn(async () => ({ ...info, type: 'image/png' })), transform: vi.fn(async () => out) } },
  })

describe('image-crop', () => {
  it('按坐标裁剪并给出尺寸与体积', async () => {
    const ctx = makeCtx({ width: 800, height: 600 })
    const result = await execute({ dataUrl: 'data:image/png;base64,AAA', x: 10, y: 20, width: 300, height: 200 }, ctx)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.width).toBe(300)
    expect(result.data.height).toBe(200)
    expect(ctx.services.image?.transform).toHaveBeenCalledWith('data:image/png;base64,AAA', {
      crop: { x: 10, y: 20, width: 300, height: 200 },
    })
  })

  it('裁剪框超出原图时报 INVALID_INPUT', async () => {
    const result = await execute({ dataUrl: 'x', x: 700, y: 0, width: 300, height: 100 }, makeCtx({ width: 800, height: 600 }))
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })

  it('没有图像服务时报 EXECUTION_FAILED', async () => {
    const result = await execute(
      { dataUrl: 'x', x: 0, y: 0, width: 10, height: 10 },
      createExecutionContext({ toolId: 'image-crop', caller: 'ui' }),
    )
    expect(result.ok ? '' : result.error.code).toBe('EXECUTION_FAILED')
  })
})
