import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, Printer, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { FilmPoster } from '@/components/film/FilmPoster'
import { EmptyState } from '@/components/ui/Primitives'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { DIMENSIONS, MOODS, THEMES } from '@/data/taxonomy'
import {
  computeSnapshot,
  favoriteRecord,
  filmById,
  monthlyStats,
  summarizeTaste,
  splitPeriods,
} from '@/lib/tasteEngine'
import { formatLongDate, formatMinutes, percent, uid } from '@/lib/format'
import type { Film, MoodId, ThemeId, WatchRecord } from '@/types'

const escapeHtml = (text: string): string =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const monthName = (iso: string): string => {
  const month = Number(iso.slice(5, 7))
  return Number.isFinite(month) && month > 0 ? `${month} 月` : '本月'
}

const Yearbook = ({
  year,
  records,
  summary,
  themes,
  moods,
  favourite,
  hours,
}: {
  year: number
  records: WatchRecord[]
  summary: string[]
  themes: Array<{ id: ThemeId; count: number }>
  moods: Array<{ id: MoodId; count: number }>
  favourite: { record: WatchRecord; film: Film } | null
  hours: number
}) => {
  return (
    <div className="paper-sheet on-paper paper-texture relative px-7 py-10 sm:px-12 sm:py-14">
      <div className="flex items-start justify-between border-b border-[#171512]/20 pb-4">
        <div>
          <p className="micro text-[#7a7264]">Frame by Frame · 年度特刊</p>
          <p className="mt-2 font-zh-title text-[1.8rem] leading-tight text-[#171512]">一年，在帧与帧之间</p>
        </div>
        <div className="text-right">
          <p className="num text-5xl leading-none text-[#171512]">{year}</p>
          <p className="mt-1 text-[12px] tracking-[0.06em] text-[#7a7264]">{records.length} 部电影</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-4">
        {[
          ['电影', String(records.length).padStart(2, '0')],
          ['小时', hours.toFixed(1)],
          ['平均评分', (records.reduce((s, r) => s + r.rating, 0) / Math.max(records.length, 1)).toFixed(1)],
          ['重看', String(records.filter((r) => r.status === 'rewatched').length).padStart(2, '0')],
        ].map(([label, value]) => (
          <div key={label}>
            <p className="text-[12px] tracking-[0.04em] text-[#7a7264]">{label}</p>
            <p className="num mt-1 text-3xl leading-none text-[#171512]">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 sm:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="micro text-[#7a7264]">这一年，用一段话说</p>
          <div className="mt-3 space-y-2">
            {summary.map((sentence, i) => (
              <p key={i} className="text-[14px] leading-[1.9] text-[#2c2822]">
                {sentence}
              </p>
            ))}
          </div>

          <div className="mt-8">
            <p className="micro text-[#7a7264]">反复回来的主题</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {themes.slice(0, 6).map((theme) => (
                <span
                  key={theme.id}
                  className="border border-[#171512]/25 px-2.5 py-1 text-[12px] tracking-[0.04em] text-[#3a3428]"
                >
                  {THEMES[theme.id].zh} · {theme.count}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="micro text-[#7a7264]">情绪</p>
            <p className="mt-2 font-zh-title text-[1.5rem] leading-tight text-[#171512]">
              {moods
                .slice(0, 3)
                .map((m) => MOODS[m.id].zh)
                .join(' · ')}
            </p>
          </div>
        </div>

        <div>
          {favourite && (
            <div>
              <p className="micro text-[#7a7264]">我留下的那一帧</p>
              <div className="mt-3 flex gap-4">
                <div className="w-[92px] shrink-0">
                  <div className="aspect-[2/3] w-full overflow-hidden">
                    <FilmPoster film={favourite.film} showTitle={false} />
                  </div>
                </div>
                <div>
                  <p className="font-display text-2xl leading-none text-[#171512]">
                    {favourite.film.title}
                  </p>
                  {favourite.film.titleZh && (
                    <p className="mt-1 text-[13px] tracking-[0.04em] text-[#3a3428]">{favourite.film.titleZh}</p>
                  )}
                  <p className="mt-1 text-[12px] tracking-[0.04em] text-[#7a7264]">
                    {favourite.film.director} · {favourite.film.year}
                  </p>
                  <p className="mt-2 font-mono text-[13px] text-[#3a3428]">
                    ★ {favourite.record.rating.toFixed(1)}
                  </p>
                </div>
              </div>
              <p className="mt-4 border-l border-[#29251f]/50 pl-3 font-zh-body text-[14px] leading-[1.85] text-[#3a3428]">
                “{favourite.record.reflection}”
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 flex flex-col justify-between gap-2 border-t border-[#171512]/20 pt-4 sm:flex-row sm:items-center">
        <p className="text-[12px] tracking-[0.08em] text-[#7a7264]">
          本地生成 · Frame by Frame · {year}
        </p>
        <p className="text-[12px] tracking-[0.08em] text-[#7a7264]">
          一份私人记录，不是公开调查
        </p>
      </div>
    </div>
  )
}

const buildYearbookHtml = (params: {
  year: number
  records: WatchRecord[]
  favorite: { record: WatchRecord; film: Film } | null
  summary: string[]
  themes: Array<{ id: ThemeId; count: number }>
  moods: Array<{ id: MoodId; count: number }>
  hours: number
}): string => {
  const { year, records, favorite, summary, themes, moods, hours } = params
  const mean = (records.reduce((s, r) => s + r.rating, 0) / Math.max(records.length, 1)).toFixed(1)
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" />
<title>Frame by Frame — ${year} 年度回顾</title>
<style>
  :root { --ink:#171412; --paper:#f2f0eb; --muted:#91816b; --line:rgba(23,20,18,.18); --brass:#29251f; }
  * { box-sizing: border-box; }
  body { margin:0; background:#0a0a0b; color:var(--ink); font-family: "Noto Sans SC", "PingFang SC", "Microsoft YaHei", Georgia, serif; }
  .sheet { max-width: 880px; margin: 32px auto; background: var(--paper); padding: 64px 72px; }
  .micro { font-family: "PingFang SC", "Microsoft YaHei", Helvetica, Arial, sans-serif; font-size: 10px; letter-spacing: .16em; color: var(--muted); }
  h1, h2, h3 { font-weight: 600; margin: 0; }
  h1 { font-size: 40px; line-height: 1.1; letter-spacing: .02em; }
  .masthead { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--line); padding-bottom:16px; }
  .grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-top: 32px; }
  .num { font-size: 32px; line-height: 1; font-family: "IBM Plex Mono", Consolas, monospace; }
  .section { margin-top: 40px; }
  .cols { display:grid; grid-template-columns: 1.1fr .9fr; gap: 40px; }
  p { font-size: 14px; line-height: 1.9; color: #2c2822; margin: 8px 0; }
  .quote { border-left: 1px solid var(--brass); padding-left: 16px; font-size: 14px; line-height: 1.9; }
  .tag { display:inline-block; border:1px solid rgba(23,21,18,.25); padding: 4px 9px; margin: 3px 4px 3px 0; font-size: 11px; letter-spacing:.04em; }
  .foot { margin-top: 48px; border-top:1px solid var(--line); padding-top:16px; display:flex; justify-content:space-between; }
  @media print { body { background:#fff; } .sheet { margin:0; max-width:none; } }
</style></head>
<body><div class="sheet">
  <div class="masthead">
    <div><div class="micro">Frame by Frame · 年度特刊</div><h1 style="margin-top:10px">一年，在帧与帧之间</h1></div>
    <div style="text-align:right"><div class="num">${year}</div><div class="micro" style="margin-top:6px">${records.length} 部电影</div></div>
  </div>
  <div class="grid">
    <div><div class="micro">电影</div><div class="num">${String(records.length).padStart(2, '0')}</div></div>
    <div><div class="micro">小时</div><div class="num">${hours.toFixed(1)}</div></div>
    <div><div class="micro">平均评分</div><div class="num">${mean}</div></div>
    <div><div class="micro">重看</div><div class="num">${String(records.filter((r) => r.status === 'rewatched').length).padStart(2, '0')}</div></div>
  </div>
  <div class="section cols">
    <div>
      <div class="micro">这一年，用一段话说</div>
      ${summary.map((s) => `<p>${escapeHtml(s)}</p>`).join('')}
      <div class="micro" style="margin-top:28px">反复回来的主题</div>
      <div style="margin-top:8px">${themes
        .slice(0, 6)
        .map((t) => `<span class="tag">${escapeHtml(THEMES[t.id].zh)} · ${t.count}</span>`)
        .join('')}</div>
      <div class="micro" style="margin-top:24px">情绪</div>
      <p style="font-size:20px">${moods
        .slice(0, 3)
        .map((m) => escapeHtml(MOODS[m.id].zh))
        .join(' · ')}</p>
    </div>
    <div>
      ${
        favorite
          ? `<div class="micro">我留下的那一帧</div>
             <h2 style="font-size:26px;margin-top:10px">${escapeHtml(favorite.film.title)}</h2>
             <div class="micro" style="margin-top:6px">${escapeHtml(favorite.film.director)} · ${favorite.film.year}</div>
             <p class="quote">“${escapeHtml(favorite.record.reflection)}”</p>`
          : ''
      }
    </div>
  </div>
  <div class="foot">
    <div class="micro">本地生成 · Frame by Frame · ${year}</div>
    <div class="micro">一份私人记录，不是公开调查</div>
  </div>
</div></body></html>`
}

export const Reflection = () => {
  const { records, films, state, markYearbook } = useAppStore()
  const { openAdd } = useAddFilm()
  const { push } = useToast()

  const years = useMemo(() => {
    const set = new Set<number>()
    records.forEach((record) => set.add(Number(record.watchedAt.slice(0, 4))))
    return Array.from(set).sort((a, b) => b - a)
  }, [records])

  const [year, setYear] = useState(() => years[0] ?? new Date().getFullYear())
  const [generating, setGenerating] = useState(false)
  const [genStage, setGenStage] = useState(0)
  const [showYearbook, setShowYearbook] = useState(false)
  const [printBlocked, setPrintBlocked] = useState(false)

  const yearRecords = useMemo(
    () => records.filter((record) => Number(record.watchedAt.slice(0, 4)) === year),
    [records, year],
  )
  const months = useMemo(() => monthlyStats(yearRecords, films, year), [yearRecords, films, year])
  const activeMonth = useMemo(() => {
    const filled = months.filter((m) => m.count > 0)
    return filled[filled.length - 1] ?? null
  }, [months])

  const favorite = favoriteRecord(yearRecords, films)
  const favoriteFilm = favorite ? filmById(films, favorite.filmId) : null

  const themes = useMemo(() => {
    const counts = new Map<ThemeId, number>()
    yearRecords.forEach((record) => {
      new Set(record.themes).forEach((theme) => counts.set(theme, (counts.get(theme) ?? 0) + 1))
    })
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
  }, [yearRecords])

  const moods = useMemo(() => {
    const counts = new Map<MoodId, number>()
    yearRecords.forEach((record) => {
      new Set(record.moods).forEach((mood) => counts.set(mood, (counts.get(mood) ?? 0) + 1))
    })
    return Array.from(counts.entries())
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count)
  }, [yearRecords])

  const yearSnapshot = useMemo(() => computeSnapshot(yearRecords, films), [yearRecords, films])
  const summary = useMemo(() => summarizeTaste(yearSnapshot), [yearSnapshot])
  const { first, second } = useMemo(() => splitPeriods(yearRecords), [yearRecords])
  const shiftA = useMemo(() => computeSnapshot(first, films), [first, films])
  const shiftB = useMemo(() => computeSnapshot(second, films), [second, films])
  const hours = yearSnapshot.totalMinutes / 60
  const monthRecords = activeMonth?.records ?? []

  useEffect(() => {
    if (!generating) return
    const t1 = window.setTimeout(() => setGenStage(1), 850)
    const t2 = window.setTimeout(() => setGenStage(2), 1700)
    const t3 = window.setTimeout(() => {
      setGenerating(false)
      setGenStage(0)
      setShowYearbook(true)
      markYearbook(uid('yb'))
    }, 2650)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [generating, markYearbook])

  const download = () => {
    const html = buildYearbookHtml({
      year,
      records: yearRecords,
      favorite: favorite && favoriteFilm ? { record: favorite, film: favoriteFilm } : null,
      summary,
      themes,
      moods,
      hours,
    })
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `frame-by-frame-yearbook-${year}.html`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 2000)
    push('年度特刊已下载为独立的 HTML 页面。', 'success')
  }

  const print = () => {
    const html = buildYearbookHtml({
      year,
      records: yearRecords,
      favorite: favorite && favoriteFilm ? { record: favorite, film: favoriteFilm } : null,
      summary,
      themes,
      moods,
      hours,
    })
    const win = window.open('', '_blank', 'width=960,height=1200')
    if (!win) {
      setPrintBlocked(true)
      return
    }
    win.document.open()
    win.document.write(html)
    win.document.close()
    win.focus()
    window.setTimeout(() => win.print(), 400)
  }

  if (records.length === 0) {
    return (
      <div className="paper-sheet on-paper paper-texture min-h-[70vh]">
        <div className="mx-auto max-w-shell px-5 py-20 lg:px-10">
          <p className="micro text-[#7a7264]">05 — 年度回顾</p>
          <h1 className="mt-4 font-zh-title text-[clamp(2.4rem,5vw,4.2rem)] leading-tight text-[#171512]">
            年度特刊还没有内容。
          </h1>
          <div className="mt-12">
            <EmptyState
              tone="light"
              className="border-[#171412]/20"
              title="一本年鉴，需要一年的帧。"
              description="先添加第一部电影，然后再回来。年度回顾会把月份、主题、情绪，以及对你观影品味的解读，收进同一件可以打印的物件里。"
              action={
                <button type="button" onClick={() => openAdd()} className="btn btn-primary">
                  添加电影
                </button>
              }
            />
          </div>
        </div>
      </div>
    )
  }

  const maxMonth = Math.max(...months.map((m) => m.count), 1)

  return (
    <div className="paper-sheet on-paper paper-texture">
      <div className="shell pb-8 pt-10 lg:pt-14">
        {/* Masthead */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#171512]/25 pb-3">
          <p className="text-[12.5px] tracking-[0.08em] text-[#7a7264]">
            05 — 年度回顾 / 年度特刊
          </p>
          <p className="text-[12.5px] tracking-[0.08em] text-[#7a7264]">
            一份可以打印的记录 · {year}
          </p>
        </div>

        <div className="grid grid-cols-12 items-start gap-x-6 gap-y-10 pt-8">
          <div className="col-span-12 lg:col-span-7 lg:pt-2">
            <h1 className="font-zh-title text-[clamp(2.6rem,6.2vw,5.2rem)] leading-[1.08] tracking-[-0.01em] text-[#171512]">
              {year} 年度片卷
            </h1>
            <p className="mt-2 font-display text-[clamp(1.2rem,2.4vw,1.8rem)] italic leading-snug text-[#7a7264]">
              The {year} Reel
            </p>
            <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <p className="text-[14.5px] leading-[1.9] text-[#3a3428]">
                一份关于「这一年在黑暗里发生了什么」的印刷记录：月份、情绪、你留下的那一帧，以及品味缓慢移动的轨迹。
              </p>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-2">
              <span className="mr-1 text-[12px] tracking-[0.06em] text-[#7a7264]">
                年份
              </span>
              {years.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => setYear(y)}
                  className="chip h-8 text-[12.5px]"
                  data-active={year === y}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          {favorite && favoriteFilm && (
            <div className="col-span-9 col-start-1 sm:col-span-6 lg:col-span-4 lg:col-start-9">
              <div className="flex items-baseline justify-between border-b border-[#171512]/25 pb-2">
                <p className="text-[12.5px] tracking-[0.06em] text-[#7a7264]">
                  我留下的那一帧
                </p>
                <p className="font-mono text-[12px] text-[#7a7264]">
                  {favorite.rating.toFixed(1)} / 5
                </p>
              </div>
              <div className="mt-3 aspect-[2/3] w-full max-w-[230px] overflow-hidden lg:ml-auto">
                <FilmPoster film={favoriteFilm} showTitle={false} />
              </div>
              <p className="mt-2.5 text-right text-[12px] tracking-[0.06em] text-[#7a7264]">
                封面 · {favoriteFilm.year}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="shell">

        {yearRecords.length === 0 ? (
          <div className="mt-16">
            <EmptyState
              tone="light"
              className="border-[#171412]/20"
              title={`${year} 年还没有记录任何电影。`}
              description="换一个年份，或者添加一部观看日期在这一年内的电影。"
              action={
                <button type="button" onClick={() => openAdd()} className="btn btn-ghost">
                  添加电影
                </button>
              }
            />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="mt-8 grid grid-cols-2 gap-y-8 border-b border-[#171512]/20 pb-8 sm:grid-cols-4">
              {[
                ['电影', String(yearRecords.length).padStart(2, '0'), `${months.filter((m) => m.count > 0).length} 个有记录的月份`],
                ['累计观影', hours.toFixed(1), formatMinutes(yearSnapshot.totalMinutes)],
                ['平均评分', yearSnapshot.averageRating.toFixed(1), '满分 5 分'],
                ['重看', String(yearRecords.filter((r) => r.status === 'rewatched').length).padStart(2, '0'), '次重看'],
              ].map(([label, value, sub]) => (
                <div key={label}>
                  <p className="text-[12.5px] tracking-[0.04em] text-[#7a7264]">{label}</p>
                  <p className="num mt-2 text-5xl leading-none text-[#171512]">{value}</p>
                  <p className="mt-2 text-[12.5px] text-[#7a7264]">{sub}</p>
                </div>
              ))}
            </div>

            {/* Month chart + this month */}
            <div className="mt-12 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
              <div>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="micro text-[#7a7264]">这一年，逐月来看</p>
                    <p className="mt-2 font-zh-title text-[1.5rem] text-[#171512]">
                      {months.reduce((sum, m) => sum + m.count, 0)} 帧，{months.filter((m) => m.count > 0).length} 个月
                    </p>
                  </div>
                  <p className="text-[12.5px] tracking-[0.06em] text-[#7a7264]">部电影</p>
                </div>

                <div className="mt-8 flex h-52 items-end gap-2 sm:gap-3">
                  {months.map((month) => (
                    <div key={month.month} className="group flex h-full flex-1 flex-col justify-end">
                      <div className="relative flex flex-1 items-end">
                        <div
                          className="mx-auto w-[62%] bg-[#171512]/85 transition-colors duration-300 group-hover:bg-[#29251f]"
                          style={{ height: `${Math.max(month.count > 0 ? 8 : 1, (month.count / maxMonth) * 100)}%` }}
                          title={`${month.label}：${month.count} 部电影 · ${formatMinutes(month.minutes)}`}
                        />
                      </div>
                      <p className={`mt-2 text-center text-[12px] tracking-[0.02em] ${activeMonth?.month === month.month ? 'text-[#29251f]' : 'text-[#7a7264]'}`}>
                        {month.label}
                      </p>
                      <p className="mt-0.5 text-center font-mono text-[12px] text-[#7a7264]">
                        {month.count > 0 ? month.count : '·'}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 border-t border-[#171512]/15 pt-3 text-[12.5px] text-[#7a7264]">
                  柱子的高度是电影数量，不是评分。把鼠标停在柱子上，可以看到当月的观影时长。
                </p>
              </div>

              <div>
                <div className="flex items-end justify-between gap-3 border-b border-[#171512]/20 pb-3">
                  <p className="micro text-[#7a7264]">
                    {activeMonth ? `${monthName(activeMonth.records[0]?.watchedAt ?? `${year}-01-01`)} · 这个月` : '这个月'}
                  </p>
                  <p className="font-mono text-[12.5px] text-[#7a7264]">{monthRecords.length} 部电影</p>
                </div>
                {monthRecords.length > 0 ? (
                  <ul className="mt-2 divide-y divide-[#171512]/15">
                    {monthRecords.map((record) => {
                      const film = filmById(films, record.filmId)
                      if (!film) return null
                      return (
                        <li key={record.id} className="flex items-start gap-4 py-4">
                          <div className="w-[46px] shrink-0">
                            <div className="aspect-[2/3] w-full overflow-hidden">
                              <FilmPoster film={film} showTitle={false} />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="font-display text-lg leading-tight text-[#171512]">{film.title}</p>
                            {film.titleZh && (
                              <p className="text-[12.5px] tracking-[0.04em] text-[#7a7264]">{film.titleZh}</p>
                            )}
                            <p className="mt-0.5 text-[12px] tracking-[0.04em] text-[#7a7264]">
                              {formatLongDate(record.watchedAt)} · ★ {record.rating.toFixed(1)}
                            </p>
                            <p className="mt-2 line-clamp-2 font-zh-body text-[13px] leading-[1.8] text-[#3a3428]">
                              {record.reflection}
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mt-4 text-[14px] text-[#7a7264]">这个月还没有记录。</p>
                )}
              </div>
            </div>

            {/* Favorite */}
            {favorite && favoriteFilm && (
              <div className="mt-14 grid gap-8 border-t border-[#171512]/20 pt-10 lg:grid-cols-12 lg:gap-12">
                <div className="lg:col-span-7">
                  <p className="micro text-[#7a7264]">我留下的那一帧</p>
                  <p className="mt-4 font-display text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[0.98] tracking-[-0.02em] text-[#171512]">
                    {favoriteFilm.title}
                  </p>
                  {favoriteFilm.titleZh && (
                    <p className="mt-1 font-zh-title text-[1.2rem] text-[#3a3428]">{favoriteFilm.titleZh}</p>
                  )}
                  <p className="mt-3 text-[12.5px] tracking-[0.04em] text-[#7a7264]">
                    {favoriteFilm.director} · {favoriteFilm.year} · ★ {favorite.rating.toFixed(1)}
                  </p>
                </div>
                <div className="flex flex-col justify-center lg:col-span-5">
                  <blockquote className="border-l border-[#29251f]/50 pl-5">
                    <p className="font-zh-body text-[clamp(1rem,1.6vw,1.25rem)] leading-[1.9] text-[#2c2822]">
                      “{favorite.reflection}”
                    </p>
                  </blockquote>
                </div>
              </div>
            )}

            {/* Themes + moods */}
            <div className="mt-14 grid gap-10 border-t border-[#171512]/20 pt-10 sm:grid-cols-2 lg:gap-20">
              <div>
                <p className="micro text-[#7a7264]">反复回来的主题</p>
                <ul className="mt-5 space-y-3">
                  {themes.slice(0, 6).map((theme, i) => (
                    <li key={theme.id}>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="font-zh-title text-[1.1rem] text-[#171512]">
                          {THEMES[theme.id].zh}
                          <span className="ml-2 text-[10px] uppercase tracking-[0.1em] text-[#7a7264]">
                            {THEMES[theme.id].label}
                          </span>
                        </p>
                        <span className="font-mono text-[12.5px] text-[#7a7264]">{theme.count}</span>
                      </div>
                      <div className="mt-2 h-px w-full bg-[#171512]/12">
                        <div
                          className="h-px bg-[#171512]"
                          style={{ width: `${Math.max(10, (theme.count / Math.max(themes[0]?.count ?? 1, 1)) * 100)}%`, opacity: 1 - i * 0.12 }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="micro text-[#7a7264]">这一年留下的情绪</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {moods.slice(0, 8).map((mood) => (
                    <span
                      key={mood.id}
                      className="border border-[#171512]/25 px-3 py-1.5 text-[12.5px] tracking-[0.04em] text-[#3a3428]"
                    >
                      {MOODS[mood.id].zh} <span className="text-[#7a7264]">{mood.count}</span>
                    </span>
                  ))}
                </div>
                <p className="mt-6 max-w-sm text-[14px] leading-[1.9] text-[#3a3428]">
                  {moods[0]
                    ? `「${MOODS[moods[0].id].zh}」是这一年最主要的语气——它出现在 ${moods[0].count} 部电影里，常常和「${THEMES[themes[0]?.id ?? 'memory'].zh}」一起出现。`
                    : '还没有记录任何情绪。'}
                </p>
                {state.yearbookGenerations.length > 0 && (
                  <p className="mt-6 border-t border-[#171512]/15 pt-4 text-[12px] tracking-[0.06em] text-[#7a7264]">
                    这台设备已生成 {state.yearbookGenerations.length} 本年度特刊
                  </p>
                )}
              </div>
            </div>

            {/* AI summary + shift */}
            <div className="mt-14 grid gap-0 border-y border-[#171512]/20 lg:grid-cols-[1fr_1fr]">
              <div className="border-b border-[#171512]/20 py-10 lg:border-b-0 lg:border-r lg:pr-12">
                <p className="micro text-[#7a7264]">这一年读起来是什么样</p>
                <div className="mt-4 space-y-3">
                  {summary.map((sentence, i) => (
                    <p key={i} className="text-[15px] leading-[1.95] text-[#2c2822]">
                      {sentence}
                    </p>
                  ))}
                </div>
                <p className="mt-5 text-[12.5px] leading-[1.8] text-[#7a7264]">
                  这段总结只根据 {year} 年的记录重新计算。它是对偏好的估计，不是对品味的评判。
                </p>
              </div>

              <div className="py-10 lg:pl-12">
                <p className="micro text-[#7a7264]">漂移：上半年 → 下半年</p>
                {first.length > 0 && second.length > 0 ? (
                  <ul className="mt-5 space-y-4">
                    {DIMENSIONS.slice(0, 5).map((def) => {
                      const before = shiftA.dimensionScores.find((d) => d.key === def.key)?.value ?? 0.5
                      const after = shiftB.dimensionScores.find((d) => d.key === def.key)?.value ?? 0.5
                      const delta = after - before
                      const steady = Math.abs(delta) < 0.04
                      return (
                        <li key={def.key} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-4">
                          <p className="text-[12.5px] tracking-[0.04em] text-[#3a3428]">
                            {def.labelZh}
                          </p>
                          <div className="relative h-4">
                            <div className="absolute left-0 right-0 top-1/2 h-px bg-[#171512]/15" />
                            <div
                              className="absolute top-1/2 h-2 w-2 -translate-y-1/2 border border-[#171512]/40"
                              style={{ left: `${Math.min(96, Math.max(4, before * 100))}%` }}
                              title={`上半年：${percent(before)}`}
                            />
                            <div
                              className="absolute top-1/2 h-[6px] w-[6px] -translate-y-1/2 bg-[#29251f]"
                              style={{ left: `${Math.min(98, Math.max(2, after * 100))}%` }}
                              title={`下半年：${percent(after)}`}
                            />
                          </div>
                          <p className="w-[4.8rem] text-right text-[12.5px] tracking-[0.04em] text-[#7a7264]">
                            {steady ? '保持稳定' : delta > 0 ? '向外 / 上移' : '向内 / 下移'}
                          </p>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mt-4 text-[14px] leading-[1.9] text-[#7a7264]">
                    要看出漂移，上半年和下半年各需要至少两部电影。
                  </p>
                )}
                <p className="mt-4 text-[12.5px] leading-[1.8] text-[#7a7264]">
                  空心方框是上半年，实心方框是下半年。轴线从向内的一端延伸到向外的一端。
                </p>
              </div>
            </div>

            {/* Yearbook CTA */}
            <div className="mt-12 flex flex-col gap-6 border border-[#171512]/25 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
              <div>
                <p className="micro flex items-center gap-2 text-[#7a7264]">
                  <Sparkles size={11} /> 可以拿在手里的物件
                </p>
                <p className="mt-2 font-zh-title text-[1.6rem] leading-tight text-[#171512]">
                  把 {year} 年做成一本年度特刊。
                </p>
                <p className="mt-2 max-w-lg text-[14px] leading-[1.9] text-[#3a3428]">
                  一页可以留下的年鉴：数字、主题、你留下的那一帧，以及对你观影品味的解读。本地生成，可下载为 HTML，也可直接打印。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGenerating(true)}
                className="btn btn-primary shrink-0"
              >
                <Sparkles size={13} /> 生成我的年度特刊
              </button>
            </div>
          </>
        )}
      </div>

      {/* Generation overlay */}
      {generating &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-[#1b1814]/96 px-6 text-center backdrop-blur">
            <p className="micro text-paper-dim">正在排版年度特刊</p>
            <p className="mt-4 font-zh-title text-[2rem] text-paper sm:text-[2.6rem]">一年，在帧与帧之间。</p>
            <div className="mt-10 w-full max-w-sm space-y-3 text-left">
              {['收集这一年的帧', '整理主题与情绪', '排版与校色'].map((label, i) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="w-4">
                    {genStage > i ? (
                      <span className="text-paper">✓</span>
                    ) : genStage === i ? (
                      <Loader2 size={12} className="animate-spin text-paper" />
                    ) : (
                      <span className="block h-1 w-1 rounded-full bg-paper-muted/40" />
                    )}
                  </span>
                  <span className={`text-[14.5px] ${genStage >= i ? 'text-paper' : 'text-paper-muted'}`}>
                    {label}
                  </span>
                </div>
              ))}
              <div className="mt-6">
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${Math.min(100, ((genStage + 1) / 3) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="mt-8 max-w-xs text-[12.5px] leading-[1.8] text-paper-dim">
              没有调用模型。年度特刊由这台设备上的 {year} 年记录排版而成。
            </p>
          </div>,
          document.body,
        )}

      <Modal
        open={showYearbook}
        onClose={() => setShowYearbook(false)}
        size="wide"
        labelledBy="yearbook-title"
        className="bg-transparent"
      >
        <div id="yearbook-title" className="sr-only">
          你的 {year} 年度特刊
        </div>
        <div className="max-h-[86vh] overflow-y-auto p-3 sm:p-6">
          <Yearbook
            year={year}
            records={yearRecords}
            summary={summary}
            themes={themes}
            moods={moods}
            favourite={favorite && favoriteFilm ? { record: favorite, film: favoriteFilm } : null}
            hours={hours}
          />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-paper/15 bg-[#211e19] p-4">
            <p className="max-w-md text-[12.5px] leading-[1.8] text-paper-dim">
              下载的文件是自包含的，可以直接打印。里面只有你的电影名称、评分和笔记。
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={download} className="btn btn-primary h-9 px-4 text-[12px]">
                <Download size={12} /> 下载 HTML
              </button>
              <button type="button" onClick={print} className="btn btn-ghost h-9 px-4 text-[12px]">
                <Printer size={12} /> 打印
              </button>
            </div>
          </div>
          {printBlocked && (
            <p className="mt-2 text-[12.5px] leading-[1.8] text-[#c7bba8]">
              打印窗口被浏览器拦截了。请允许弹出窗口，或者先下载 HTML 再打印。
            </p>
          )}
        </div>
      </Modal>
    </div>
  )
}
