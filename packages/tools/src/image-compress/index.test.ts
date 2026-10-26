import { describe, expect, it, vi } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const ctx = createExecutionContext({
  toolId: 'image-compress',
  caller: 'ui',
  services: {
    image: {
      info: vi.fn(async () => ({ width: 800, height: 600, type: 'image/png' })),
      transform: vi.fn(async () => 'data:image/jpeg;base64,AAAAAAAAAAAA'),
    },
  },
})

describe('image-compress', () => {
  it('按缩放与画质输出，并给出体积对比', async () => {
    const result = await execute({ dataUrl: 'data:image/png;base64,AAAAAAAAAAAAAAAAAAAA', scale: 0.5, quality: 0.7, format: 'jpeg' }, ctx)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.width).toBe(400)
    expect(result.data.height).toBe(300)
    expect(result.data.beforeBytes).toBe(15)
    expect(result.data.bytes).toBe(9)
    expect(result.data.savedPercent).toBe(40)
  })

  it('把参数原样交给宿主', async () => {
    await execute({ dataUrl: 'data:image/png;base64,AAAA', scale: 1, quality: 0.5, format: 'webp' }, ctx)
    expect(ctx.services.image?.transform).toHaveBeenLastCalledWith('data:image/png;base64,AAAA', {
      resize: { scale: 1 },
      format: 'webp',
      quality: 0.5,
    })
  })

  it('按最大边长等比缩放（可与比例叠加）', async () => {
    const result = await execute(
      { dataUrl: 'data:image/png;base64,AAAA', scale: 1, quality: 0.6, maxEdge: 400, format: 'jpeg' },
      ctx,
    )
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.width).toBe(400)
    expect(result.data.height).toBe(300)
    expect(ctx.services.image?.transform).toHaveBeenLastCalledWith('data:image/png;base64,AAAA', {
      resize: { width: 400, height: 300 },
      format: 'jpeg',
      quality: 0.6,
    })
  })

  it('最大边长大于原图时不放大', async () => {
    const result = await execute(
      { dataUrl: 'data:image/png;base64,AAAA', scale: 1, quality: 0.6, maxEdge: 2000, format: 'jpeg' },
      ctx,
    )
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.width).toBe(800)
    expect(result.data.height).toBe(600)
  })

  it('缺少图像服务时报错', async () => {
    const result = await execute(
      { dataUrl: 'data:image/png;base64,AAAA', scale: 1, quality: 1, format: 'png' },
      createExecutionContext({ toolId: 'image-compress', caller: 'ui' }),
    )
    expect(result.ok ? '' : result.error.code).toBe('EXECUTION_FAILED')
  })
})
