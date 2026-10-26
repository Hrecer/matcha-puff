import { describe, expect, it } from 'vitest'
import { createExecutionContext } from '@matcha-puff/tool-contracts'
import { execute } from './execute'

const context = createExecutionContext({ toolId: 'markdown-converter', caller: 'ui' })

describe('markdown-converter', () => {
  it('标题转换为 h1', () => {
    const result = execute({ markdown: '# 标题', gfm: true, breaks: false, sanitize: true }, context)
    expect(result.ok && result.data.html).toContain('<h1')
    expect(result.ok && result.data.html).toContain('标题')
  })

  it('提取多级标题', () => {
    const result = execute(
      { markdown: '# A\n\n## B\n\n### C', gfm: true, breaks: false, sanitize: true },
      context,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.headings.map((h) => h.level)).toEqual([1, 2, 3])
  })

  it('代码块内的 # 不算标题', () => {
    const result = execute(
      { markdown: '```\n# not heading\n```', gfm: true, breaks: false, sanitize: true },
      context,
    )
    expect(result.ok && result.data.headings).toHaveLength(0)
  })

  it('默认移除 script 标签', () => {
    const result = execute(
      { markdown: '<script>alert(1)</script>\n\nok', gfm: true, breaks: false, sanitize: true },
      context,
    )
    expect(result.ok && result.data.html).not.toContain('<script')
  })

  it('sanitize=false 时保留原始标签', () => {
    const result = execute(
      { markdown: '<div onclick="x()">hi</div>', gfm: true, breaks: false, sanitize: false },
      context,
    )
    expect(result.ok && result.data.html).toContain('<div')
  })

  it('统计字数与字符数', () => {
    const result = execute({ markdown: '# 你好 世界', gfm: true, breaks: false, sanitize: true }, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.wordCount).toBeGreaterThan(0)
    expect(result.data.charCount).toBe('# 你好 世界'.length)
  })

  it('空输入不报错', () => {
    const result = execute({ markdown: '', gfm: true, breaks: false, sanitize: true }, context)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.wordCount).toBe(0)
  })
})
