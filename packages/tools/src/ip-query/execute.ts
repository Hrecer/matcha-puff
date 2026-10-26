import { toolFail, toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { IpQueryInput, IpQueryOutput } from './schema'

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/

export function execute(
  input: IpQueryInput,
  _context: ToolExecutionContext,
): ToolResult<IpQueryOutput> {
  const ip = input.ip.trim()
  if (!IPV4.test(ip)) return toolFail('INVALID_INPUT', 'IP输入错误，请检查后重新输入。')
  return toolOk({
    ip,
    queryUrl: `http://ip-api.com/json/${ip}?lang=zh-CN`,
    fields: ['经度 / 纬度', '时区', '运营商', '组织', '邮编', '地区'],
  })
}
