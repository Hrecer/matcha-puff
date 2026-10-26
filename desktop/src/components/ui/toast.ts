






let root: HTMLDivElement | null = null

export function toast(message: string, tone: 'success' | 'error' = 'success') {
  if (typeof document === 'undefined') return
  if (!root) {
    root = document.createElement('div')
    root.className =
      'pointer-events-none fixed bottom-6 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2'
    document.body.appendChild(root)
  }
  const el = document.createElement('div')
  el.className = `flex items-center gap-2 rounded-full border px-3.5 py-2 text-[13px] font-medium shadow-e3 transition-opacity duration-200 ${
    tone === 'error'
      ? 'border-destructive/30 bg-destructive-bg text-destructive'
      : 'border-border/70 bg-popover text-foreground'
  }`
  const dot = document.createElement('span')
  dot.className = `size-1.5 rounded-full ${tone === 'error' ? 'bg-destructive' : 'bg-primary'}`
  el.appendChild(dot)
  el.appendChild(document.createTextNode(message))
  root.appendChild(el)
  window.setTimeout(() => {
    el.classList.add('opacity-0')
    window.setTimeout(() => el.remove(), 220)
  }, 1800)
}
