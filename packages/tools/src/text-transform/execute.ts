import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { TextTransformInput, TextTransformOutput } from './schema'

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function dedupe(input: TextTransformInput): { lines: string[]; removed: number } {
  const source = input.text.split('\n')
  const seen = new Set<string>()
  const kept: string[] = []
  let removed = 0

  for (const line of source) {
    const key = input.trimLines ? line.trim() : line
    const isEmpty = key.length === 0

    if (isEmpty && input.keepEmptyLines) {
      kept.push(line)
      continue
    }
    if (isEmpty && !input.keepEmptyLines) {
      removed += 1
      continue
    }
    if (seen.has(key)) {
      removed += 1
      continue
    }
    seen.add(key)
    kept.push(line)
  }

  return { lines: kept, removed }
}

function replace(input: TextTransformInput): { text: string; count: number } {
  const flags = input.caseSensitive ? 'g' : 'gi'
  let regex: RegExp
  try {
    regex = new RegExp(input.useRegex ? input.search : escapeRegExp(input.search), flags)
  } catch (error) {
    throw new Error(error instanceof Error ? `正则表达式无效：${error.message}` : '正则表达式无效')
  }

  let count = 0
  const text = input.text.replace(regex, (matched) => {
    count += 1
    return input.replacement.replace(/\$&/g, matched)
  })

  return { text, count }
}

export function execute(
  input: TextTransformInput,
  _context: ToolExecutionContext,
): ToolResult<TextTransformOutput> {
  const inputLines = input.text.length === 0 ? 0 : input.text.split('\n').length

  if (input.mode === 'dedupe') {
    const { lines, removed } = dedupe(input)
    const text = lines.join('\n')
    return toolOk({
      text,
      inputLines,
      outputLines: text.length === 0 ? 0 : text.split('\n').length,
      removedLines: removed,
      replacements: 0,
    })
  }

  let result: { text: string; count: number }
  try {
    result = replace(input)
  } catch (error) {
    return toolFail('INVALID_INPUT', error instanceof Error ? error.message : '替换失败')
  }

  return toolOk({
    text: result.text,
    inputLines,
    outputLines: result.text.length === 0 ? 0 : result.text.split('\n').length,
    removedLines: 0,
    replacements: result.count,
  })
}
