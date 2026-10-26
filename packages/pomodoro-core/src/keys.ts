/** 专注文档存放的键。 */
export const DOC_KEYS = {
  config: 'config',
  ring: 'ring',
  habits: 'habits',
  habitList: 'habitList',
  summary: 'summary',
  statistics: 'statistics',
  inbox: 'inbox',
  /** 任务树：单表承载任意层级 */
  tasks: 'tasks',
  /** 已入账的会话 id，保证 pending 重放不会重复计数 */
  processed: 'focusProcessed',
  /** 会话级明细：每次专注的起止、任务与完成状态 */
  sessions: 'focusSessions',
} as const
