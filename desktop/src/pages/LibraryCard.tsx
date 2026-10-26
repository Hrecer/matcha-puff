import type { UiPlugin } from '@/lib/tool-core'
import { PluginTile } from '@/pages/PluginTile'

export function LibraryCard({
  libraryKey,
  pluginTools,
}: {
  libraryKey: string
  pluginTools: UiPlugin[]
}) {
  if (!libraryKey.startsWith('plugin:')) return null
  const id = libraryKey.slice('plugin:'.length)
  const entry = pluginTools.find((item) => item.meta.id === id)
  if (!entry) return null
  return <PluginTile meta={entry.meta} disabled={!entry.enabled} />
}
