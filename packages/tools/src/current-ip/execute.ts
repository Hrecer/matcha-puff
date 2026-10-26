import { toolOk } from '@matcha-puff/tool-contracts'
import type { ToolExecutionContext, ToolResult } from '@matcha-puff/tool-contracts'
import type { CurrentIpInput, CurrentIpOutput } from './schema'

export function execute(
  _input: CurrentIpInput,
  _context: ToolExecutionContext,
): ToolResult<CurrentIpOutput> {
  return toolOk({
    localTitle: '本地网络信息',
    exitTitle: '出口IP信息',
    endpoint: 'http://myip.ipip.net',
    note: '本机网卡地址由宿主枚举；出口 IP 与归属地需要联网查询。',
  })
}
