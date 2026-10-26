/**
 * 分类图标映射（Lucide）
 *
 * 分类快照中的 icon 是 ri-* 类名；这里把 28 个分类映射到 Lucide 图标。
 *
 * 工具磁贴统一用所属分类的图标 + 抹茶浅底，不使用工具自带品牌色：
 * 全 UI 只有一个强调色（抹茶绿）。
 */
import {
  ArrowLeftRight,
  Brush,
  Bug,
  Clock,
  Cloud,
  Code,
  Code2,
  Database,
  FileArchive,
  FileCode,
  FileText,
  Film,
  Gamepad2,
  Globe,
  Headphones,
  Image,
  KeyRound,
  Languages,
  Palette,
  PenLine,
  PenTool,
  Quote,
  Ruler,
  Search,
  Sparkles,
  Sun,
  TerminalSquare,
  Timer,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

/** 分类 id → Lucide 图标（categories.json 全量 28 条） */
const CATEGORY_ICONS: Record<number, LucideIcon> = {
  // 顶层
  1: TerminalSquare, // 系统运维
  2: PenLine, // 编辑工具
  3: Code2, // 编程工具
  4: Brush, // 设计工具
  5: Sun, // 生活常用
  // 编程工具
  7: KeyRound, // 加密解密
  8: FileCode, // 编码解码
  9: Code, // 代码
  10: Bug, // 调试
  11: FileText, // 文档
  // 设计工具
  12: Palette, // 颜色
  13: Ruler, // 尺寸
  14: Image, // 图片
  15: FileArchive, // 转换压缩
  16: Sparkles, // 艺术
  // 生活常用
  17: Gamepad2, // 娱乐
  18: Timer, // 效率
  19: Clock, // 时间
  20: Search, // 查询
  21: ArrowLeftRight, // 转换
  22: Film, // 图片视频
  // 编辑工具
  23: PenTool, // 编辑
  24: Languages, // 汉字
  25: Quote, // 文字提取
  // 系统运维
  26: Cloud, // 网络
  27: Database, // 系统
  28: Headphones, // 服务
  29: Globe, // 域名
}

/** 取分类图标；未知分类回退到通用工具图标 */
export function categoryIcon(categoryId: number): LucideIcon {
  return CATEGORY_ICONS[categoryId] ?? Wrench
}
