import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import {
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Repeat,
  RotateCcw,
  Scaling,
  Settings2,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SelectField } from '@/components/ui/select-field'
import { toast } from '@/components/ui/toast'
import { runTool } from '@/lib/tool-core'
import { cn } from '@/lib/utils'

const SPEEDS = ['0.75', '1.0', '1.25', '1.5', '2.0']

interface PlayerSource {
  url: string
  format: 'hls' | 'video' | 'unsupported'
  note: string
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '00:00:00'
  const total = Math.floor(value)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':')
}

export function M3u8PlayerTool() {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const playerRef = useRef<HTMLDivElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [url, setUrl] = useState('')
  const [source, setSource] = useState<PlayerSource | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.3)
  const [muted, setMuted] = useState(false)
  const [speed, setSpeed] = useState('1.0')
  const [loop, setLoop] = useState(false)
  const [mirror, setMirror] = useState(false)
  const [lightOff, setLightOff] = useState(false)
  const [pageFull, setPageFull] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !source) return
    setError('')
    setLoading(source.format !== 'unsupported')
    hlsRef.current?.destroy()
    hlsRef.current = null
    video.removeAttribute('src')
    video.load()

    if (source.format === 'unsupported') {
      setLoading(false)
      setError(source.note)
      return
    }

    if (source.format === 'video') {
      video.src = source.url
      void video.play().catch(() => setLoading(false))
      return
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = source.url
      void video.play().catch(() => setLoading(false))
      return
    }
    if (!Hls.isSupported()) {
      setLoading(false)
      setError('当前内核不支持 HLS 播放')
      return
    }
    const hls = new Hls({ enableWorker: true })
    hlsRef.current = hls
    hls.loadSource(source.url)
    hls.attachMedia(video)
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      void video.play().catch(() => setLoading(false))
    })
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return
      setLoading(false)
      setError(data.details ? `HLS 播放失败：${data.details}` : 'HLS 播放失败')
      hls.destroy()
      hlsRef.current = null
    })

    return () => {
      hls.destroy()
      if (hlsRef.current === hls) hlsRef.current = null
    }
  }, [source])

  useEffect(() => {
    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = muted
    video.playbackRate = Number(speed)
    video.loop = loop
  }, [volume, muted, speed, loop])

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSettingsOpen(false)
      setPageFull(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const play = async () => {
    if (busy) return
    if (!url.trim()) {
      toast('请输入需要播放的视频地址', 'error')
      return
    }
    setBusy(true)
    try {
      const result = await runTool<PlayerSource>('m3u8-player', { url })
      if (!result.ok) {
        toast(result.error.message, 'error')
        return
      }
      setSource({ ...result.data, note: result.data.note ?? '' })
      if (result.data.format === 'unsupported') toast(result.data.note, 'error')
    } finally {
      setBusy(false)
    }
  }

  const togglePlay = () => {
    const video = videoRef.current
    if (!video || !source) return
    if (video.paused) void video.play().catch(() => setError('播放失败，请检查视频地址'))
    else video.pause()
  }

  const retry = () => {
    setError('')
    if (source) setSource({ ...source })
  }

  const togglePip = async () => {
    const video = videoRef.current
    if (!video || !document.pictureInPictureEnabled) {
      toast('当前环境不支持画中画', 'error')
      return
    }
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture()
      else await video.requestPictureInPicture()
    } catch (pipError) {
      toast(pipError instanceof Error ? pipError.message : '画中画失败', 'error')
    }
  }

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await playerRef.current?.requestFullscreen()
    } catch (fullscreenError) {
      toast(fullscreenError instanceof Error ? fullscreenError.message : '全屏失败', 'error')
    }
  }

  return (
    <main className={cn('flex min-h-0 flex-1 gap-3 px-4 pb-4', pageFull && 'fixed inset-0 z-50 bg-background px-0 pb-0')}>
      <section
        ref={playerRef}
        className={cn(
          'relative flex min-h-0 flex-1 overflow-hidden rounded-panel bg-black',
          pageFull && 'rounded-none',
        )}
      >
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-contain"
          style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
          playsInline
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onWaiting={() => source && setLoading(true)}
          onPlaying={() => setLoading(false)}
          onCanPlay={() => setLoading(false)}
          onError={() => {
            if (!source) return
            setLoading(false)
            setError('视频源加载失败，请检查地址或网络')
          }}
        />

        {!source && !error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-white/70">
            <Play className="size-10" />
            <p className="text-[13px]">输入 m3u8 / 视频地址后点击「播放视频」</p>
            <p className="text-[10.5px] text-white/40">HLS 由本地 hls.js 解码，不上传任何内容</p>
          </div>
        ) : null}

        {loading ? (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 text-white/80">
            <span className="size-6 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            <p className="text-[11.5px]">正在缓冲...</p>
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/55 px-6 text-center text-white">
            <p className="text-[15px] font-medium">请求错误</p>
            <p className="max-w-md text-[11.5px] leading-relaxed text-white/65">{error}</p>
            <Button variant="secondary" size="sm" onClick={retry}>
              <RotateCcw />
              重新播放
            </Button>
          </div>
        ) : null}

        <div className="absolute inset-x-0 bottom-0 flex h-[46px] items-center gap-2 bg-gradient-to-t from-black/85 to-black/20 px-3 text-white">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={playing ? '暂停' : '播放'}
            className="text-white hover:bg-white/15 hover:text-white"
            disabled={!source || !!error}
            onClick={togglePlay}
          >
            {playing ? <Pause /> : <Play />}
          </Button>
          <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-white/80">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <input
            type="range"
            min={0}
            max={Number.isFinite(duration) && duration > 0 ? duration : 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            aria-label="播放进度"
            className="h-1 min-w-0 flex-1 cursor-pointer accent-[#409eff]"
            onChange={(event) => {
              const value = Number(event.target.value)
              setCurrentTime(value)
              if (videoRef.current) videoRef.current.currentTime = value
            }}
          />
          <label className="flex shrink-0 items-center gap-1 text-[10.5px] text-white/75">
            倍速
            <SelectField
              value={speed}
              onValueChange={setSpeed}
              options={SPEEDS.map((item) => ({ value: item, label: item }))}
              ariaLabel="倍速"
              size="sm"
              className="h-6 w-[64px] rounded border-white/20 bg-black/40 px-1.5 font-mono text-[10.5px] text-white [&_svg]:text-white/60"
              contentClassName="border-white/20 bg-neutral-900 text-white"
            />
          </label>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={muted ? '取消静音' : '静音'}
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={() => setMuted((value) => !value)}
          >
            {muted || volume === 0 ? <VolumeX /> : <Volume2 />}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label="音量"
            className="h-1 w-16 cursor-pointer accent-[#409eff]"
            onChange={(event) => {
              setVolume(Number(event.target.value))
              setMuted(false)
            }}
          />
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="画中画"
            title="画中画"
            className="text-white hover:bg-white/15 hover:text-white"
            disabled={!source || !!error}
            onClick={() => void togglePip()}
          >
            <PictureInPicture2 />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={pageFull ? '退出网页全屏' : '网页全屏'}
            title={pageFull ? '退出网页全屏' : '网页全屏'}
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={() => setPageFull((value) => !value)}
          >
            {pageFull ? <Minimize /> : <Scaling />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={fullscreen ? '退出全屏' : '全屏'}
            title={fullscreen ? '退出全屏' : '全屏'}
            className="text-white hover:bg-white/15 hover:text-white"
            onClick={() => void toggleFullscreen()}
          >
            {fullscreen ? <Minimize /> : <Maximize />}
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="播放设置"
              title="播放设置"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={() => setSettingsOpen((value) => !value)}
            >
              <Settings2 />
            </Button>
            {settingsOpen ? (
              <div className="absolute bottom-9 right-0 z-10 w-36 rounded-md border border-white/15 bg-neutral-900/95 p-1 text-[11px] text-white shadow-xl">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10"
                  onClick={() => setMirror((value) => !value)}
                >
                  镜像画面
                  <span className={mirror ? 'text-emerald-400' : 'text-white/35'}>{mirror ? '开' : '关'}</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10"
                  onClick={() => setLoop((value) => !value)}
                >
                  循环播放
                  <span className={loop ? 'text-emerald-400' : 'text-white/35'}>{loop ? '开' : '关'}</span>
                </button>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 hover:bg-white/10"
                  onClick={() => setLightOff((value) => !value)}
                >
                  关灯模式
                  <span className={lightOff ? 'text-emerald-400' : 'text-white/35'}>{lightOff ? '开' : '关'}</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <aside
        className={cn(
          'glass flex w-[300px] shrink-0 flex-col gap-2.5 rounded-panel p-3 transition-opacity',
          lightOff && 'opacity-30 hover:opacity-100',
          pageFull && 'hidden',
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-foreground">操作</span>
          {source ? (
            <span className="ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              {source.format === 'hls' ? 'HLS · hls.js' : source.format === 'video' ? '原生视频' : '不支持'}
            </span>
          ) : null}
        </div>
        <textarea
          value={url}
          spellCheck={false}
          placeholder="请在此输入需要播放的视频地址"
          onChange={(event) => setUrl(event.target.value)}
          onKeyDown={(event) => {
            if (event.ctrlKey && event.key === 'Enter') {
              event.preventDefault()
              void play()
            }
          }}
          className="h-24 resize-none rounded-md border border-border/50 bg-background/60 p-2 font-mono text-[11px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:ring-[3px] focus-visible:ring-ring/30 scroll-thin"
        />
        <Button size="sm" className="w-full" disabled={busy} onClick={() => void play()}>
          {busy ? <span className="size-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Play />}
          播放视频
        </Button>

        <div className="my-1 border-t border-border/40" />
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          支持 M3U8（HLS）、MP4、WebM、OGG 等常见地址；HLS 使用本地 hls.js 解码。
        </p>
        <p className="text-[10.5px] leading-relaxed text-muted-foreground">
          RTMP / FLV 受浏览器内核限制无法播放，会给出明确提示而不是留下无效按钮。
        </p>
        <div className="mt-auto flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
          <Repeat className="size-3" />
          循环、镜像、关灯在右下角设置菜单里
        </div>
      </aside>
    </main>
  )
}
