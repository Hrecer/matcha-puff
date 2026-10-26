import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from 'cn'

interface NativeTip {
  text: string
  x: number
  y: number
  above: boolean
}

/**
 * 全应用原生 title 接管。
 *
 * 工具页仍可能出现 title 属性，浏览器会画黑底系统提示，与奶油/抹茶玻璃
 * 语言割裂。这里把 title 移入 data-native-tip 并按 Tip 的样式重绘，
 * 应用内不再出现原生 Tooltip。
 */
export function NativeTitleTooltip() {
  const [tip, setTip] = useState<NativeTip | null>(null)

  useEffect(() => {
    let current: Element | null = null
    let timer: number | undefined

    const hide = () => {
      window.clearTimeout(timer)
      current = null
      setTip(null)
    }

    /**
     * 把 title 文案搬进 data-native-tip。
     *
     * title 不删、只置空：直接 removeAttribute 会再触发一次 attribute 变更，
     * 下一轮回调看到「没有 title、却还有 data-native-tip」，会把刚写好的提示
     * 当成幽灵删掉 —— 截断后的提示就永远弹不出来。空 title 既能压住系统
     * 黑底提示，又让 React 之后改文案 / 撤文案仍然可观测。
     *
     * oldValue 用来区分「这次空值是谁写的」：本组件置空时旧值非空；React
     * 撤掉文案或直接写空串时旧值是 '' / null，此时才清标记。手动扫描
     * （initial / addedNodes）没有 oldValue，保留已置空元素的标记。
     */
    const sync = (element: Element, oldValue?: string | null) => {
      const text = element.getAttribute('title')
      if (text) {
        if (element.getAttribute('data-native-tip') !== text) {
          element.setAttribute('data-native-tip', text)
        }
        element.setAttribute('title', '')
        return
      }
      if (!element.hasAttribute('data-native-tip')) return
      if (text === '' && oldValue !== '' && oldValue !== null) return
      // 文案真的没了（比如文字不再截断）：旧标记必须一起清掉，
      // 否则会留下一个永远弹得出来的幽灵提示。
      element.removeAttribute('data-native-tip')
      // 已经弹出来的提示也要立刻收起，不能等鼠标移开
      if (current === element) hide()
    }

    const strip = (root: ParentNode) => {
      if (root instanceof Element) sync(root)
      root.querySelectorAll?.('[title], [data-native-tip]').forEach((element) => sync(element))
    }

    strip(document)
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.target instanceof Element) {
          sync(mutation.target, mutation.oldValue)
        }
        mutation.addedNodes.forEach((node) => {
          if (node instanceof Element) strip(node)
        })
      }
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['title'],
    })

    const show = (element: Element) => {
      const text = element.getAttribute('data-native-tip') ?? ''
      if (!text) return
      const rect = element.getBoundingClientRect()
      const above = rect.bottom + 44 > window.innerHeight
      setTip({
        text,
        x: Math.min(Math.max(rect.left + rect.width / 2, 96), window.innerWidth - 96),
        y: above ? rect.top - 8 : rect.bottom + 8,
        above,
      })
    }

    const onOver = (event: MouseEvent) => {
      // 按住鼠标拖选/拖窗口时不该弹提示
      if (event.buttons !== 0) return
      const target = (event.target as Element | null)?.closest?.('[data-native-tip]')
      if (!target || target === current) return
      window.clearTimeout(timer)
      current = target
      timer = window.setTimeout(() => show(target), 700)
    }
    const onOut = (event: MouseEvent) => {
      if (!current) return
      const next = event.relatedTarget
      if (next instanceof Node && current.contains(next)) return
      hide()
    }
    const onVisibility = () => {
      if (document.hidden) hide()
    }

    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    document.addEventListener('mousedown', hide, true)
    document.addEventListener('scroll', hide, true)
    // 失焦（最小化/切走）时收起：否则还原窗口后提示会原样留在屏幕上
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      observer.disconnect()
      window.clearTimeout(timer)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseout', onOut)
      document.removeEventListener('mousedown', hide, true)
      document.removeEventListener('scroll', hide, true)
      window.removeEventListener('blur', hide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  if (!tip) return null
  return createPortal(
    <div
      role="tooltip"
      className={cn(
        'pointer-events-none fixed z-[60] w-max max-w-[280px] -translate-x-1/2 rounded-[6px] border border-primary/45 bg-background px-3 py-1.5 text-[12px] font-medium leading-snug text-primary',
        tip.above && '-translate-y-full',
      )}
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.text}
    </div>,
    document.body,
  )
}
