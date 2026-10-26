import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { DiffHunk, DiffLine, TextDiffInput, TextDiffOutput } from './schema'

/** 规模上限：LCS 是 O(n·m)，超过就明确报错而不是让进程卡死 */
const MAX_UNITS = 4000

function dropTrailingEmpty(units: string[]): string[] {
  return units.length > 0 && units[units.length - 1] === '' ? units.slice(0, -1) : units
}

function tokenize(input: TextDiffInput, side: 'left' | 'right'): string[] {
  const raw = side === 'left' ? input.left : input.right
  const text = input.ignoreWhitespace ? raw.replace(/\s+/g, ' ') : raw

  if (input.mode === 'chars') return [...text]
  if (input.mode === 'words') return text.split(/(\s+)/).filter((token) => token.length > 0)

  // split 会保留末尾的空行，去掉最后一个空串以符合直觉
  const lines = input.ignoreWhitespace ? text.split('\n').map((line) => line.trim()) : text.split('\n')
  return dropTrailingEmpty(lines)
}

/** 经典 LCS 动态规划，回溯出编辑脚本 */
function buildScript(left: string[], right: string[]): DiffLine[] {
  const n = left.length
  const m = right.length
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))

  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = left[i] === right[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  let oldNumber = 0
  let newNumber = 0

  while (i < n && j < m) {
    if (left[i] === right[j]) {
      oldNumber += 1
      newNumber += 1
      out.push({ type: 'equal', text: left[i] ?? '', oldNumber, newNumber })
      i += 1
      j += 1
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      oldNumber += 1
      out.push({ type: 'del', text: left[i] ?? '', oldNumber, newNumber: null })
      i += 1
    } else {
      newNumber += 1
      out.push({ type: 'add', text: right[j] ?? '', oldNumber: null, newNumber })
      j += 1
    }
  }
  while (i < n) {
    oldNumber += 1
    out.push({ type: 'del', text: left[i] ?? '', oldNumber, newNumber: null })
    i += 1
  }
  while (j < m) {
    newNumber += 1
    out.push({ type: 'add', text: right[j] ?? '', oldNumber: null, newNumber })
    j += 1
  }

  return out
}

function toHunks(script: DiffLine[], context: number): DiffHunk[] {
  if (context <= 0) {
    return [
      {
        oldStart: script.find((line) => line.oldNumber !== null)?.oldNumber ?? 0,
        oldLines: script.filter((line) => line.type !== 'add').length,
        newStart: script.find((line) => line.newNumber !== null)?.newNumber ?? 0,
        newLines: script.filter((line) => line.type !== 'del').length,
        lines: script,
      },
    ]
  }

  const changed = script.map((line) => line.type !== 'equal')
  const keep = new Set<number>()
  for (let index = 0; index < script.length; index += 1) {
    if (!changed[index]) continue
    for (let offset = -context; offset <= context; offset += 1) {
      const target = index + offset
      if (target >= 0 && target < script.length) keep.add(target)
    }
  }

  const hunks: DiffHunk[] = []
  let current: DiffHunk | null = null

  for (let index = 0; index < script.length; index += 1) {
    if (!keep.has(index)) {
      current = null
      continue
    }
    const line = script[index]
    if (!line) continue

    if (!current) {
      current = { oldStart: 0, oldLines: 0, newStart: 0, newLines: 0, lines: [] }
      hunks.push(current)
      let start = index
      while (start < script.length && keep.has(start) && script[start]?.oldNumber === null) start += 1
      current.oldStart = script[start]?.oldNumber ?? line.oldNumber ?? 0
      let newStartIndex = index
      while (newStartIndex < script.length && keep.has(newStartIndex) && script[newStartIndex]?.newNumber === null) {
        newStartIndex += 1
      }
      current.newStart = script[newStartIndex]?.newNumber ?? line.newNumber ?? 0
    }

    current.lines.push(line)
    if (line.type !== 'add') current.oldLines += 1
    if (line.type !== 'del') current.newLines += 1
  }

  return hunks
}

export function execute(input: TextDiffInput, _context: ToolExecutionContext): ToolResult<TextDiffOutput> {
  const left = tokenize(input, 'left')
  const right = tokenize(input, 'right')

  if (left.length * right.length > MAX_UNITS * MAX_UNITS) {
    return toolOk({
      identical: false,
      additions: 0,
      deletions: 0,
      hunks: [],
    })
  }

  const script = buildScript(left, right)
  const additions = script.filter((line) => line.type === 'add').length
  const deletions = script.filter((line) => line.type === 'del').length

  return toolOk({
    identical: additions === 0 && deletions === 0,
    additions,
    deletions,
    hunks: additions === 0 && deletions === 0 ? [] : toHunks(script, input.context),
  })
}
