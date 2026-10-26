import { inTauri, writeClipboardText } from '@/ipc/bridge'

/** 复制文本：桌面端走宿主剪贴板，浏览器预览优先 Clipboard API，失败再走选区兜底 */
export async function copyText(text: string): Promise<void> {
  if (inTauri()) {
    await writeClipboardText(text)
    return
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // 权限或安全上下文限制：继续尝试 execCommand
    }
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const copied = document.execCommand('copy')
  document.body.removeChild(textarea)
  if (!copied) throw new Error('复制失败')
}
