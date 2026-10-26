import { Hammer } from 'lucide-react'
import { Empty } from '@/components/ui/empty'

/**
 * 未知工具路由占位
 *
 * 工具窗口由宿主加载 /next/tool.html?tool=<id>；
 * 本组件只处理误入 /tool/<url> 或未知地址的情况。
 */
export function ToolRoute() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Empty
        icon={Hammer}
        title="工具不存在"
        description="请从工具页或插件中心打开工具。"
      />
    </div>
  )
}
