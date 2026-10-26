import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { TRENDING_LANGUAGES } from './languages'
import type { GithubTrendingInput, GithubTrendingOutput } from './schema'

const SINCE_LABEL: Record<string, string> = {
  monthly: '本月',
  weekly: '本周',
  daily: '今日',
}

export function execute(
  input: GithubTrendingInput,
  _context: ToolExecutionContext,
): ToolResult<GithubTrendingOutput> {
  const language = TRENDING_LANGUAGES.find((item) => item.name === input.language)
  if (!language) return toolFail('INVALID_INPUT', `不支持的语言：${input.language}`)
  const since = input.since ?? 'monthly'
  const url = `https://github.com/trending/${language.name}?since=${since}`
  return toolOk({
    url,
    language: language.name,
    languageTitle: language.title,
    since,
    sinceLabel: SINCE_LABEL[since] ?? since,
    languages: TRENDING_LANGUAGES,
  })
}
