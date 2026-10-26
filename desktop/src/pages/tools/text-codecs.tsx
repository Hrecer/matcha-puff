import { CodecWorkbench } from './shared/CodecWorkbench'

export function UrlCodecTool() {
  return (
    <CodecWorkbench
      toolId="url-codec"
      hint="按 encodeURI / decodeURI 规则处理 URL，保留协议、路径与查询结构的符号。"
      actions={[
        { value: 'encode', label: 'URL 编码' },
        { value: 'decode', label: 'URL 解码' },
      ]}
      defaultAction="encode"
      example="https://example.com/搜索?q=抹茶 泡芙&lang=zh"
    />
  )
}

export function TextHexTool() {
  return (
    <CodecWorkbench
      toolId="text-hex"
      hint="文本按 UTF-8 字节转成十六进制，解码时可忽略空格与换行。"
      actions={[
        { value: 'encode', label: '文本转十六进制' },
        { value: 'decode', label: '十六进制转文本' },
      ]}
      defaultAction="encode"
      example="抹茶 puff 1.0"
    />
  )
}

export function UnicodeCodecTool() {
  return (
    <CodecWorkbench
      toolId="unicode-codec"
      hint="按 encodeURIComponent 规则把非 ASCII 字符转成百分号转义，或还原。"
      actions={[
        { value: 'encode', label: 'Unicode 编码' },
        { value: 'decode', label: 'Unicode 解码' },
      ]}
      defaultAction="encode"
      example="抹茶 puff 1.0"
    />
  )
}

export function FullwidthHalfwidthTool() {
  return (
    <CodecWorkbench
      toolId="fullwidth-halfwidth"
      hint="ASCII 半角与全角字符互换，空格会同步变成全角空格或半角空格。"
      actions={[
        { value: 'toFull', label: '转全角' },
        { value: 'toHalf', label: '转半角' },
      ]}
      defaultAction="toFull"
      example="ABC 123，半角与全角互换"
    />
  )
}

export function RemoveCharacterTool() {
  return (
    <CodecWorkbench
      toolId="remove-character"
      hint="移除指定类型的字符，其余内容与换行保持不变。"
      actions={[
        { value: 'chinese', label: '移除中文' },
        { value: 'number', label: '移除数字' },
        { value: 'english', label: '移除英文' },
        { value: 'symbol', label: '移除符号' },
      ]}
      defaultAction="chinese"
      example="抹茶 Puff 1.0，你好！"
    />
  )
}

export function TextAutoSpaceTool() {
  return (
    <CodecWorkbench
      toolId="text-auto-space"
      hint="中文与英文、数字之间自动补空格；也可以把半角标点一次转成全角，小数点与时间不受影响。"
      actions={[
        { value: 'space', label: '中英文加空格' },
        { value: 'punct', label: '标点转全角' },
      ]}
      defaultAction="space"
      example="今天我用TypeScript写了一个hello world程序,耗时3.5小时!"
      inputTitle="原文"
      outputTitle="处理后"
    />
  )
}

