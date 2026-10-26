import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { calculateBmi } from '../shared/misc'
import type { BmiCalculatorInput, BmiCalculatorOutput } from './schema'

export function execute(
  input: BmiCalculatorInput,
  _context: ToolExecutionContext,
): ToolResult<BmiCalculatorOutput> {
  try {
    return toolOk(calculateBmi(input.heightCm, input.weightKg))
  } catch (error) {
    return toolFail('INVALID_INPUT', error instanceof Error ? error.message : 'BMI 计算失败')
  }
}
