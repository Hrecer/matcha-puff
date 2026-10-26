import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'id-card', caller: 'ui' })

const run = (id: string) => {
  const result = execute({ id }, context)
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

/** 11010519491231002X：北京朝阳区，1949-12-31，女，校验位 X */
const SAMPLE = '11010519491231002X'

describe('id-card', () => {
  it('解析地区、生日、性别与星座', () => {
    const data = run(SAMPLE)
    expect(data.valid).toBe(true)
    expect(data.birthday).toBe('1949-12-31')
    expect(data.gender).toBe('女')
    expect(data.province).toBe('北京市')
    expect(data.district).toBe('朝阳区')
    expect(data.constellation).toBe('摩羯座')
  })

  it('校验位错误会被发现', () => {
    const data = run('110105194912310021')
    expect(data.valid).toBe(false)
    expect(data.error).toContain('校验位')
  })

  it('15 位老身份证也能解析', () => {
    const data = run('110105491231002')
    expect(data.valid).toBe(true)
    expect(data.birthday).toBe('1949-12-31')
  })

  it('地址码不在表里会报错', () => {
    expect(run('990105194912310021').valid).toBe(false)
  })

  it('出生日期不存在会被拒绝', () => {
    expect(run('110105194902310021').valid).toBe(false)
  })

  it('位数不对在 Schema 之后由执行层拒绝', () => {
    const result = execute({ id: '110105' }, context)
    expect(result.ok ? '' : result.error.code).toBe('INVALID_INPUT')
  })

  it('小写 x 与大空格都能容错', () => {
    expect(run(' 11010519491231002x ').valid).toBe(true)
  })
})
