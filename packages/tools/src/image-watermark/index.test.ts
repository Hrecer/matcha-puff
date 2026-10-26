import { describe, expect, it, vi } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const ctx = createExecutionContext({
  toolId: 'image-watermark',
  caller: 'ui',
  services: {
    image: {
      info: vi.fn(async () => ({ width: 600, height: 400, type: 'image/png' })),
      transform: vi.fn(async () => 'data:image/png;base64,AAAA'),
    },
  },
})

const base = {
  dataUrl: 'data:image/png;base64,AAAA',
  text: '抹茶泡芙',
  fontSize: 24,
  color: '#ffffff',
  opacity: 0.2,
  angle: -30,
  gap: 220,
  offsetX: 0,
  offsetY: 0,
  repeat: true,
  staggered: true,
}

describe('image-watermark', () => {
  it('把水印参数交给宿主', async () => {
    const result = await execute(base, ctx)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.width).toBe(600)
    expect(ctx.services.image?.transform).toHaveBeenLastCalledWith(base.dataUrl, {
      watermark: {
        text: '抹茶泡芙',
        fontSize: 24,
        color: '#ffffff',
        opacity: 0.2,
        angle: -30,
        gap: 220,
        gapX: 220,
        gapY: 220,
        offsetX: 0,
        offsetY: 0,
        repeat: true,
        staggered: true,
      },
      format: 'png',
    })
  })

  it('X/Y 间距、偏移与错开排列独立生效，角度支持 ±180', async () => {
    const result = await execute(
      {
        ...base,
        gapX: 60,
        gapY: 90,
        offsetX: -12,
        offsetY: 18,
        repeat: false,
        staggered: false,
        angle: 180,
      },
      ctx,
    )
    if (!result.ok) throw new Error(result.error.message)
    expect(ctx.services.image?.transform).toHaveBeenLastCalledWith(base.dataUrl, {
      watermark: expect.objectContaining({
        gapX: 60,
        gapY: 90,
        offsetX: -12,
        offsetY: 18,
        repeat: false,
        staggered: false,
        angle: 180,
      }),
      format: 'png',
    })
  })

  it('缺少图像服务时报错', async () => {
    const result = await execute(base, createExecutionContext({ toolId: 'image-watermark', caller: 'ui' }))
    expect(result.ok ? '' : result.error.code).toBe('EXECUTION_FAILED')
  })
})
