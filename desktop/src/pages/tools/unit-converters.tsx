import { STORAGE_GROUPS } from '@matcha-puff/tools'
import { UnitWorkbench } from './shared/UnitWorkbench'

export function StorageSizeTool() {
  return (
    <UnitWorkbench
      toolId="storage-size"
      hint="bit、Byte、KB、MB、GB、TB 按 1024 进制互换。"
      groups={STORAGE_GROUPS}
      defaultUnit="mb"
    />
  )
}
