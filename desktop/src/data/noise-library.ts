/**
 * 白噪声音源目录。
 *
 * 内置声音按场景分为五类，每条记录只描述播放所需的元数据；
 * 音频文件随应用分发在 public/audio/noise 下，构建后与界面同源。
 */
import {
  Bell,
  Bird,
  Bug,
  Car,
  Clapperboard,
  Clock,
  CloudDrizzle,
  CloudLightning,
  CloudRain,
  Coffee,
  Cog,
  Dog,
  Droplets,
  Fish,
  Flame,
  House,
  Keyboard,
  Landmark,
  PackageSearch,
  PawPrint,
  Pencil,
  PenLine,
  PiggyBank,
  Plane,
  School,
  Sparkles,
  Store,
  Trees,
  UtensilsCrossed,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react'

export type NoiseCategoryId = 'nature' | 'daily' | 'animal' | 'weather' | 'life'

export interface NoiseCategory {
  id: NoiseCategoryId
  label: string
  hint: string
  icon: LucideIcon
}

export interface NoiseTrack {
  id: string
  title: string
  category: NoiseCategoryId
  /** 默认音量（0-100） */
  volume: number
  builtin: boolean
  /** 内置声音的音频文件名（不含扩展名） */
  file?: string
  icon: LucideIcon
}

export const NOISE_CATEGORIES: NoiseCategory[] = [
  { id: 'nature', label: '自然', hint: '山林、水岸与旷野', icon: Trees },
  { id: 'daily', label: '日常', hint: '城市与人声的底噪', icon: Coffee },
  { id: 'animal', label: '动物', hint: '虫鸣、鸟叫与兽声', icon: PawPrint },
  { id: 'weather', label: '天气', hint: '风、雨与雷的层次', icon: CloudRain },
  { id: 'life', label: '生活', hint: '手边细碎的声响', icon: House },
]

export const BUILTIN_NOISE: NoiseTrack[] = [
  { id: 'stream', title: '小溪流水', category: 'nature', volume: 90, builtin: true, file: 'stream', icon: Waves },
  { id: 'campfire', title: '野外篝火', category: 'nature', volume: 80, builtin: true, file: 'campfire', icon: Flame },
  { id: 'summer-forest', title: '夏日森林', category: 'nature', volume: 50, builtin: true, file: 'summer-forest', icon: Trees },
  { id: 'river-rapids', title: '湍急河流', category: 'nature', volume: 60, builtin: true, file: 'river-rapids', icon: Waves },
  { id: 'ocean-waves', title: '海浪', category: 'nature', volume: 70, builtin: true, file: 'ocean-waves', icon: Waves },
  { id: 'insects-birds', title: '虫鸣鸟叫', category: 'nature', volume: 70, builtin: true, file: 'insects-birds', icon: Bird },

  { id: 'morning-traffic', title: '汽车早高峰', category: 'daily', volume: 50, builtin: true, file: 'morning-traffic', icon: Car },
  { id: 'restaurant', title: '餐厅', category: 'daily', volume: 60, builtin: true, file: 'restaurant', icon: UtensilsCrossed },
  { id: 'cafe', title: '咖啡厅', category: 'daily', volume: 80, builtin: true, file: 'cafe', icon: Coffee },
  { id: 'temple', title: '寺庙', category: 'daily', volume: 90, builtin: true, file: 'temple', icon: Landmark },
  { id: 'food-street', title: '小吃街', category: 'daily', volume: 50, builtin: true, file: 'food-street', icon: Store },
  { id: 'airport-lounge', title: '机场候机室', category: 'daily', volume: 40, builtin: true, file: 'airport-lounge', icon: Plane },
  { id: 'school-break', title: '课间', category: 'daily', volume: 70, builtin: true, file: 'school-break', icon: School },
  { id: 'cinema', title: '电影放映室', category: 'daily', volume: 70, builtin: true, file: 'cinema', icon: Clapperboard },
  { id: 'diving', title: '潜水', category: 'daily', volume: 80, builtin: true, file: 'diving', icon: Fish },
  { id: 'fireworks', title: '烟花', category: 'daily', volume: 90, builtin: true, file: 'fireworks', icon: Sparkles },

  { id: 'katydid', title: '蝈蝈', category: 'animal', volume: 70, builtin: true, file: 'katydid', icon: Bug },
  { id: 'cicada', title: '蝉叫', category: 'animal', volume: 40, builtin: true, file: 'cicada', icon: Bug },
  { id: 'sheep', title: '羊群', category: 'animal', volume: 80, builtin: true, file: 'sheep', icon: PawPrint },
  { id: 'wolf-howling', title: '狼嚎', category: 'animal', volume: 70, builtin: true, file: 'wolf-howling', icon: PawPrint },
  { id: 'owl', title: '猫头鹰', category: 'animal', volume: 70, builtin: true, file: 'owl', icon: Bird },
  { id: 'dog-bark', title: '狗吠', category: 'animal', volume: 80, builtin: true, file: 'dog-bark', icon: Dog },
  { id: 'frog', title: '青蛙', category: 'animal', volume: 70, builtin: true, file: 'frog', icon: Bug },
  { id: 'pig', title: '小猪', category: 'animal', volume: 80, builtin: true, file: 'pig', icon: PiggyBank },

  { id: 'thunder', title: '雷声滚滚', category: 'weather', volume: 50, builtin: true, file: 'thunder', icon: CloudLightning },
  { id: 'light-rain', title: '小雨沥沥', category: 'weather', volume: 70, builtin: true, file: 'light-rain', icon: CloudDrizzle },
  { id: 'breeze', title: '微风习习', category: 'weather', volume: 80, builtin: true, file: 'breeze', icon: Wind },

  { id: 'keyboard', title: '键盘打字', category: 'life', volume: 80, builtin: true, file: 'keyboard', icon: Keyboard },
  { id: 'clock-tick', title: '时钟滴答', category: 'life', volume: 60, builtin: true, file: 'clock-tick', icon: Clock },
  { id: 'pencil', title: '铅笔写字', category: 'life', volume: 80, builtin: true, file: 'pencil', icon: Pencil },
  { id: 'water-drop', title: '水滴', category: 'life', volume: 70, builtin: true, file: 'water-drop', icon: Droplets },
  { id: 'chalk', title: '粉笔写字', category: 'life', volume: 90, builtin: true, file: 'chalk', icon: PenLine },
  { id: 'rummaging', title: '翻箱找东西', category: 'life', volume: 90, builtin: true, file: 'rummaging', icon: PackageSearch },
  { id: 'wooden-fish', title: '敲木鱼', category: 'life', volume: 70, builtin: true, file: 'wooden-fish', icon: Bell },
  { id: 'winding', title: '机械上弦', category: 'life', volume: 80, builtin: true, file: 'winding', icon: Cog },
]

export function noiseCategory(id: NoiseCategoryId): NoiseCategory {
  return NOISE_CATEGORIES.find((item) => item.id === id) ?? NOISE_CATEGORIES[0]
}

/** 内置音频的应用内地址：与界面同一个 base，开发预览与安装版路径一致 */
export function noiseSource(file: string): string {
  return `${import.meta.env.BASE_URL}audio/noise/${file}.mp3`
}
