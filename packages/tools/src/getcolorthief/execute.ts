import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import { quantize } from './mmcq'
import type { GetColorThiefInput, GetColorThiefOutput } from './schema'

const toHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`

export async function execute(
  input: GetColorThiefInput,
  context: ToolExecutionContext,
): Promise<ToolResult<GetColorThiefOutput>> {
  const image = context.services.image
  if (!image?.pixels) {
    return toolFail('EXECUTION_FAILED', '当前宿主不支持取色（缺少 image.pixels 能力）')
  }

  try {
    const { data } = await image.pixels(input.dataUrl, { maxDimension: 128 })


    const samples: [number, number, number][] = []
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      const alpha = data[i + 3] ?? 255
      if (alpha < 125) continue
      if (r > 250 && g > 250 && b > 250) continue
      samples.push([r, g, b])
    }

    if (!samples.length) {
      return toolFail('INVALID_INPUT', '图片里没有可提取的颜色（可能全是透明或纯白）')
    }

    const colorCount = Number.isFinite(input.colorCount) ? input.colorCount : 10
    const result = quantize(samples, colorCount)
    if (!result?.palette.length) {
      return toolFail('EXECUTION_FAILED', '颜色量化失败，换一张图试试')
    }

    const toSample = ([r, g, b]: [number, number, number]) => ({
      hex: toHex(r, g, b),
      rgb: `rgb(${r}, ${g}, ${b})`,
      r,
      g,
      b,
    })

    const palette = result.palette.map(toSample)
    return toolOk({ dominant: palette[0] as NonNullable<(typeof palette)[0]>, palette })
  } catch (error) {
    return toolFail('EXECUTION_FAILED', error instanceof Error ? `取色失败：${error.message}` : '取色失败')
  }
}
