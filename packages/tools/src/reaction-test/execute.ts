import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { ReactionInput, ReactionOutput } from './schema'

const round = (value: number): number => Math.round(value)

/** 平均反应时间 → 评级；阈值参考人类视觉反应测试的常见分布 */
function rate(average: number): { rating: string; advice: string } {
  if (average < 180) return { rating: '异常快', advice: '低于 180ms 多半是提前按了，重测时等颜色真正变再按。' }
  if (average < 220) return { rating: '非常快', advice: '属于电竞选手区间，保持就好。' }
  if (average < 270) return { rating: '快', advice: '高于平均水平，状态不错。' }
  if (average < 330) return { rating: '正常', advice: '普通人的常见区间，喝口水再测差别不大。' }
  if (average < 450) return { rating: '偏慢', advice: '可能有点累，休息十分钟再测会更准。' }
  return { rating: '较慢', advice: '如果每次都很慢，先确认是不是网络或显示器延迟拖累了。' }
}

/** 平均 200ms 记 100 分，每慢 10ms 扣 2 分，最快 0 分封底 */
const scoreOf = (average: number): number => Math.max(0, Math.min(100, round(100 - (average - 200) / 5)))

export function execute(
  input: ReactionInput,
  _context: ToolExecutionContext,
): ToolResult<ReactionOutput> {
  const trials = input.trials
  const sorted = [...trials].sort((a, b) => a - b)
  const total = trials.reduce((sum, value) => sum + value, 0)
  const average = total / trials.length
  const middle = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : (sorted[middle] ?? 0)

  // 样本标准差（n-1），单次测试时按 0 处理
  const variance =
    trials.length > 1
      ? trials.reduce((sum, value) => sum + (value - average) ** 2, 0) / (trials.length - 1)
      : 0

  const { rating, advice } = rate(average)
  return toolOk({
    count: trials.length,
    best: round(sorted[0] ?? 0),
    worst: round(sorted[sorted.length - 1] ?? 0),
    average: round(average),
    median: round(median),
    consistency: round(Math.sqrt(variance)),
    rating,
    score: scoreOf(average),
    advice,
  })
}
