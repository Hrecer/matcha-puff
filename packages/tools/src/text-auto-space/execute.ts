import pangu from 'pangu/browser'
import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { TextAutoSpaceInput, TextAutoSpaceOutput } from './schema'





export function insertSpaces(text: string): string {
  return pangu.spaceText(text)
}

const PUNCT_MAP: Record<string, string> = {
  '!': '！',
  ';': '；',
  ':': '：',
  ',': '，',
  '.': '。',
  '?': '？',
  '~': '～',
}

const DIGIT = /[0-9]/






export function toFullWidthPunctuation(text: string): string {
  let output = ''
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? ''
    const replacement = PUNCT_MAP[char]
    if (!replacement) {
      output += char
      continue
    }
    const prev = text[index - 1] ?? ''
    const next = text[index + 1] ?? ''
    if (DIGIT.test(prev) && DIGIT.test(next)) {
      output += char
      continue
    }
    // 连续的点视为省略号，保持原样，不拆成多个句号
    if (char === '.' && (prev === '.' || next === '.')) {
      output += char
      continue
    }
    output += replacement
  }
  return output
}

export function execute(
  input: TextAutoSpaceInput,
  _context: ToolExecutionContext,
): ToolResult<TextAutoSpaceOutput> {
  const result = input.operation === 'space' ? insertSpaces(input.text) : toFullWidthPunctuation(input.text)
  let changed = 0
  const max = Math.max(result.length, input.text.length)
  for (let index = 0; index < max; index += 1) {
    if (result[index] !== input.text[index]) changed += 1
  }
  return toolOk({
    text: result,
    operation: input.operation,
    inputLength: input.text.length,
    outputLength: result.length,
    changed,
  })
}
