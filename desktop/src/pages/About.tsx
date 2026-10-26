import { useEffect, useState } from 'react'
import logo from '@/assets/logo.png'
import { MatchaSign } from '@/components/ui/matcha-sign'
import { getAppVersion } from '@/ipc/bridge'

/**
 * 关于页
 *
 * 顶部为 SVG 手绘动画 MatchaSign：猫 + 抹茶叶 + 手写连笔
 * 「matcha puff」，笔字逐段写出、星芒闪烁、收尾淡出重来；
 * 背景透明，与页面底色一致。
 *
 * 标志来自 src/assets/logo.png，与窗口标题栏左端、任务栏图标同一来源。
 *
 * 【版本号禁止硬编码】徽标文案只来自运行时 getAppVersion()（Tauri App 模块），
 * 拿到之前不渲染徽标。
 */
export function About() {
  const [version, setVersion] = useState('')

  useEffect(() => {
    getAppVersion()
      .then((v) => v && setVersion(v))
      .catch(() => {})
  }, [])

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-y-auto overflow-x-hidden px-10 py-8 text-center">
      <MatchaSign />
      <img
        src={logo}
        alt="抹茶泡芙"
        className="mt-2 size-16 rounded-[16px] shadow-e2"
      />
      <h1 className="mt-4 flex items-center gap-2 text-2xl font-semibold text-foreground">
        抹茶泡芙
        {version ? (
          <span className="glass rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            v{version}
          </span>
        ) : null}
      </h1>
      <p className="mt-4 max-w-md text-sm font-light leading-relaxed text-muted-foreground">
        一款工具箱软件，包含多种实用小工具。
      </p>
    </div>
  )
}
