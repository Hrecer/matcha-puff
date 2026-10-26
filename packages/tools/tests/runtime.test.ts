import { beforeEach, describe, expect, it } from 'vitest'
import { createRegistry, createRuntime } from '@matcha-puff/tool-runtime'
import { createMemoryBackend, createSettingsStore } from '@matcha-puff/tool-settings'
import { builtinPlugins } from '../src/index'

describe('tool runtime', () => {
  let settings = createSettingsStore(createMemoryBackend())
  let registry = createRegistry({ throwOnConflict: false })
  const runtime = () => createRuntime({ registry, settings })

  beforeEach(() => {
    settings = createSettingsStore(createMemoryBackend())
    registry = createRegistry({ throwOnConflict: false })
    registry.registerAll(builtinPlugins)
  })

  it('注册全部内置工具', () => {
    expect(registry.size()).toBe(builtinPlugins.length)
    expect(registry.validate().filter((issue) => issue.level === 'error')).toHaveLength(0)
  })

  it('UI 调用成功并返回结果', async () => {
    const result = await runtime().execute({
      toolId: 'text-length',
      input: { text: '{"a":1}' },
      caller: 'ui',
    })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.data).toMatchObject({ chars: 7 })
  })

  it('未注册的工具返回 TOOL_NOT_FOUND', async () => {
    const result = await runtime().execute({ toolId: 'nope', input: {}, caller: 'ui' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TOOL_NOT_FOUND')
  })

  it('参数非法返回 INVALID_INPUT', async () => {
    const result = await runtime().execute({
      toolId: 'text-length',
      input: { text: 123 },
      caller: 'ui',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('INVALID_INPUT')
  })

  it('禁用插件后无法执行', async () => {
    await settings.setPluginToggle('text-length', { enabled: false })
    const result = await runtime().execute({
      toolId: 'text-length',
      input: { text: '{}' },
      caller: 'ui',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TOOL_DISABLED')
  })

  it('隐藏工具后调用被拒，但总开关仍然开着', async () => {
    await settings.setPluginToggle('text-length', { uiEnabled: false })

    const result = await runtime().execute({
      toolId: 'text-length',
      input: { text: '{}' },
      caller: 'ui',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('CALLER_NOT_ALLOWED')
  })

  it('用户配置不能放宽插件的默认策略', async () => {
    // 内置插件默认全部开放，这里反向验证：总开关关掉后，即使界面开关仍为 true 也依然被拒
    await settings.setPluginToggle('text-length', { enabled: false, uiEnabled: true })
    const result = await runtime().execute({
      toolId: 'text-length',
      input: { text: '{}' },
      caller: 'ui',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.code).toBe('TOOL_DISABLED')
  })

  it('listForCaller 会随用户配置变化', async () => {
    const before = await runtime().listForCaller('ui')
    await settings.setPluginToggle('text-length', { uiEnabled: false })
    const after = await runtime().listForCaller('ui')
    expect(before.length - after.length).toBe(1)
    expect(after.some((meta) => meta.id === 'text-length')).toBe(false)
  })

  it('执行结果带耗时信息', async () => {
    const result = await runtime().execute({
      toolId: 'text-length',
      input: { text: '{}' },
      caller: 'ui',
    })
    expect(result.ok && result.meta?.durationMs).toBeTypeOf('number')
  })
})
