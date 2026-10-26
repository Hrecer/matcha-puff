import type { ToolMetadata } from '@matcha-puff/tool-contracts'
import { pluginIcon, openPluginTool } from '@/lib/plugin-tools'
import { recordRecent, toggleFavorite, useLibrary } from '@/lib/library'
import { ToolShowcaseCard } from '@/pages/ToolShowcaseCard'

export function PluginTile({
  meta,
  disabled = false,
  className,
}: {
  meta: ToolMetadata
  disabled?: boolean
  className?: string
}) {
  const Icon = pluginIcon(meta.id)
  const { favorites } = useLibrary()
  const key = `plugin:${meta.id}`

  return (
    <ToolShowcaseCard
      name={meta.name}
      description={meta.description}
      Icon={Icon}
      disabled={disabled}
      favorite={favorites.includes(key)}
      onOpen={() => {
        if (!disabled) recordRecent(key)
        void openPluginTool(meta.id)
      }}
      onToggleFavorite={() => toggleFavorite(key)}
      className={className}
    />
  )
}
