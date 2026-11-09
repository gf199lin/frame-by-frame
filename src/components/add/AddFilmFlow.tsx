import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import type {
  AddFilmDraft,
  AIFilmAnalysis,
  Film,
  MoodId,
  PosterMotif,
  WatchRecord,
} from '@/types'
import {
  GENRES,
  MOODS,
  THEMES,
  STATUS_LABELS,
  DIMENSION_MAP,
  zhCountry,
  zhGenre,
  zhGenres,
  zhLanguage,
} from '@/data/taxonomy'
import { directorOf, loglineOf } from '@/data/filmCopy'
import { ADD_STEPS, BRAND_LINE_EN, RITUAL } from '@/i18n/zh-CN'
import {
  aiErrorCode,
  aiErrorMessage,
  analyzeFilmMemory,
  isAiConfigured,
} from '@/lib/ai/client'
import { buildAnalysisHistory, filmMetaForAi } from '@/lib/ai/history'
import {
  createRecordFromAnalysis,
  createRecordWithoutAnalysis,
  toFilmAnalysis,
} from '@/lib/ai/adapter'
import { filmById } from '@/lib/tasteEngine'
import { cn, formatLongDate, todayISO, uid } from '@/lib/format'
import { useAppStore } from '@/store/AppStore'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { FilmPoster } from '@/components/film/FilmPoster'
import { RatingInput, Rating } from '@/components/ui/Rating'
import {
  filmFromCatalogue,
  loadCatalogueDetail,
  searchFilms,
  CatalogueError,
  type SearchHit,
} from '@/lib/catalogue'
import { readTmdbToken, writeTmdbToken } from '@/lib/catalogue/tmdb'

type Step = 'search' | 'manual' | 'review' | 'form' | 'analyzing' | 'failed' | 'result'

const STEP_INDEX: Record<Step, number> = {
  search: 0,
  manual: 0,
  review: 1,
  form: 2,
  analyzing: 3,
  failed: 3,
  result: 4,
}

const STEP_LABELS = ADD_STEPS.map((step) => step.label)

const AI_PHASES = [
  {
    label: '发送这次观影记录',
    detail: '只包含这部电影、这次笔记和相关旧片摘要，不发送整个片库。',
  },
  {
    label: '模型理解与结构化',
    detail: '区分你的表达与模型的推测，并为每条判断附上证据。',
  },
  {
    label: '校验并写入',
    detail: '结构不完整的返回会被拒绝，不会写入画像。',
  },
] as const

const PALETTES: Film['palette'][] = [
  { base: '#1B2168', deep: '#121747', accent: '#AEB6D9', soft: '#2B3280', paper: '#F8F2E3' },
  { base: '#2A2F66', deep: '#171B4E', accent: '#C3B49A', soft: '#3A3F75', paper: '#F6EFDF' },
  { base: '#21304F', deep: '#121C33', accent: '#A9B7C9', soft: '#2C3D60', paper: '#F3EEDF' },
  { base: '#3A3557', deep: '#1F1B33', accent: '#C0AFA4', soft: '#4A4468', paper: '#F7F1E3' },
]

const MOTIFS: PosterMotif[] = ['orbit', 'shore', 'stage', 'dome', 'forest', 'mind', 'signal', 'city']

const EXAMPLES = ['Zootopia', '疯狂动物城', '海边的曼彻斯特']

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

const HitPoster = ({ hit, eager = false }: { hit: SearchHit; eager?: boolean }) => {
  const [failed, setFailed] = useState(false)
  return (
    <span className="relative block h-[84px] w-[56px] shrink-0 overflow-hidden bg-white/[0.04]">
      {hit.posterUrl && !failed ? (
        <img
          src={hit.posterUrl}
          alt={`${hit.title} 官方海报`}
          className="h-full w-full object-cover"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex h-full w-full flex-col items-center justify-center gap-1 border border-white/15 px-1 text-center">
          <span className="font-mono text-[12px] uppercase leading-tight tracking-[0.1em] text-paper-muted">
            暂无海报
          </span>
        </span>
      )}
      <span className="pointer-events-none absolute inset-0 border border-white/10" aria-hidden="true" />
    </span>
  )
}

export const AddFilmFlow = ({
  open,
  onClose,
  initialFilmId,
  editRecord,
}: {
  open: boolean
  onClose: () => void
  initialFilmId?: string
  editRecord?: WatchRecord
}) => {
  const {
    records,
    films,
    state,
    upsertRecord,
    addCustomFilm,
    saveAnalysis,
    reviewAnalysis,
    deleteAnalysis,
    setAiConsent,
  } = useAppStore()
  const { push } = useToast()
  const navigate = useNavigate()

  const startStep: Step = editRecord ? 'form' : initialFilmId ? 'review' : 'search'
  const [step, setStep] = useState<Step>(startStep)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Film | null>(() => {
    if (!initialFilmId) return null
    return films.find((f) => f.id === initialFilmId) ?? null
  })
  const [draft, setDraft] = useState<AddFilmDraft>(() => ({
    filmId: initialFilmId ?? '',
    rating: editRecord?.rating ?? 0,
    watchedAt: editRecord?.watchedAt ?? todayISO(),
    status: editRecord?.status ?? 'watched',
    reflection: editRecord?.reflection ?? '',
    feltLike: editRecord?.feltLike ?? '',
  }))
  const [error, setError] = useState('')
  const [activeStage, setActiveStage] = useState(-1)
  const [pending, setPending] = useState<{ analysis: AIFilmAnalysis; record: WatchRecord } | null>(
    null,
  )
  const [aiError, setAiError] = useState<unknown>(null)
  const [elapsed, setElapsed] = useState(0)
  const [consent, setConsent] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  /* search */
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [searchError, setSearchError] = useState<CatalogueError | null>(null)
  const [retryTick, setRetryTick] = useState(0)
  const [tmdbOpen, setTmdbOpen] = useState(false)
  const [tmdbToken, setTmdbToken] = useState('')
  const [tokenDraft, setTokenDraft] = useState('')
  const [detailLoading, setDetailLoading] = useState(false)

  /* manual entry */
  const [manual, setManual] = useState({
    title: '',
    year: String(new Date().getFullYear()),
    director: '',
    runtime: '110',
    genre: 'Drama',
  })

  const previousRecords = useMemo(
    () => records.filter((r) => r.id !== editRecord?.id),
    [records, editRecord?.id],
  )

  useEffect(() => {
    if (open) setConsent(state.settings.allowAiNotes)
  }, [open, state.settings.allowAiNotes])

  useEffect(() => {
    if (step !== 'analyzing') return
    setElapsed(0)
    const started = Date.now()
    const timer = window.setInterval(
      () => setElapsed(Math.max(0, Math.round((Date.now() - started) / 1000))),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [step])

  useEffect(() => {
    if (!open) return
    setTmdbToken(readTmdbToken())
  }, [open])

  useEffect(() => {
    if (!open || step !== 'search') return
    const q = query.trim()
    const isChinese = /[\u3400-\u9fff]/.test(q)
    if (!q || (q.length < 2 && !isChinese)) {
      setStatus('idle')
      setHits([])
      setSearchError(null)
      return
    }

    setStatus('loading')
    const controller = new AbortController()
    let active = true
    const timer = window.setTimeout(() => {
      searchFilms({ query: q, films, records, signal: controller.signal })
        .then((found) => {
          if (!active) return
          setHits(found)
          setStatus('ready')
          setSearchError(null)
        })
        .catch((cause) => {
          if (!active || (cause as Error)?.name === 'AbortError') return
          setHits([])
          setSearchError(
            cause instanceof CatalogueError
              ? cause
              : new CatalogueError('unknown', (cause as Error)?.message ?? 'Search failed.'),
          )
          setStatus('error')
        })
    }, 380)

    return () => {
      active = false
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [open, step, query, films, records, retryTick, tmdbToken])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && step !== 'analyzing') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, step])

  const goTo = (path: string) => {
    onClose()
    navigate(path)
  }

  const chooseHit = (hit: SearchHit) => {
    if (hit.inArchive && hit.localFilm) {
      goTo(`/archive/${hit.localFilm.id}`)
      return
    }
    const base = hit.localFilm ?? (hit.catalogue ? filmFromCatalogue(hit.catalogue) : null)
    if (!base) return

    if (hit.catalogue && !hit.localFilm) addCustomFilm(base)
    setSelected(base)
    setDraft((d) => ({ ...d, filmId: base.id }))
    setError('')
    setDetailLoading(false)
    setStep('review')

    if (hit.catalogue && !hit.localFilm) {
      setDetailLoading(true)
      loadCatalogueDetail(hit.catalogue)
        .then((detail) => {
          if (!detail || Object.keys(detail).length === 0) return
          const enriched = filmFromCatalogue({ ...hit.catalogue!, ...detail })
          addCustomFilm(enriched)
          setSelected((previous) => (previous?.id === enriched.id ? enriched : previous))
        })
        .catch(() => {
          /* basic metadata from the search result is still usable */
        })
        .finally(() => setDetailLoading(false))
    }
  }

  const startManual = () => {
    setManual((current) => ({ ...current, title: query.trim() || current.title }))
    setError('')
    setStep('manual')
  }

  const saveToken = () => {
    writeTmdbToken(tokenDraft)
    setTmdbToken(readTmdbToken())
    setTmdbOpen(false)
    setRetryTick((tick) => tick + 1)
  }

  const removeToken = () => {
    writeTmdbToken('')
    setTmdbToken('')
    setTokenDraft('')
    setRetryTick((tick) => tick + 1)
  }

  const createManual = () => {
    const title = manual.title.trim()
    const year = Number(manual.year)
    if (!title || !Number.isFinite(year) || year < 1888 || year > 2100) {
      setError('请填写片名和一个合理的年份。')
      return
    }
    const hash = Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0)
    const film: Film = {
      id: `custom-${slug(title) || 'film'}-${Date.now().toString(36).slice(-4)}`,
      title,
      titleZh: '',
      year,
      director: manual.director.trim() || 'Unknown director',
      runtime: Math.min(400, Math.max(20, Number(manual.runtime) || 110)),
      genres: [manual.genre],
      country: '个人条目',
      language: '—',
      tagline: '',
      logline: '手动加入片库。AI 分析只使用你写下的观影笔记。',
      cast: [],
      motif: MOTIFS[hash % MOTIFS.length],
      palette: PALETTES[hash % PALETTES.length],
      signature: { narrative: 0.5, emotion: 0.5, thematic: 0.4, visual: 0.5, character: 0.5, ending: 0.5 },
      themes: {},
      moods: {},
      narrativeTags: [],
      characterTags: [],
      externalSource: 'manual',
    }
    addCustomFilm(film)
    setSelected(film)
    setDraft((d) => ({ ...d, filmId: film.id }))
    setError('')
    setStep('form')
  }

  const commitRecord = (record: WatchRecord) => {
    upsertRecord(record, editRecord?.id)
  }

  const finishWithoutAi = (mode: 'skipped' | 'failed') => {
    if (!selected) return
    const recordId = editRecord?.id ?? uid('rec')
    const record = createRecordWithoutAnalysis(selected, draft, recordId, mode)
    commitRecord({
      ...record,
      ...(editRecord ? { createdAt: editRecord.createdAt } : {}),
    })
    if (editRecord) deleteAnalysis(editRecord.id)
    push(
      mode === 'skipped'
        ? '已保存，没有进行 AI 分析。之后可以在电影详情页再分析。'
        : 'AI 分析失败，电影和笔记已经保存。',
      'success',
    )
    goTo(`/archive/${selected.id}`)
  }

  const runAnalysis = async () => {
    if (!selected) return
    if (draft.rating <= 0) {
      setError('先给这部电影一个评分吧——半颗星也是一种信号。')
      return
    }
    if (draft.reflection.trim().length < 18) {
      setError('至少写一两句话。引擎读的是你的文字，不是电影简介。')
      return
    }
    setError('')
    setAiError(null)

    if (!isAiConfigured()) {
      setError('AI 服务还没有连接。可以先保存记录，之后在电影详情页再分析。')
      return
    }
    if (!consent) {
      setError('请先勾选授权，分析才能读取这次笔记。')
      return
    }

    const recordId = editRecord?.id ?? uid('rec')
    setAiConsent(true)
    const controller = new AbortController()
    abortRef.current = controller
    setActiveStage(0)
    setStep('analyzing')

    try {
      const response = await analyzeFilmMemory(
        {
          film: filmMetaForAi(selected),
          rating: draft.rating,
          watchedAt: draft.watchedAt,
          ...(draft.feltLike ? { feltLike: draft.feltLike } : {}),
          note: draft.reflection.trim(),
          history: buildAnalysisHistory(previousRecords, films, selected),
          locale: 'zh-CN',
        },
        { signal: controller.signal },
      )
      setActiveStage(1)
      const now = new Date().toISOString()
      const analysis = toFilmAnalysis(response, recordId, selected.id, now)
      const record = createRecordFromAnalysis(selected, draft, analysis, recordId)
      commitRecord({
        ...record,
        ...(editRecord ? { createdAt: editRecord.createdAt } : {}),
      })
      saveAnalysis(analysis)
      setActiveStage(2)
      setPending({ analysis, record })
      setStep('result')
      push(`《${selected.title}》已保存，AI 分析等待你的确认。`, 'success')
    } catch (cause) {
      if (controller.signal.aborted) {
        setStep('form')
        return
      }
      setAiError(cause)
      setStep('failed')
    } finally {
      abortRef.current = null
    }
  }

  const reset = () => {
    setStep('search')
    setSelected(null)
    setQuery('')
    setDraft({
      filmId: '',
      rating: 0,
      watchedAt: todayISO(),
      status: 'watched',
      reflection: '',
      feltLike: '',
    })
    setPending(null)
    setAiError(null)
    setActiveStage(-1)
    setConsent(state.settings.allowAiNotes)
    setError('')
    setStatus('idle')
    setHits([])
  }

  const currentIndex = STEP_INDEX[step]
  const yearLabel = selected?.year ? String(selected.year) : '年份未知'
  const runtimeLabel = selected?.runtime ? `${selected.runtime} 分钟` : '片长未知'
  const reviewLine = [
    selected?.titleZh,
    selected && selected.country !== '—' ? zhCountry(selected.country) : '',
    selected && selected.language !== '—' ? zhLanguage(selected.language) : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      hideClose={step === 'analyzing'}
      labelledBy="add-film-title"
      className="my-0 min-h-full sm:min-h-0"
    >
      <div className="sticky top-0 z-20 border-b border-white/10 bg-[#161c66] px-5 py-4 pr-14 sm:px-8 sm:pr-16">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="font-mono text-[14px] tracking-[0.18em] text-paper">
              {String(currentIndex + 1).padStart(2, '0')}
              <span className="text-paper-muted">/05</span>
            </span>
            <span className="truncate text-[13px] uppercase tracking-[0.18em] text-paper-dim sm:hidden">
              {STEP_LABELS[currentIndex]}
            </span>
          </div>
          <span className="font-display text-[20px] leading-none text-paper">
            {editRecord ? '编辑观影记忆' : '添加电影'}
          </span>
        </div>

        <ol className="mt-3 hidden items-center gap-2.5 sm:flex" aria-label="进度">
          {STEP_LABELS.map((label, index) => (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={cn(
                  'h-[2px] shrink-0 transition-all duration-500',
                  index === currentIndex ? 'w-7 bg-paper' : 'w-4 bg-white/25',
                  index < currentIndex && 'bg-paper/60',
                )}
              />
              <span
                className={cn(
                  'truncate text-[13px] tracking-[0.04em] lg:text-[13.5px]',
                  index === currentIndex
                    ? 'font-medium text-paper'
                    : index < currentIndex
                      ? 'text-paper-dim'
                      : 'text-paper-muted',
                )}
              >
                {label}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex gap-1.5 sm:hidden" aria-hidden="true">
          {STEP_LABELS.map((label, index) => (
            <span
              key={label}
              className={cn('h-[2px] flex-1', index <= currentIndex ? 'bg-paper/75' : 'bg-white/20')}
            />
          ))}
        </div>
      </div>

      {step === 'search' && (
        <div className="grid flex-1 gap-0 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="min-w-0 border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <p className="text-[12.5px] tracking-[0.06em] text-paper-dim">第一步</p>
            <h2
              id="add-film-title"
              className="mt-3 font-zh-title text-[2.2rem] leading-[1.15] text-paper sm:text-[2.9rem]"
            >
              你看了哪部电影？
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-[1.9] text-paper-dim">
              搜索电影名称，找到对应的影片后，就可以开始记录这次观影经历。
              可以输入中文或英文原名，也可以加上年份或导演来缩小范围。搜索结果会带回真实发行海报，绝不使用生成图片。
            </p>

            <label className="mt-7 flex items-center gap-3 border-b-2 border-paper/25 pb-3 focus-within:border-paper/70">
              <Search size={20} className="shrink-0 text-paper-dim" aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="输入电影名称，例如：疯狂动物城"
                className="w-full bg-transparent text-[19px] leading-tight text-paper outline-none placeholder:text-paper-muted focus-visible:outline-none"
                aria-label="搜索电影"
                autoComplete="off"
                spellCheck={false}
              />
              {status === 'loading' && (
                <Loader2 size={17} className="shrink-0 animate-spin text-paper-dim" />
              )}
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="shrink-0 text-[13px] tracking-[0.04em] text-paper-dim transition-colors hover:text-paper"
                >
                  清空
                </button>
              )}
            </label>

            <div className="mt-6">
              {status === 'idle' && (
                <div className="border border-dashed border-white/20 p-5 sm:p-6">
                  <p className="text-[15px] leading-[1.9] text-paper-dim">
                    输入片名开始搜索。中英文都可以，片名后加上年份可以缩小范围。
                    <span className="mt-1.5 block text-paper-muted">也可以输入英文原名，例如：Zootopia。</span>
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {EXAMPLES.map((example) => (
                      <button
                        key={example}
                        type="button"
                        onClick={() => setQuery(example)}
                        className="border border-white/20 px-3 py-1.5 text-[15px] text-paper-dim transition-colors hover:border-paper/50 hover:text-paper"
                      >
                        {example}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {status === 'loading' && (
                <ul className="divide-y divide-white/10" aria-label="正在搜索">
                  {[0, 1, 2].map((row) => (
                    <li key={row} className="flex items-center gap-4 py-4">
                      <span className="h-[84px] w-[56px] shrink-0 animate-pulse bg-white/[0.06]" />
                      <span className="flex-1 space-y-2">
                        <span className="block h-3 w-2/3 animate-pulse bg-white/[0.08]" />
                        <span className="block h-2.5 w-1/3 animate-pulse bg-white/[0.06]" />
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {status === 'error' && searchError && (
                <div className="border border-white/20 p-5">
                  <p className="flex items-center gap-2 text-[15px] font-medium text-paper">
                    <TriangleAlert size={16} /> 无法连接电影资料库。
                  </p>
                  <p className="mt-2 text-[15px] leading-[1.9] text-paper-dim">
                    {searchError.kind === 'network'
                      ? '网络连接失败，请检查网络后重试。'
                      : searchError.kind === 'rate-limit'
                        ? '请求过于频繁，请稍后再试。'
                        : searchError.kind === 'auth'
                          ? '资料库暂时无法验证这次请求，请稍后重试。'
                          : '资料库暂时没有回应，请稍后重试。'}
                  </p>
                  {searchError.status && (
                    <p className="mt-2 font-mono text-[12px] tracking-[0.06em] text-paper-muted">
                      诊断信息 · {searchError.kind} · HTTP {searchError.status}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRetryTick((tick) => tick + 1)}
                      className="btn btn-ghost h-10 px-4 text-[14px]"
                    >
                      <RefreshCw size={13} /> 重新尝试
                    </button>
                    <button type="button" onClick={startManual} className="btn btn-ghost h-10 px-4 text-[14px]">
                      <Plus size={13} /> 手动添加
                    </button>
                  </div>
                </div>
              )}

              {status === 'ready' && hits.length === 0 && (
                <div className="border border-dashed border-white/20 p-5">
                  <p className="text-[16px] text-paper">没有找到符合条件的电影。</p>
                  <p className="mt-2 text-[15px] leading-[1.9] text-paper-dim">
                    可以换一个片名，或手动添加。手动添加不会伪造海报，也不会生成外部编号。
                  </p>
                  <button
                    type="button"
                    onClick={startManual}
                    className="btn btn-ghost mt-4 h-10 px-4 text-[14px]"
                  >
                    <Plus size={13} /> 手动添加
                  </button>
                </div>
              )}

              {status === 'ready' && hits.length > 0 && (
                <>
                  <ul className="max-h-[min(52vh,30rem)] divide-y divide-white/10 overflow-y-auto pr-1">
                    {hits.map((hit, index) => (
                      <li key={hit.key}>
                        <button
                          type="button"
                          onClick={() => chooseHit(hit)}
                          className="group flex w-full items-start gap-4 py-4 text-left transition-colors hover:bg-white/[0.03]"
                          aria-label={
                            hit.inArchive
                              ? `${hit.title} 已在你的片库中，打开它的观影记忆。`
                              : `选择 ${hit.title}${hit.year ? `（${hit.year}）` : ''}`
                          }
                        >
                          <HitPoster hit={hit} eager={index < 4} />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                              <span className="font-display text-[19px] leading-tight text-paper">
                                {hit.title}
                              </span>
                              {hit.year ? (
                                <span className="font-mono text-[14px] text-paper-dim">{hit.year}</span>
                              ) : null}
                              {hit.inArchive && (
                                <span className="border border-paper/30 px-1.5 py-0.5 text-[12.5px] tracking-[0.04em] text-paper-dim">
                                  已在片库
                                </span>
                              )}
                            </span>
                            {hit.titleZh && (
                              <span className="mt-1 block text-[15px] text-paper-dim">
                                {hit.titleZh}
                              </span>
                            )}
                            {hit.originalTitle && (
                              <span className="mt-1 block text-[15px] italic text-paper-muted">
                                {hit.originalTitle}
                              </span>
                            )}
                            <span className="mt-1.5 block truncate text-[15px] text-paper-muted">
                              {[zhGenres(hit.genres.slice(0, 3)), hit.inArchive ? '打开观影记忆' : '']
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          <ChevronRight
                            size={17}
                            className="mt-1 shrink-0 text-paper-muted transition-transform group-hover:translate-x-1 group-hover:text-paper"
                          />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={startManual}
                    className="mt-2 inline-flex items-center gap-2 py-3 text-[15px] text-paper-dim underline underline-offset-4 transition-colors hover:text-paper"
                  >
                    <Plus size={13} /> 找不到？手动添加
                  </button>
                </>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 pt-4 text-[14px] text-paper-muted">
                <span>
                  资料来源：IMDb · 无需 API Key
                  {tmdbToken ? ' · TMDB 已连接' : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setTokenDraft(tmdbToken)
                    setTmdbOpen((openState) => !openState)
                  }}
                  className="uppercase tracking-[0.12em] text-paper-dim underline underline-offset-4 hover:text-paper"
                >
                  {tmdbOpen ? '关闭' : tmdbToken ? '管理 TMDB' : '连接 TMDB'}
                </button>
              </div>

              {tmdbOpen && (
                <div className="mt-4 border border-white/15 p-4">
                  <p className="text-[15px] leading-[1.9] text-paper-dim">
                    添加 TMDB 读取令牌（v4），可以获得更完整的中文片名和电影资料。令牌只保存在这台设备的浏览器里，不会上传或提交。
                    部分网络可能无法连接 TMDB，此时 IMDb 的搜索结果仍然可用。
                  </p>
                  <input
                    type="password"
                    value={tokenDraft}
                    onChange={(event) => setTokenDraft(event.target.value)}
                    placeholder="TMDB 读取令牌"
                    className="mt-3 w-full border-b border-white/25 bg-transparent py-2 text-[15px] text-paper outline-none placeholder:text-paper-muted focus:border-paper/60"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={saveToken}
                      disabled={!tokenDraft.trim()}
                      className="btn btn-ghost h-9 px-3 text-[14px]"
                    >
                      保存令牌
                    </button>
                    {tmdbToken && (
                      <button
                        type="button"
                        onClick={removeToken}
                        className="btn btn-quiet h-9 px-2 text-[14px]"
                      >
                        移除
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="hidden flex-col justify-between p-8 lg:flex">
            <div>
              <p className="text-[12px] tracking-[0.06em] text-paper-muted">记录一部电影</p>
              <ol className="mt-6 space-y-6">
                {RITUAL.map((step) => (
                  <li key={step.no} className="flex gap-4">
                    <span className="mt-0.5 font-mono text-[13px] text-paper-dim">
                      {step.no}
                    </span>
                    <span>
                      <span className="block font-zh-ui text-[15px] leading-snug text-paper">{step.title}</span>
                      <span className="mt-1.5 block text-[14.5px] leading-[1.85] text-paper-dim">
                        {step.body}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <blockquote className="border-l border-paper/30 pl-5">
              <p className="font-display text-[24px] italic leading-snug text-paper/85">
                “{BRAND_LINE_EN}”
              </p>
            </blockquote>
          </aside>
        </div>
      )}

      {step === 'manual' && (
        <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_0.8fr]">
          <div className="min-w-0 border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r">
            <button
              type="button"
              onClick={() => setStep('search')}
              className="inline-flex items-center gap-2 text-[14px] uppercase tracking-[0.16em] text-paper-dim hover:text-paper"
            >
              <ArrowLeft size={13} /> 返回搜索
            </button>
            <h2 className="mt-6 font-zh-title text-[2rem] leading-tight text-paper sm:text-[2.4rem]">
              资料库里没有的电影
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-[1.9] text-paper-dim">
              尽量填写准确的信息。系统会按片名和年份匹配已核验的海报；如果没有，片库会显示设计好的占位图，而不是伪造图片。
            </p>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="field-label">
                  片名{' '}
                  <span className="normal-case tracking-normal text-paper-muted">必填</span>
                </span>
                <input
                  autoFocus
                  className="input"
                  value={manual.title}
                  onChange={(e) => setManual({ ...manual, title: e.target.value })}
                  placeholder="你看过的那部电影"
                />
              </label>
              <label>
                <span className="field-label">年份</span>
                <input
                  className="input"
                  value={manual.year}
                  inputMode="numeric"
                  onChange={(e) =>
                    setManual({ ...manual, year: e.target.value.replace(/[^0-9]/g, '').slice(0, 4) })
                  }
                />
              </label>
              <label>
                <span className="field-label">片长（分钟）</span>
                <input
                  className="input"
                  value={manual.runtime}
                  inputMode="numeric"
                  onChange={(e) =>
                    setManual({ ...manual, runtime: e.target.value.replace(/[^0-9]/g, '') })
                  }
                />
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">导演</span>
                <input
                  className="input"
                  value={manual.director}
                  onChange={(e) => setManual({ ...manual, director: e.target.value })}
                  placeholder="可选"
                />
              </label>
              <label className="sm:col-span-2">
                <span className="field-label">主要类型</span>
                <select
                  className="input"
                  value={manual.genre}
                  onChange={(e) => setManual({ ...manual, genre: e.target.value })}
                >
                  {GENRES.map((g) => (
                    <option key={g} value={g}>
                      {zhGenre(g)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {error && <p className="mt-5 text-[15px] text-[#e0a898]">{error}</p>}

            <div className="mt-8 flex gap-3">
              <button type="button" onClick={createManual} className="btn btn-primary">
                继续 <ArrowRight size={14} />
              </button>
              <button type="button" onClick={() => setStep('search')} className="btn btn-ghost">
                取消
              </button>
            </div>
          </div>
          <div className="hidden items-center justify-center bg-white/[0.015] p-8 lg:flex">
            <div className="w-full max-w-[260px]">
              <div className="aspect-[2/3] w-full border border-white/10">
                <FilmPoster
                  film={{
                    id: 'manual-preview',
                    title: manual.title || '未命名',
                    titleZh: '',
                    year: Number(manual.year) || 2026,
                    director: manual.director || 'Unknown director',
                    runtime: Number(manual.runtime) || 110,
                    genres: [manual.genre],
                    country: '个人条目',
                    language: '—',
                    tagline: '',
                    logline: '',
                    cast: [],
                    motif: 'orbit',
                    palette: PALETTES[0],
                    signature: {
                      narrative: 0.5,
                      emotion: 0.5,
                      thematic: 0.4,
                      visual: 0.5,
                      character: 0.5,
                      ending: 0.5,
                    },
                    themes: {},
                    moods: {},
                    narrativeTags: [],
                    characterTags: [],
                  }}
                />
              </div>
              <p className="mt-3 text-center text-[12.5px] tracking-[0.06em] text-paper-muted">
                封面预览
              </p>
            </div>
          </div>
        </div>
      )}

      {(step === 'review' || step === 'form') && selected && (
        <div className="grid flex-1 gap-0 lg:grid-cols-[0.82fr_1fr]">
          <div
            className={cn(
              'min-w-0 border-b border-white/10 p-5 sm:p-8 lg:border-b-0 lg:border-r',
              step === 'form' && 'hidden lg:block',
            )}
          >
            <div className="mx-auto w-full max-w-[240px] sm:max-w-[300px]">
              <div className="aspect-[2/3] w-full border border-white/10">
                <FilmPoster film={selected} eager />
              </div>
              <div className="mt-5 flex items-start justify-between gap-3 border-t border-white/10 pt-4">
                <div>
                  <h3 className="font-display text-[26px] leading-tight text-paper">{selected.title}</h3>
                  <p className="mt-1 text-[15px] text-paper-dim">
                    {yearLabel} · {selected.director}
                  </p>
                  {selected.titleZh && (
                    <p className="mt-1 text-[15px] text-paper-muted">{selected.titleZh}</p>
                  )}
                </div>

              </div>
              <p className="mt-3 text-[14.5px] leading-[1.85] text-paper-dim">{loglineOf(selected)}</p>
              {detailLoading && (
                <p className="mt-2 flex items-center gap-2 text-[14px] text-paper-muted">
                  <Loader2 size={12} className="animate-spin" /> 正在读取电影资料……
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-1.5">
                {selected.genres.map((g) => (
                  <span key={g} className="tag">
                    {zhGenre(g)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 p-5 sm:p-8">
            {step === 'review' ? (
              <div className="flex h-full flex-col">
                <button
                  type="button"
                  onClick={() => {
                    if (editRecord) return
                    setStep('search')
                    setSelected(null)
                  }}
                  className="inline-flex items-center gap-2 text-[14px] uppercase tracking-[0.16em] text-paper-dim hover:text-paper"
                >
                  <ArrowLeft size={13} /> 重新选择
                </button>
                <p className="text-[12.5px] tracking-[0.06em] text-paper-dim">第二步</p>
                <h2 className="mt-3 font-zh-title text-[2rem] leading-tight text-paper sm:text-[2.4rem]">
                  确认影片
                </h2>
                <p className="mt-3 text-[14.5px] leading-[1.85] text-paper-dim">
                  请确认电影名称和上映年份，确保选择的是正确的版本。
                </p>
                {reviewLine && (
                  <p className="mt-3 text-[15px] leading-relaxed text-paper-dim">{reviewLine}</p>
                )}

                <dl className="mt-8 divide-y divide-white/10 border-y border-white/10 text-[15px]">
                  {[
                    ['导演', directorOf(selected)],
                    ['上映年份', selected.year ? String(selected.year) : '未知'],
                    ['片长', runtimeLabel],
                    ['主演', selected.cast.slice(0, 3).join('、') || '—'],
                    ['类型', zhGenres(selected.genres) || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-baseline justify-between gap-6 py-3.5">
                      <dt className="text-paper-dim">{label}</dt>
                      <dd className="max-w-[65%] text-right text-paper">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-auto flex flex-wrap gap-3 pt-8">
                  <button type="button" onClick={() => setStep('form')} className="btn btn-primary">
                    就是这部 <ArrowRight size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('search')
                      setQuery(selected.title)
                    }}
                    className="btn btn-ghost"
                  >
                    不太对
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12.5px] tracking-[0.06em] text-paper-dim">第三步</p>
                  {!editRecord && (
                    <button
                      type="button"
                      onClick={() => setStep('review')}
                      className="inline-flex items-center gap-2 text-[14px] uppercase tracking-[0.16em] text-paper-dim hover:text-paper"
                    >
                      <ArrowLeft size={13} /> 影片信息
                    </button>
                  )}
                </div>
                <h2
                  id="add-film-title"
                  className="mt-3 font-zh-title text-[2rem] leading-tight text-paper sm:text-[2.4rem]"
                >
                  {editRecord ? '重写这段记忆' : '记录观影感受'}
                </h2>
                <p className="mt-2 font-mono text-[14px] uppercase tracking-[0.12em] text-paper lg:hidden">
                  {selected.title} · {yearLabel}
                </p>
                <p className="mt-3 max-w-xl text-[15px] leading-[1.9] text-paper-dim">
                  这部电影给你留下了什么印象？不需要写得很正式，记录真实的想法就好。
                  不用写剧情简介，只写它对你做了什么。分析会从这段文字里读取主题和情绪；只有你主动勾选授权后，才会把这次记录发送给在线 AI 服务。
                </p>

                <div className="mt-7 grid gap-7">
                  <div>
                    <span className="field-label">我的评分</span>
                    <RatingInput
                      value={draft.rating}
                      onChange={(rating) => setDraft({ ...draft, rating })}
                    />
                  </div>

                  <div className="grid gap-6 sm:grid-cols-2">
                    <label>
                      <span className="field-label">观看日期</span>
                      <input
                        type="date"
                        className="input"
                        max={todayISO()}
                        value={draft.watchedAt}
                        onChange={(e) => setDraft({ ...draft, watchedAt: e.target.value })}
                      />
                    </label>
                    <div>
                      <span className="field-label">观看状态</span>
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(STATUS_LABELS) as Array<keyof typeof STATUS_LABELS>).map((key) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setDraft({ ...draft, status: key })}
                            className="chip"
                            data-active={draft.status === key}
                          >
                            {STATUS_LABELS[key].zh}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="field-label">
                      <span>我的观影笔记</span>
                      <span className="normal-case tracking-normal text-paper-muted">
                        {draft.reflection.trim().length} 字
                      </span>
                    </div>
                    <textarea
                      value={draft.reflection}
                      onChange={(e) => {
                        setDraft({ ...draft, reflection: e.target.value })
                        if (error) setError('')
                      }}
                      rows={6}
                      placeholder="从那个你还能看见的场景开始。然后写它让你想起了什么——一个人、一年，或者某个版本的自己。"
                      className="input input-boxed min-h-[9rem] resize-y text-[15px] leading-relaxed"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        '什么留下来了？',
                        '它让你想起了什么？',
                        '哪一个场景？',
                        '它最后把你留在了哪里？',
                      ].map((prompt) => (
                        <span key={prompt} className="text-[14px] text-paper-muted">
                          · {prompt}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="field-label">看完之后，你的感觉是？（可选）</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(MOODS) as MoodId[]).slice(0, 8).map((mood) => (
                        <button
                          key={mood}
                          type="button"
                          onClick={() =>
                            setDraft({ ...draft, feltLike: draft.feltLike === mood ? '' : mood })
                          }
                          className="chip h-8 text-[13px]"
                          data-active={draft.feltLike === mood}
                        >
                          {MOODS[mood].zh}
                        </button>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 border-l border-white/15 pl-3">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => {
                        setConsent(event.target.checked)
                        setAiConsent(event.target.checked)
                      }}
                      className="mt-0.5 h-4 w-4 accent-[#b98b63]"
                    />
                    <span className="text-[13.5px] leading-[1.7] text-paper-dim">
                      允许把这部电影的笔记发送给在线 AI 服务（可选）。只会发送这部片的信息、这次笔记和少量相关旧片摘要，不会发送整个片库。
                      <span className="mt-1 block text-[12.5px] text-paper-muted">
                        不勾选时不会生成 AI 解读；你仍然可以只保存这条记录，之后再分析。
                      </span>
                    </span>
                  </label>

                  {error && (
                    <p className="border-l border-[#c07a66] bg-[#c07a66]/10 px-3 py-2 text-[15px] text-[#e8b2a2]">
                      {error}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 border-t border-white/10 pt-6">
                    <button
                      type="button"
                      onClick={runAnalysis}
                      disabled={!isAiConfigured() || !consent}
                      className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles size={14} />
                      {editRecord ? '保存并重新分析' : '开始 AI 分析'}
                    </button>
                    <span className="text-[14px] text-paper-muted">
                      {!isAiConfigured()
                        ? 'AI 服务未连接 · 可以先只保存记录'
                        : consent
                          ? '在线 AI 分析 · 约 10–30 秒'
                          : '需要先勾选授权'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'analyzing' && selected && (
        <div className="grid flex-1 lg:grid-cols-[0.7fr_1fr]">
          <div className="relative hidden overflow-hidden border-r border-white/10 lg:block">
            <FilmPoster film={selected} />
            <div className="absolute inset-0 bg-black/35" />
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute left-0 right-0 h-24 animate-scan bg-gradient-to-b from-transparent via-paper/20 to-transparent" />
            </div>
            <div className="absolute bottom-6 left-6 right-6">
              <p className="text-[12px] tracking-[0.06em] text-paper/90">正在分析</p>
              <p className="mt-2 font-display text-[32px] leading-tight text-paper">{selected.title}</p>
            </div>
          </div>

          <div className="flex flex-col justify-center p-6 sm:p-10">
            <p className="text-[12px] tracking-[0.06em] text-paper-dim">
              在线 AI 分析 · 已等待 {elapsed} 秒
            </p>
            <h2 id="add-film-title" className="mt-3 font-zh-title text-[1.9rem] leading-tight text-paper">
              正在听你写下的内容
            </h2>
            <p className="mt-3 max-w-md text-[15px] leading-[1.9] text-paper-dim">
              后端正在调用已配置的模型服务。模型密钥只保存在服务端，不会出现在浏览器里。
            </p>

            <ol className="mt-9 space-y-1">
              {AI_PHASES.map((phase, index) => {
                const done = index < activeStage
                const active = index === activeStage
                return (
                  <li
                    key={phase.label}
                    className={cn(
                      'flex items-start gap-4 border-l py-3 pl-4 transition-all duration-500',
                      done
                        ? 'border-paper/30 opacity-70'
                        : active
                          ? 'border-paper bg-paper/[0.04]'
                          : 'border-white/10 opacity-40',
                    )}
                  >
                    <span className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center border border-current text-[12.5px]">
                      {done ? (
                        <Check size={12} className="text-paper" />
                      ) : active ? (
                        <Loader2 size={12} className="animate-spin text-paper" />
                      ) : (
                        <span className="font-mono text-paper-muted">{index + 1}</span>
                      )}
                    </span>
                    <span>
                      <span
                        className={cn(
                          'block text-[15px]',
                          active ? 'text-paper' : done ? 'text-paper-dim' : 'text-paper-muted',
                        )}
                      >
                        {phase.label}
                      </span>
                      <span className="mt-1 block text-[15px] leading-relaxed text-paper-dim">
                        {phase.detail}
                      </span>
                    </span>
                  </li>
                )
              })}
            </ol>

            <p className="mt-8 max-w-md text-[13px] leading-[1.8] text-paper-muted">
              在线模型通常需要 10–30 秒。分析完成前不会写入任何结果；如果超时或失败，你可以重试或先保存记录。
            </p>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="btn btn-quiet mt-5 w-fit"
            >
              取消分析
            </button>
          </div>
        </div>
      )}

      {step === 'failed' && selected && (
        <div className="flex flex-1 flex-col justify-center p-6 sm:p-10">
          <div className="mx-auto w-full max-w-xl">
            <p className="text-[12px] tracking-[0.06em] text-[#e8b2a2]">AI 分析没有完成</p>
            <h2 id="add-film-title" className="mt-3 font-zh-title text-[1.9rem] leading-tight text-paper">
              《{selected.title}》还没有被分析
            </h2>
            <p className="mt-3 text-[15px] leading-[1.9] text-paper-dim">{aiErrorMessage(aiError)}</p>
            <ul className="mt-6 space-y-2 border-l border-white/15 pl-4 text-[14px] leading-[1.8] text-paper-dim">
              <li>· 你的笔记和评分还在，没有丢失。</li>
              <li>· 没有写入任何伪造的分析结果。</li>
              <li>· 你可以重试，也可以先保存，之后在电影详情页再分析。</li>
            </ul>
            <p className="mt-5 font-mono text-[12.5px] tracking-[0.08em] text-paper-muted">
              ERROR · {aiErrorCode(aiError) ?? 'UNKNOWN'}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={runAnalysis} className="btn btn-primary">
                <RefreshCw size={13} /> 重试分析
              </button>
              <button
                type="button"
                onClick={() => finishWithoutAi('failed')}
                className="btn btn-ghost"
              >
                保存但不分析
              </button>
              <button type="button" onClick={() => setStep('form')} className="btn btn-quiet">
                返回修改笔记
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'result' && selected && pending && (
        <div className="flex flex-1 flex-col">
          <div className="border-b border-white/10 p-5 sm:p-8">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="text-[12px] tracking-[0.06em] text-paper-dim">
                  第五步 · 已保存，等待你的确认
                </p>
                <h2
                  id="add-film-title"
                  className="mt-3 font-zh-title text-[2rem] leading-tight text-paper sm:text-[2.5rem]"
                >
                  《{selected.title}》已经进入片库
                </h2>
                <p className="mt-3 max-w-2xl text-[15px] leading-[1.9] text-paper-dim">
                  {pending.analysis.summary}
                </p>
                <p className="mt-3 text-[12.5px] leading-[1.7] text-paper-muted">
                  这次分析来自 {pending.analysis.model.provider} · {pending.analysis.model.model}。
                  {formatLongDate(pending.analysis.model.analyzedAt.slice(0, 10))}。
                  在你确认之前，它不会计入六维画像。
                </p>
              </div>
              <div className="flex items-center gap-6 border-l border-white/10 pl-6">
                <div>
                  <p className="micro-sm text-paper-muted">单次分析置信度</p>
                  <p className="num mt-1 text-[26px] text-paper">
                    {Math.round(pending.analysis.confidence * 100)}
                    <span className="ml-0.5 text-[15px] text-paper-muted">%</span>
                  </p>
                </div>
                <div>
                  <p className="micro-sm text-paper-muted">片库</p>
                  <p className="num mt-1 text-[26px] text-paper">
                    {String(records.length).padStart(2, '0')}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid flex-1 gap-0 lg:grid-cols-[1fr_1.1fr_0.9fr]">
            <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="micro text-paper-muted">AI 在你笔记里读到的情绪</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {pending.analysis.observed_emotions.length > 0 ? (
                  pending.analysis.observed_emotions.map((item) => (
                    <span key={item.mood} className="tag border-paper/30 bg-paper/[0.06] text-paper">
                      {MOODS[item.mood]?.zh ?? item.mood}
                    </span>
                  ))
                ) : (
                  <p className="text-[15px] text-paper-dim">没有识别到明确的情绪表达。</p>
                )}
              </div>

              <p className="micro mt-8 text-paper-muted">主题</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {pending.analysis.themes_identified.map((item) => (
                  <span key={item.theme} className="tag">
                    {THEMES[item.theme]?.zh ?? item.theme}
                  </span>
                ))}
                {pending.analysis.themes_identified.length === 0 && (
                  <p className="text-[15px] text-paper-dim">这次笔记没有指向明确主题。</p>
                )}
              </div>

              {pending.analysis.liked.length > 0 && (
                <div className="mt-8 border-t border-white/10 pt-5">
                  <p className="micro text-paper-muted">你具体喜欢的地方</p>
                  <ul className="mt-3 space-y-2 text-[14.5px] leading-[1.8] text-paper-dim">
                    {pending.analysis.liked.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {pending.analysis.disliked.length > 0 && (
                <div className="mt-6">
                  <p className="micro text-paper-muted">你具体不喜欢的地方</p>
                  <ul className="mt-3 space-y-2 text-[14.5px] leading-[1.8] text-paper-dim">
                    {pending.analysis.disliked.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="border-b border-white/10 p-5 sm:p-7 lg:border-b-0 lg:border-r">
              <p className="micro text-paper-muted">它说明了什么偏好</p>
              <ul className="mt-5 space-y-5">
                {pending.analysis.preference_evidence.map((item, index) => {
                  const def = DIMENSION_MAP[item.dimension_id]
                  const pole =
                    item.direction === 'high'
                      ? def.highZh
                      : item.direction === 'low'
                        ? def.lowZh
                        : '没有明确方向'
                  return (
                    <li key={`${item.dimension_id}-${index}`}>
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[14px] tracking-[0.06em] text-paper">
                          {def.labelZh}
                        </span>
                        <span className="font-mono text-[12.5px] text-paper-muted">
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                      <p className="mt-1 text-[14px] leading-[1.7] text-paper-dim">{pole}</p>
                      <p className="mt-2 text-[14.5px] leading-[1.8] text-paper">{item.evidence}</p>
                      {item.quote && (
                        <p className="mt-2 border-l border-paper/25 pl-3 text-[13.5px] leading-[1.8] text-paper-muted">
                          “{item.quote}”
                        </p>
                      )}
                    </li>
                  )
                })}
              </ul>

              {pending.analysis.uncertainties.length > 0 && (
                <div className="mt-7 border-t border-white/10 pt-5">
                  <p className="micro text-paper-muted">AI 不确定的地方</p>
                  <ul className="mt-3 space-y-2 text-[14px] leading-[1.8] text-paper-dim">
                    {pending.analysis.uncertainties.map((item) => (
                      <li key={item}>· {item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex flex-col p-5 sm:p-7">
              <div className="border border-white/10 p-4">
                <p className="micro text-paper-dim">这一帧</p>
                <div className="mt-3 aspect-[2/3] w-full max-w-[150px]">
                  <FilmPoster film={selected} showTitle={false} />
                </div>
                <p className="mt-3 text-[13px] uppercase tracking-[0.14em] text-paper-dim">
                  {formatLongDate(pending.record.watchedAt)} ·{' '}
                  {STATUS_LABELS[pending.record.status].zh}
                </p>
                <Rating value={pending.record.rating} tone="dark" className="mt-2" />
              </div>

              {pending.analysis.related_films.length > 0 && (
                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="micro text-paper-muted">相关电影</p>
                  <ul className="mt-3 space-y-3">
                    {pending.analysis.related_films.map((item) => {
                      const film = filmById(films, item.filmId)
                      if (!film) return null
                      return (
                        <li key={item.filmId}>
                          <button
                            type="button"
                            onClick={() => goTo(`/archive/${film.id}`)}
                            className="group text-left"
                          >
                            <span className="flex items-center gap-2 text-[15px] text-paper">
                              {film.title}
                              <ArrowRight size={11} className="text-paper-muted" />
                            </span>
                            <span className="mt-1 block text-[13.5px] leading-[1.7] text-paper-dim">
                              {item.explanation}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}

              <div className="mt-auto space-y-2 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    reviewAnalysis(pending.record.id, 'accepted')
                    goTo('/taste')
                  }}
                  className="btn btn-primary w-full"
                >
                  接受并纳入画像 <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    reviewAnalysis(pending.record.id, 'rejected')
                    goTo(`/archive/${selected.id}`)
                  }}
                  className="btn btn-ghost w-full"
                >
                  不接受这次判断
                </button>
                <button
                  type="button"
                  onClick={() => goTo(`/archive/${selected.id}`)}
                  className="btn btn-quiet w-full"
                >
                  先保存，稍后再看
                </button>
                <button type="button" onClick={reset} className="btn btn-quiet w-full">
                  <Plus size={13} /> 再添加一部
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </Modal>
  )
}