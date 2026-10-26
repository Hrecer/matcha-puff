/**
 * 列表滚动位置的「锚点」记忆。
 *
 * 为什么不用 scrollTop 像素值：内容一旦变化（删掉一张卡、切筛选项、删掉整个合集），
 * 像素值和内容就对不上了 —— 典型症状是「视口上方那张被删掉后，画面整体往下串一位」。
 * 锚点记的是「屏幕最上方是哪一张卡 + 它被滚掉了多少像素」，恢复时按这张卡重新对齐，
 * 所以上面增删多少张都不影响视图。
 *
 * 卡片被删掉时退回「同一序号」的那张：原来在它下面的元素正好补到这个序号上，
 * 于是画面等价于「顶上那张没了，下面那张顶上来」。
 */
export interface ScrollAnchor {
  /** 卡片 id（读自 attr 指定的属性） */
  id: string
  /** 视口顶部相对该卡片顶部的偏移：>0 表示这张卡的顶已经被滚到视口上方 */
  offset: number
  /** 记录时的序号：锚点卡片被删掉时用它找出「同位置的下一张」 */
  index: number
}

/** 读当前视口的锚点：第一张与视口相交（或刚好在下方）的卡片 */
export function readScrollAnchor(scroller: HTMLElement, attr: string): ScrollAnchor | null {
  const top = scroller.getBoundingClientRect().top
  const items = Array.from(scroller.querySelectorAll<HTMLElement>(`[${attr}]`))
  for (let index = 0; index < items.length; index += 1) {
    const rect = items[index].getBoundingClientRect()
    if (rect.bottom > top + 1) {
      return {
        id: items[index].getAttribute(attr) ?? '',
        offset: Math.round(top - rect.top),
        index,
      }
    }
  }
  return null
}

/** 把视口对回锚点；没有锚点或列表为空时回到顶部 */
export function applyScrollAnchor(
  scroller: HTMLElement,
  attr: string,
  anchor: ScrollAnchor | null,
): void {
  const items = Array.from(scroller.querySelectorAll<HTMLElement>(`[${attr}]`))
  if (!anchor || items.length === 0) {
    scroller.scrollTop = 0
    return
  }
  const matched = items.find((el) => el.getAttribute(attr) === anchor.id)
  const target = matched ?? items[Math.min(anchor.index, items.length - 1)]
  const scrollerTop = scroller.getBoundingClientRect().top
  // 卡片在内容坐标系里的位置：视口位置 + 当前滚动量
  const cardTop = target.getBoundingClientRect().top - scrollerTop + scroller.scrollTop
  scroller.scrollTop = Math.max(0, Math.round(cardTop - anchor.offset))
}
