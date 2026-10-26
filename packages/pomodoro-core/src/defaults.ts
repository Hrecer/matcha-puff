import type {
  PomodoroConfig,
  RingSettings,
  SoundItem,
  Summary,
  TaskRef,
} from './types'

/** 无归属专注的固定 id：历史统计按 id 归档，不能每次随机生成 */
export const UNASSIGNED_TASK_ID = '9d432b3a-d71c-42b9-ab14-2545809340c3'

export const UNASSIGNED_TASK: TaskRef = {
  id: UNASSIGNED_TASK_ID,
  name: '未命名专注',
  desc: '这次专注没有任务归属，只记录时间。',
  type: 0,
}

export const DEFAULT_CONFIG: PomodoroConfig = {
  pomodoroTime: 25,
  restTime: 5,
  longRestTime: 15,
  longRestInterval: 4,
  autoNextPomodoro: false,
  autoRest: false,
  disableRest: false,
  notify: true,
  index: 'index',
}

export const DEFAULT_RING: RingSettings = {
  pomodoroNotify: 'alarm',
  restNoise: '0',
  whiteNoise: '0',
}

/** 音频实体在 public/audio/pomodoro/noise/<name>.mp3 */
export const NOISE_ITEMS: readonly SoundItem[] = [
  { title: '滴答声', name: 'jQpJWmyq' },
  { title: '滴答声2', name: 'TUQEQcEB' },
  { title: '雨天', name: 'QFkLKbSx' },
  { title: '森林', name: 'zEHBgStQ' },
  { title: '夜间', name: 'rgIZXUJF' },
]

/** 音频实体在 public/audio/pomodoro/notify/<name>.mp3 */
export const NOTIFY_ITEMS: readonly SoundItem[] = [
  // 闹铃与「时间 → 计时器」共用这个音源
  { title: '闹铃', name: 'alarm' },
  { title: '弹出', name: 'iymkMnZK' },
  { title: '门铃叮咚', name: 'tSEHEklD' },
  { title: '叮声一', name: 'notif-up' },
  { title: '叮声二', name: 'GFqgMuBc' },
  { title: '叮声三', name: 'lzGwwRKy' },
  { title: '气泡', name: 'ziixLFGV' },
]

export function createSummary(now = Date.now()): Summary {
  return {
    allPomodoroCount: 0,
    allPomodoroTime: 0,
    firstTime: now,
    todayPomodoro: 0,
    todayTime: 0,
    update: now,
    todayTasks: [],
  }
}
