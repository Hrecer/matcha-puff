import type { ToolPolicy } from '@matcha-puff/tool-contracts'
import type { PluginToggle } from '@matcha-puff/tool-settings'

/**
 * 把「插件默认策略」与「用户配置」合成有效权限。
 *
 * 两者取交集：用户配置只能收紧、不能放宽插件的默认策略 —— 用户配置不得覆盖默认安全策略。
 */
export function resolvePolicy(defaultPolicy: ToolPolicy, userToggle: PluginToggle): ToolPolicy {
  return {
    enabled: defaultPolicy.enabled && userToggle.enabled,
    uiEnabled: defaultPolicy.uiEnabled && userToggle.uiEnabled,
  }
}

/** 工具当前能否执行：总开关打开，且没有在界面上被隐藏 */
export function isAllowed(policy: ToolPolicy): boolean {
  return policy.enabled && policy.uiEnabled
}
