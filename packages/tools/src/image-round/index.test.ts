import { describe, expect, it, vi } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const ctx = createExecutionContext({
  toolId: 'image-round',
  caller: 'ui',
  services: {
    image: {
      info: vi.fn(async () => ({ width: 400, height: 300, type: 'image/png' })),
      transform: vi.fn(async () => 'data:image/png;base64,AAAA'),
    },
  },
})

describe('image-round', () => {
  it('按像素加圆角', async () => {
    const result = await execute({ dataUrl: 'data:image/png;base64,AAAA', radius: 40, byPercent: false }, ctx)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.radius).toBe(40)
    expect(ctx.services.image?.transform).toHaveBeenLastCalledWith('data:image/png;base64,AAAA', {
      round: { radius: 40 },
      format: 'png',
    })
  })

  it('按短边百分比换算（50% 即圆形裁切）', async () => {
    const result = await execute({ dataUrl: 'data:image/png;base64,AAAA', radius: 50, byPercent: true }, ctx)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.radius).toBe(150)
  })

  it('缺少图像服务时报错', async () => {
    const result = await execute(
      { dataUrl: 'data:image/png;base64,AAAA', radius: 20, byPercent: false },
      createExecutionContext({ toolId: 'image-round', caller: 'ui' }),
    )
    expect(result.ok ? '' : result.error.code).toBe('EXECUTION_FAILED')
  })
})
