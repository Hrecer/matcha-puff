import { toast } from '@/components/ui/toast'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { FormWorkbench } from './shared/FormWorkbench'
import { TextConvertWorkbench } from './shared/TextConvertWorkbench'

interface PinyinData {
  result: string
  mode: string
  chars: { char: string; pinyin: string; poly: string[]; isChinese: boolean }[]
  polyCount: number
}

export function PinyinConvertTool() {
  return (
    <TextConvertWorkbench<PinyinData>
      toolId="pinyin-convert"
      inputKey="text"
      hint="带声调、纯小写、首字母、多音字四种形式；同一段字一起转，词组的读音才准（重庆 → Chóng Qìng）。"
      placeholder="输入中文"
      sample="重庆的银行行长"
      runLabel="转拼音"
      controls={[
        {
          key: 'mode',
          label: '形式',
          type: 'select',
          defaultValue: 'tone',
          options: [
            { value: 'tone', label: '带声调' },
            { value: 'low', label: '纯小写' },
            { value: 'first', label: '首字母' },
            { value: 'poly', label: '多音字' },
          ],
        },
        { key: 'separator', label: '分隔符', type: 'text', defaultValue: ' ' },
        { key: 'stripSpaces', label: '去除空白', type: 'switch', defaultValue: 'false' },
      ]}
      outputOf={(data) => data.result}
      metaOf={(data) => (
        <span>
          {data.chars.length} 个字符 · {data.polyCount} 个多音字
        </span>
      )}
    />
  )
}

interface TraditionalData {
  result: string
  direction: string
  changed: number
  diffs: { from: string; to: string }[]
}

export function SimplifiedTraditionalTool() {
  return (
    <TextConvertWorkbench<TraditionalData>
      toolId="simplified-traditional"
      inputKey="text"
      hint="简繁互转与火星文；结果区会标出改了哪些字。"
      placeholder="输入文本"
      sample="汉字转换测试：软件与网络"
      runLabel="转换"
      controls={[
        {
          key: 'direction',
          label: '方向',
          type: 'select',
          defaultValue: 's2t',
          options: [
            { value: 's2t', label: '简 → 繁' },
            { value: 't2s', label: '繁 → 简' },
            { value: 'spark', label: '简 → 火星文' },
          ],
        },
      ]}
      outputOf={(data) => data.result}
      metaOf={(data) => <span>改动了 {data.changed} 个字</span>}
    />
  )
}

interface CharLookupData {
  strokes: number
  count: number
  chars: string[]
  detail: { char: string; pinyin: string; poly: string[]; strokes: number } | null
}

export function CharLookupTool() {
  return (
    <FormWorkbench<CharLookupData>
      toolId="char-lookup"
      hint="按笔画数查字；顺手填一个字，能看它的拼音、多音读音与笔画。"
      formTitle="查字条件"
      runLabel="查字"
      emptyTitle="等待查询"
      emptyDescription="填笔画数后查询。"
      example={{ strokes: '8', char: '泡' }}
      fields={[
        { key: 'strokes', label: '笔画数', type: 'number', defaultValue: '8', min: '1', max: '48', step: '1' },
        { key: 'char', label: '查单字（可选）', type: 'text', placeholder: '例如 泡', optional: true },
      ]}
      toText={(data) => `${data.strokes} 画共 ${data.count} 个字：${data.chars.join(' ')}`}
      renderResult={(data) => (
        <div className="flex h-full flex-col gap-2">
          <div className="flex items-center gap-2 rounded-md bg-primary/[0.08] px-3 py-2 text-[12px]">
            <span className="font-mono text-[15px] tabular-nums text-primary">{data.strokes} 画</span>
            <span className="text-muted-foreground">共 {data.count} 个字</span>
            {data.detail ? (
              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span className="text-[14px] text-foreground">{data.detail.char}</span>
                <span className="font-mono">{data.detail.pinyin}</span>
                <span>{data.detail.strokes} 画</span>
                {data.detail.poly.length > 1 ? (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                    {data.detail.poly.join(' / ')}
                  </span>
                ) : null}
              </span>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border/50 bg-background/40 p-2 scroll-thin">
            <div className="flex flex-wrap gap-1">
              {data.chars.map((char, index) => (
                <button
                  key={`${char}-${index}`}
                  type="button"
                  title={`复制 ${char}`}
                  onClick={() => {
                    void copyText(char).then(
                      () => toast(`已复制「${char}」`),
                      () => toast('复制失败', 'error'),
                    )
                  }}
                  className={cn(
                    'flex size-7 items-center justify-center rounded border border-border/40 text-[13px] text-foreground transition-colors hover:border-primary/40 hover:text-primary',
                    data.detail?.char === char && 'border-primary/50 bg-primary/10 text-primary',
                  )}
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    />
  )
}

interface StrokeData {
  total: number
  charCount: number
  chars: { char: string; strokes: number }[]
  skipped: string
}

export function StrokeCountTool() {
  return (
    <TextConvertWorkbench<StrokeData>
      toolId="stroke-count"
      inputKey="text"
      hint="统计整段中文的总笔画；数字、字母、标点会被跳过。"
      placeholder="输入汉字"
      sample="抹茶泡芙"
      runLabel="算笔画"
      controls={[]}
      outputOf={(data) => data.chars.map((item) => `${item.char} ${item.strokes} 画`).join('\n')}
      metaOf={(data) => (
        <span>
          共 {data.total} 画 · {data.charCount} 个字{data.skipped ? ` · 跳过「${data.skipped}」` : ''}
        </span>
      )}
    />
  )
}

interface SortData {
  text: string
  total: number
}

export function PinyinSortTool() {
  return (
    <TextConvertWorkbench<SortData>
      toolId="pinyin-sort"
      inputKey="text"
      hint="把整段文字里的汉字按拼音或笔画重新排序，空格和换行会被去掉。"
      placeholder="粘贴一段汉字，例如：张三李四王五"
      sample="张三李四王五阿七"
      runLabel="排序"
      controls={[
        {
          key: 'by',
          label: '依据',
          type: 'select',
          defaultValue: 'pinyin',
          options: [
            { value: 'pinyin', label: '拼音' },
            { value: 'stroke', label: '笔画' },
          ],
        },
        {
          key: 'direction',
          label: '顺序',
          type: 'select',
          defaultValue: 'asc',
          options: [
            { value: 'asc', label: '升序' },
            { value: 'desc', label: '降序' },
          ],
        },
      ]}
      outputOf={(data) => data.text}
      metaOf={(data) => `${data.total} 个字`}
    />
  )
}
