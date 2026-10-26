import { LookupWorkbench } from './shared/LookupWorkbench'

export function ContentTypeTool() {
  return (
    <LookupWorkbench
      toolId="content-type"
      hint="按扩展名或 MIME 搜索；点某一行不展开，右侧按钮复制整行。"
      placeholder="搜 .json / application / image"
      columns={[
        { key: 'extension', label: '扩展名', width: 150, mono: true },
        { key: 'mime', label: 'MIME 类型', width: 220, mono: true },
        { key: 'description', label: '说明' },
      ]}
    />
  )
}
