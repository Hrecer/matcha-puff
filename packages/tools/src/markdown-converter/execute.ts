import { marked } from 'marked'
import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { MarkdownInput, MarkdownOutput } from './schema'

/** 只剥离最危险的部分：脚本类标签与内联事件 / javascript: 协议 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<\s*(script|iframe|object|embed|link|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|iframe|object|embed|link|style)\b[^>]*\/?\s*>/gi, '')
    .replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1=""')
}

function extractHeadings(markdown: string): MarkdownOutput['headings'] {
  const headings: MarkdownOutput['headings'] = []
  const lines = markdown.split('\n')
  let inFence = false

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const matched = /^(#{1,6})\s+(.*)$/.exec(line.trim())
    if (matched?.[1] && matched[2] !== undefined) {
      headings.push({ level: matched[1].length, text: matched[2].replace(/[*_`]/g, '').trim() })
    }
  }
  return headings
}

function countWords(markdown: string): number {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*`_\-[\]()!]/g, ' ')
    .trim()
  const cjk = plain.match(/[\u4e00-\u9fa5]/g)?.length ?? 0
  const words = plain.replace(/[\u4e00-\u9fa5]/g, ' ').match(/[A-Za-z0-9]+/g)?.length ?? 0
  return cjk + words
}

export function execute(input: MarkdownInput, _context: ToolExecutionContext): ToolResult<MarkdownOutput> {
  let html: string
  try {
    const parsed = marked.parse(input.markdown, {
      async: false,
      gfm: input.gfm,
      breaks: input.breaks,
    })
    html = typeof parsed === 'string' ? parsed : String(parsed)
  } catch (error) {
    return toolFail('EXECUTION_FAILED', error instanceof Error ? error.message : 'Markdown 解析失败')
  }

  return toolOk({
    html: input.sanitize ? sanitizeHtml(html) : html,
    headings: extractHeadings(input.markdown),
    wordCount: countWords(input.markdown),
    charCount: input.markdown.length,
  })
}
