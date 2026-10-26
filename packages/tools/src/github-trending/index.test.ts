import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { TRENDING_LANGUAGES } from './languages'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'github-trending', caller: 'ui' })

describe('github-trending', () => {
  it('生成 trending 地址与周期标签', () => {
    expect(TRENDING_LANGUAGES).toHaveLength(16)
    const result = execute({ language: 'python', since: 'weekly' }, context)
    if (!result.ok) throw new Error(result.error.message)
    expect(result.data.url).toBe('https://github.com/trending/python?since=weekly')
    expect(result.data.languageTitle).toBe('Python')
    expect(result.data.sinceLabel).toBe('本周')
  })

  it('拒绝未知语言', () => {
    const result = execute({ language: 'brainfuck', since: 'daily' }, context)
    expect(result.ok).toBe(false)
  })
})
