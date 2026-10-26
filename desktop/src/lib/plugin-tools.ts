/**
 * 插件工具窗口的宿主侧入口与图标解析。
 *
 * 窗口尺寸、图标与界面组件名都写在各插件自己的 manifest.desktop 里，
 * 这里只保留一份共享的图标词表与打开逻辑，不再按插件逐个接线。
 */
import type { LucideIcon } from 'lucide-react'
import {
  AlignHorizontalSpaceAround,
  ArrowDownAZ,
  Binary,
  BookOpen,
  BookText,
  CalendarHeart,
  ClipboardPaste,
  Crop,
  Dices,
  Eraser,
  EyeOff,
  FaceGrinning,
  FileImage,
  FileText,
  FileType,
  Flag,
  GitBranch,
  GitCompare,
  Grid3X3,
  HardDrive,
  Hash,
  HeartPulse,
  Hourglass,
  IdCard,
  ImageDown,
  Images,
  KeyRound,
  Languages,
  Link2,
  Lock,
  MapPin,
  Monitor,
  Network,
  Palette,
  PenTool,
  Pencil,
  Pipette,
  Play,
  QrCode,
  Replace,
  Ruler,
  Scaling,
  Shapes,
  Share2,
  ShieldCheck,
  Square,
  Stamp,
  Star,
  StickyNote,
  Type,
  Wrench,
} from 'lucide-react'
import { inTauri, invoke } from '@/ipc/bridge'
import { toast } from '@/components/ui/toast'
import { allPlugins, getToolSettings } from '@/lib/tool-core'
import { recordRecent } from '@/lib/library'

/** manifest.desktop.icon 使用的共享图标词表 */
const ICON_COMPONENTS: Record<string, LucideIcon> = {
  AlignHorizontalSpaceAround,
  ArrowDownAZ,
  Binary,
  BookOpen,
  BookText,
  CalendarHeart,
  ClipboardPaste,
  Crop,
  Dices,
  Eraser,
  EyeOff,
  FaceGrinning,
  FileImage,
  FileText,
  FileType,
  Flag,
  GitBranch,
  GitCompare,
  Grid3X3,
  HardDrive,
  Hash,
  HeartPulse,
  Hourglass,
  IdCard,
  ImageDown,
  Images,
  KeyRound,
  Languages,
  Link2,
  Lock,
  MapPin,
  Monitor,
  Network,
  Palette,
  PenTool,
  Pencil,
  Pipette,
  Play,
  QrCode,
  Replace,
  Ruler,
  Scaling,
  Shapes,
  Share2,
  ShieldCheck,
  Square,
  Stamp,
  Star,
  StickyNote,
  Type,
  Wrench,
}

export function pluginIcon(pluginId: string): LucideIcon {
  const name = allPlugins.find((plugin) => plugin.id === pluginId)?.desktop?.icon
  return (name ? ICON_COMPONENTS[name] : undefined) ?? Wrench
}

/**
 * 打开插件工具窗口。打开前按启用状态再收紧一次：
 * 卡片状态可能尚未刷新，真正的执行权限仍由 Runtime 兜底。
 */
export async function openPluginTool(pluginId: string): Promise<void> {
  const plugin = allPlugins.find((item) => item.id === pluginId)
  if (!plugin) {
    toast('工具不存在或已被移除', 'error')
    return
  }

  const spec = plugin.desktop?.window ?? { width: 720, height: 560 }

  if (!inTauri()) {
    // 浏览器预览：window.open 必须发生在用户手势的同步段内，先开再读设置；
    // 页面自身会再读一次开关，禁用时展示禁用说明。
    // 尺寸补 16px×2：子窗用透明留白画外阴影，补回后界面仍是设计尺寸。
    recordRecent(`plugin:${pluginId}`)
    const url = `${import.meta.env.BASE_URL}tool.html?tool=${encodeURIComponent(pluginId)}`
    window.open(url, '_blank', `width=${spec.width + 32},height=${spec.height + 32}`)
    return
  }

  const toggle = await getToolSettings()
    .getPluginToggle(pluginId)
    .catch(() => null)
  if (!toggle) {
    toast('读取工具设置失败，请稍后重试', 'error')
    return
  }
  if (!(plugin.defaultPolicy.enabled && toggle.enabled)) {
    toast(`「${plugin.name}」已在设置中禁用`)
    return
  }
  if (!(plugin.defaultPolicy.uiEnabled && toggle.uiEnabled)) {
    toast(`「${plugin.name}」已在设置中关闭界面入口`)
    return
  }

  recordRecent(`plugin:${pluginId}`)
  try {
    await invoke('open_plugin_tool', {
      toolId: pluginId,
      title: plugin.name,
      width: spec.width,
      height: spec.height,
    })
  } catch (error) {
    toast(`打开工具失败：${String(error)}`, 'error')
  }
}
