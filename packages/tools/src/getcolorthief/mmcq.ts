







const SIG_BITS = 5
const SHIFT = 8 - SIG_BITS
const MAX_ITERATIONS = 1000

type RGB = [number, number, number]

const histoIndex = (r: number, g: number, b: number): number =>
  (r << (2 * SIG_BITS)) + (g << SIG_BITS) + b

class VBox {
  private countCache?: number
  private avgCache?: RGB

  constructor(
    public r1: number,
    public r2: number,
    public g1: number,
    public g2: number,
    public b1: number,
    public b2: number,
    private histo: number[],
  ) {}

  volume(): number {
    return (this.r2 - this.r1 + 1) * (this.g2 - this.g1 + 1) * (this.b2 - this.b1 + 1)
  }

  count(): number {
    if (this.countCache === undefined) {
      let sum = 0
      for (let r = this.r1; r <= this.r2; r += 1) {
        for (let g = this.g1; g <= this.g2; g += 1) {
          for (let b = this.b1; b <= this.b2; b += 1) sum += this.histo[ histoIndex(r, g, b)] ?? 0
        }
      }
      this.countCache = sum
    }
    return this.countCache
  }

  copy(): VBox {
    return new VBox(this.r1, this.r2, this.g1, this.g2, this.b1, this.b2, this.histo)
  }

  avg(): RGB {
    if (!this.avgCache) {
      const step = 1 << SHIFT
      let total = 0
      let multR = 0
      let multG = 0
      let multB = 0
      for (let r = this.r1; r <= this.r2; r += 1) {
        for (let g = this.g1; g <= this.g2; g += 1) {
          for (let b = this.b1; b <= this.b2; b += 1) {
            const count = this.histo[histoIndex(r, g, b)] ?? 0
            total += count
            multR += count * (r + 0.5) * step
            multG += count * (g + 0.5) * step
            multB += count * (b + 0.5) * step
          }
        }
      }
      this.avgCache = total
        ? [Math.trunc(multR / total), Math.trunc(multG / total), Math.trunc(multB / total)]
        : [
            Math.trunc((step * (this.r1 + this.r2 + 1)) / 2),
            Math.trunc((step * (this.g1 + this.g2 + 1)) / 2),
            Math.trunc((step * (this.b1 + this.b2 + 1)) / 2),
          ]
    }
    return this.avgCache
  }

  contains(color: RGB): boolean {
    const r = color[0] >> SHIFT
    const g = color[1] >> SHIFT
    const b = color[2] >> SHIFT
    return r >= this.r1 && r <= this.r2 && g >= this.g1 && g <= this.g2 && b >= this.b1 && b <= this.b2
  }
}

/** 懒排序优先队列：pop 取最大值 */
class PriorityQueue {
  private items: VBox[] = []
  private sorted = false

  constructor(private compare: (a: VBox, b: VBox) => number) {}

  private ensureSorted(): void {
    if (!this.sorted) {
      this.items.sort(this.compare)
      this.sorted = true
    }
  }

  push(item: VBox): void {
    this.items.push(item)
    this.sorted = false
  }

  peek(index?: number): VBox | undefined {
    this.ensureSorted()
    return this.items[index ?? this.items.length - 1]
  }

  pop(): VBox | undefined {
    this.ensureSorted()
    return this.items.pop()
  }

  size(): number {
    return this.items.length
  }
}

/** 沿最长轴做中位切分，返回两个子盒（不可切时只返回一个） */
function splitBox(histo: number[], box: VBox): VBox[] {
  if (!box.count()) return []
  const widthR = box.r2 - box.r1 + 1
  const widthG = box.g2 - box.g1 + 1
  const widthB = box.b2 - box.b1 + 1
  const longest = Math.max(widthR, widthG, widthB)
  if (box.count() === 1) return [box.copy()]

  const partialSum: number[] = []
  const total = box.count()
  let running = 0

  if (longest === widthR) {
    for (let r = box.r1; r <= box.r2; r += 1) {
      let slice = 0
      for (let g = box.g1; g <= box.g2; g += 1) {
        for (let b = box.b1; b <= box.b2; b += 1) slice += histo[histoIndex(r, g, b)] ?? 0
      }
      partialSum[r] = running += slice
    }
  } else if (longest === widthG) {
    for (let g = box.g1; g <= box.g2; g += 1) {
      let slice = 0
      for (let r = box.r1; r <= box.r2; r += 1) {
        for (let b = box.b1; b <= box.b2; b += 1) slice += histo[histoIndex(r, g, b)] ?? 0
      }
      partialSum[g] = running += slice
    }
  } else {
    for (let b = box.b1; b <= box.b2; b += 1) {
      let slice = 0
      for (let r = box.r1; r <= box.r2; r += 1) {
        for (let g = box.g1; g <= box.g2; g += 1) slice += histo[histoIndex(r, g, b)] ?? 0
      }
      partialSum[b] = running += slice
    }
  }

  const partialSum2 = partialSum.map((value) => total - value)
  const axis = longest === widthR ? 'r' : longest === widthG ? 'g' : 'b'
  const lowKey = `${axis}1` as 'r1' | 'g1' | 'b1'
  const highKey = `${axis}2` as 'r2' | 'g2' | 'b2'

  for (let pos = box[lowKey]; pos <= box[highKey]; pos += 1) {
    if ((partialSum[pos] ?? 0) <= total / 2) continue
    const box1 = box.copy()
    const box2 = box.copy()
    let cut = pos - box[lowKey] <= box[highKey] - pos
      ? Math.min(box[highKey] - 1, Math.trunc(pos + (box[highKey] - pos) / 2))
      : Math.max(box[lowKey], Math.trunc(pos - 1 - (pos - box[lowKey]) / 2))
    // 切点不能落在空桶上，向有像素的一侧挪
    while (!(partialSum[cut] ?? 0)) cut += 1
    let cutCount = partialSum2[cut] ?? 0
    while (!cutCount && partialSum[cut - 1]) cutCount = partialSum2[(cut -= 1)] ?? 0

    box1[highKey] = cut
    box2[lowKey] = (box1[highKey] as number) + 1
    return [box1, box2]
  }
  return []
}

export interface QuantizeResult {
  /** 主色在前，按切分贡献排序 */
  palette: RGB[]
}

export function quantize(pixels: RGB[], colorCount: number): QuantizeResult | null {
  if (!pixels.length || colorCount < 2 || colorCount > 256) return null

  const histoSize = 1 << (3 * SIG_BITS)
  const histo = new Array<number>(histoSize).fill(0)
  for (const [r, g, b] of pixels) {
    const index = histoIndex(r >> SHIFT, g >> SHIFT, b >> SHIFT)
    histo[index] = (histo[index] ?? 0) + 1
  }

  // 首盒：所有像素的外接范围
  let minR = Infinity
  let maxR = -Infinity
  let minG = Infinity
  let maxG = -Infinity
  let minB = Infinity
  let maxB = -Infinity
  for (const [r, g, b] of pixels) {
    const rr = r >> SHIFT
    const gg = g >> SHIFT
    const bb = b >> SHIFT
    if (rr < minR) minR = rr
    if (rr > maxR) maxR = rr
    if (gg < minG) minG = gg
    if (gg > maxG) maxG = gg
    if (bb < minB) minB = bb
    if (bb > maxB) maxB = bb
  }
  const first = new VBox(minR, maxR, minG, maxG, minB, maxB, histo)

  const iterSplit = (queue: PriorityQueue, target: number): void => {
    let count = queue.size()
    let iterations = 0
    while (iterations < MAX_ITERATIONS) {
      if (count >= target) return
      const box = queue.pop()
      if (!box) return
      if (!box.count()) {
        queue.push(box)
        iterations += 1
        continue
      }
      const [box1, box2] = splitBox(histo, box)
      if (!box1) return
      queue.push(box1)
      if (box2) {
        queue.push(box2)
        count += 1
      }
      iterations += 1
    }
  }

  const byCount = new PriorityQueue((a, b) => a.count() - b.count())
  byCount.push(first)
  iterSplit(byCount, Math.ceil(0.75 * colorCount))

  const byCountVolume = new PriorityQueue((a, b) => a.count() * a.volume() - b.count() * b.volume())
  while (byCount.size()) byCountVolume.push(byCount.pop() as VBox)
  iterSplit(byCountVolume, colorCount)

  const palette: RGB[] = []
  while (byCountVolume.size()) {
    const box = byCountVolume.pop()
    // 单色/双色图会切出空盒（avg 落在盒中点），滤掉避免色板出现重复项
    if (box && box.count() > 0) palette.unshift(box.avg())
  }
  return { palette }
}
