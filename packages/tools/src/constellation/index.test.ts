import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'constellation', caller: 'ui' })

const sign = (date: string) => {
  const result = execute({ date }, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data.sign
}

describe('constellation', () => {
  it('分界日按传统口径归属', () => {
    expect(sign('2000-03-20')).toBe('双鱼座')
    expect(sign('2000-03-21')).toBe('白羊座')
    expect(sign('2000-04-19')).toBe('白羊座')
    expect(sign('2000-04-20')).toBe('金牛座')
  })

  it('摩羯座跨年区间正确', () => {
    expect(sign('2000-12-22')).toBe('摩羯座')
    expect(sign('2001-01-19')).toBe('摩羯座')
    expect(sign('2001-01-20')).toBe('水瓶座')
  })

  it('十二个星座都能命中', () => {
    const dates = [
      '2000-03-21', '2000-04-20', '2000-05-21', '2000-06-22', '2000-07-23', '2000-08-23',
      '2000-09-23', '2000-10-24', '2000-11-23', '2000-12-22', '2000-01-20', '2000-02-19',
    ]
    expect(new Set(dates.map(sign)).size).toBe(12)
  })

  it('结果附带完整十二星座列表供左侧栏点选', () => {
    const result = execute({ date: '2000-01-01' }, context)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.signs).toHaveLength(12)
    expect(result.data.signs[0]).toEqual({
      sign: '白羊座',
      english: 'Aries',
      emoji: '♈',
      start: '3月21日',
      end: '4月19日',
    })
    expect(result.data.signs[11]?.sign).toBe('双鱼座')
  })

  it('非法日期返回 INVALID_INPUT', () => {
    const result = execute({ date: '2000-02-30' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })
})
