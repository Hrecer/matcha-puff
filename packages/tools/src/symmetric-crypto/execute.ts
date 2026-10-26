import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { cipher, passphraseCipher } from '../shared/crypto'
import type { SymmetricCryptoInput, SymmetricCryptoOutput } from './schema'

export function execute(
  input: SymmetricCryptoInput,
  _context: ToolExecutionContext,
): ToolResult<SymmetricCryptoOutput> {
  try {
    if (input.simple === true) {
      if (!input.password) return toolFail('INVALID_INPUT', '简易模式需要输入口令')
      const result = passphraseCipher(input.text, input.password, input.algorithm, input.operation)
      return toolOk({
        algorithm: input.algorithm,
        mode: '口令模式',
        operation: input.operation,
        result,
      })
    }
    if (!input.key) return toolFail('INVALID_INPUT', '高级模式需要输入密钥')
    const result = cipher(input.text, { ...input, key: input.key }, input.operation)
    if (input.operation === 'decrypt' && !result) {
      return toolFail('INVALID_INPUT', '解不出来：密钥、IV、模式或填充可能不对')
    }
    return toolOk({
      algorithm: input.algorithm,
      mode: input.algorithm === 'RC4' || input.algorithm === 'Rabbit' ? '流密码' : input.mode,
      operation: input.operation,
      result,
    })
  } catch (error) {
    return toolFail(
      'INVALID_INPUT',
      error instanceof Error ? error.message : '加解密失败，请检查密钥与参数',
    )
  }
}
