import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { PasswordStrengthInput, PasswordStrengthOutput } from './schema'

const UPPER = /[A-Z]/
const LOWER = /[a-z]/
const DIGIT = /[0-9]/
/** 符号只算标点与特殊字符：汉字、字母、数字都不算，避免中文密码被误判为「含符号」 */
const SYMBOL = /[^\p{L}\p{N}\s]/u

const LABELS: Record<PasswordStrengthOutput['level'], string> = {
  weak: '低',
  medium: '中',
  strong: '高',
}

export function execute(
  input: PasswordStrengthInput,
  _context: ToolExecutionContext,
): ToolResult<PasswordStrengthOutput> {
  const password = input.password
  const length = Array.from(password).length
  const hasUpper = UPPER.test(password)
  const hasLower = LOWER.test(password)
  const hasDigit = DIGIT.test(password)
  const hasSymbol = SYMBOL.test(password)

  const kinds = [hasUpper, hasLower, hasDigit].filter(Boolean).length


  let level: PasswordStrengthOutput['level'] = 'weak'
  if (length >= 8 && hasUpper && hasLower && hasDigit && hasSymbol) level = 'strong'
  else if (length >= 7 && kinds >= 2) level = 'medium'

  const suggestions: string[] = []
  if (length < 8) suggestions.push('长度补到 8 位以上')
  if (!hasUpper) suggestions.push('加入大写字母')
  if (!hasLower) suggestions.push('加入小写字母')
  if (!hasDigit) suggestions.push('加入数字')
  if (!hasSymbol) suggestions.push('加入符号（如 !@#）')
  if (!suggestions.length) suggestions.push('已达到最强组合，注意不要多处复用')

  return toolOk({
    level,
    label: LABELS[level],
    length,
    hasUpper,
    hasLower,
    hasDigit,
    hasSymbol,
    suggestions,
  })
}
