import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'weibo-user', caller: 'ui' })

describe('weibo-user', () => {
  it('按旧规则解析 00 开头的 62 进制文件名', () => {
    const result = execute(
      { url: 'https://wx1.sinaimg.cn/large/006APoFYly1h0abcdefg.jpg' },
      context,
    )
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.code).toBe('006APoFY')
    expect(result.data.uid).toMatch(/^\d+$/)
    expect(result.data.homepage).toBe(`http://weibo.com/u/${result.data.uid}`)
  })

  it('解析十六进制文件名并拒绝非微博图片', () => {
    const result = execute({ url: 'https://wx2.sinaimg.cn/large/5a1b2c3dly1abc.jpg' }, context)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.uid).toBe(String(Number.parseInt('5a1b2c3d', 16)))

    const bad = execute({ url: 'https://example.com/5a1b2c3d.jpg' }, context)
    expect(bad.ok).toBe(false)
  })
})
