import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { CinematicHero } from '@/components/home/CinematicHero'
import { TasteRadar } from '@/components/taste/TasteRadar'
import { Reveal } from '@/components/ui/Reveal'
import { filmById } from '@/lib/tasteEngine'
import { sampleStateCopy } from '@/lib/ai/tasteProfile'
import type { TasteSnapshot } from '@/types'
import { FILMS } from '@/data/films'
import { THEMES } from '@/data/taxonomy'
import { formatMinutes, percent } from '@/lib/format'

export const Home = () => {
  const { records, films, snapshot, profile, clearSeed } = useAppStore()
  const { openAdd } = useAddFilm()
  const [confirmClear, setConfirmClear] = useState(false)
  const seedCount = records.filter((record) => record.source === 'seed').length

  const themeCount = new Set(records.flatMap((r) => r.themes)).size
  const hours = snapshot.totalMinutes / 60
  const year = new Date().getFullYear()

  const radarSnapshot: TasteSnapshot = {
    filmCount: profile.filmCount,
    dimensionScores: profile.dimensions,
    overallConfidence: profile.overallConfidence,
    topThemes: profile.topThemes,
    topMoods: profile.topMoods,
    averageRating: profile.averageRating,
    totalMinutes: snapshot.totalMinutes,
  }
  const strongest = [...profile.dimensions]
    .filter((item) => item.sufficient)
    .sort((a, b) => b.confidence - a.confidence)[0]
  const showRadar = profile.dimensions.filter((item) => item.sufficient).length >= 2

  if (records.length === 0) {
    // An empty shelf still gets a real frame — a quiet catalogue still with a
    // clean lower-left corner, never generated artwork.
    return (
      <CinematicHero
        film={filmById(films, 'moonlight') ?? null}
        stats={{ films: 0, themes: 0, hours: 0 }}
        year={year}
        empty
        onAdd={() => openAdd()}
      />
    )
  }

  return (
    <div>
      {/* ================================================================ */}
      {/*  COVER — cinematic overlay                                        */}
      {/* ================================================================ */}
      <CinematicHero
        film={filmById(films, 'la-la-land') ?? filmById(FILMS, 'la-la-land') ?? null}
        stats={{ films: records.length, themes: themeCount, hours }}
        year={year}
      />

      {seedCount > 0 && (
        <section className="shell pt-5 lg:pt-6">
          <div className="flex flex-col gap-4 border border-brass/45 bg-paper-sheet px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex shrink-0 border border-brass/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-brass">
                示例
              </span>
              <div>
                <p className="font-zh-title text-[14px] leading-snug text-ink">
                  当前片库为 {seedCount} 部示例电影
                </p>
                <p className="mt-1 text-[12px] leading-[1.75] text-ink/60">
                  笔记为原型撰写，用于演示 AI 如何理解你，不是真实用户记录。可保留，也可清空后从自己的第一部开始。
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:pl-4">
              {confirmClear ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      clearSeed()
                      setConfirmClear(false)
                    }}
                    className="btn btn-primary h-8 min-h-0 px-3 text-[12px]"
                  >
                    确认清空
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="btn btn-ghost h-8 min-h-0 px-3 text-[12px]"
                  >
                    取消
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => openAdd()}
                    className="btn btn-primary h-8 min-h-0 px-3 text-[12px]"
                  >
                    添加我的电影
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="btn btn-ghost h-8 min-h-0 px-3 text-[12px]"
                  >
                    清空示例
                  </button>
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ================================================================ */}
      {/*  THE RECORD — oversized numbers, no cards                         */}
      {/* ================================================================ */}
      <section className="shell py-6 lg:py-8">
        <div className="ink-panel">
          <div className="px-6 py-12 sm:px-10 lg:px-12 lg:py-14">
            <Reveal>
              <div className="flex flex-wrap items-end justify-between gap-4 border-b border-paper/15 pb-5">
                <p className="artifact-label">
                  <b>04</b> 片库记录
                </p>
                <p className="max-w-xs text-right text-[13px] leading-[1.8] text-paper-dim">
                  这些数字来自你的片库。它记录的是注意力，而不是成就。
                </p>
              </div>
            </Reveal>

            <dl className="mt-2 grid grid-cols-2 gap-y-10 py-8 lg:grid-cols-4">
              {[
                { label: '片库电影', en: 'Films kept', value: String(records.length).padStart(2, '0'), sub: '已收录' },
                { label: '累计观影', en: 'Hours in the dark', value: hours.toFixed(1), sub: formatMinutes(snapshot.totalMinutes) },
                { label: '出现主题', en: 'Themes found', value: String(themeCount).padStart(2, '0'), sub: '反复出现' },
                {
                  label: '解读置信度',
                  en: 'Reading confidence',
                  value: `${Math.round(snapshot.overallConfidence * 100)}%`,
                  sub: '是估计，不是判决',
                },
              ].map((stat, i) => (
                <Reveal key={stat.label} delay={i * 60} className={i > 0 ? 'lg:border-l lg:border-paper/15 lg:pl-8' : ''}>
                  <dt className="text-[13px] font-medium tracking-[0.04em] text-paper-dim">{stat.label}</dt>
                  <dd className="num mt-3 text-[clamp(2.4rem,4.6vw,4rem)] leading-[0.9] text-paper">
                    {stat.value}
                  </dd>
                  <dd className="mt-2 text-[10.5px] uppercase tracking-[0.12em] text-paper-dim/60">{stat.en}</dd>
                  <dd className="mt-1 text-[12.5px] text-paper-dim/75">{stat.sub}</dd>
                </Reveal>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  05 — THE READING                                                 */}
      {/* ================================================================ */}
      <section id="reading" className="bg-[#F8E3AC] border-t border-[#65450E]/20">
        <div className="shell py-16 lg:py-24">
          <div className="grid grid-cols-12 gap-x-6 gap-y-12">
            <Reveal className="col-span-12 lg:col-span-5 xl:col-span-4">
              <div className="relative">
                {showRadar ? (
                  <>
                    <TasteRadar snapshot={radarSnapshot} size={380} tone="light" />
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <p className="num text-[3rem] leading-none text-ink">
                        {Math.round(profile.overallConfidence * 100)}
                        <span className="text-lg text-ink/65">%</span>
                      </p>
                      <p className="mt-1.5 text-[12px] tracking-[0.06em] text-ink/60">置信度</p>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-[320px] flex-col justify-center border border-dashed border-ink/20 px-8 py-10 text-center">
                    <p className="font-zh-title text-[1.35rem] leading-[1.5] text-ink">
                      还没有可以画出的形状。
                    </p>
                    <p className="mt-3 text-[13.5px] leading-[1.9] text-ink/60">
                      雷达图只使用你确认过的 AI 证据。证据不足时，我们不会用虚构数字把它填满。
                    </p>
                  </div>
                )}
              </div>
              <p className="mt-2 text-center text-[12.5px] leading-relaxed text-ink/60">
                六条轴线，只来自你确认过的分析证据。
              </p>
            </Reveal>

            <Reveal delay={80} className="col-span-12 lg:col-span-7 lg:col-start-6">
              <p className="artifact-label">
                <b>05</b> 审美解读
              </p>
              <h2 className="mt-5 font-zh-title text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.25] tracking-[-0.01em] text-ink">
                {profile.signature}
              </h2>
              <p className="measure mt-5 text-[15.5px] leading-[1.95] text-ink/75">
                {sampleStateCopy[profile.sampleState]}
              </p>

              <div className="mt-9 grid gap-8 border-t border-ink/15 pt-6 sm:grid-cols-2">
                <div>
                  <p className="text-[12px] tracking-[0.06em] text-ink/65">最强信号</p>
                  <p className="mt-2 font-zh-title text-[1.45rem] leading-tight text-ink">
                    {strongest ? strongest.def.labelZh : '还在聆听'}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-[1.8] text-ink/65">
                    {strongest
                      ? `${strongest.def.label} · ${percent(
                          strongest.value < 0.5 ? 1 - strongest.value : strongest.value,
                        )} 偏向「${strongest.value < 0.5 ? strongest.def.lowZh : strongest.def.highZh}」`
                      : `确认几部电影后，方向才会显现；目前有 ${profile.pendingCount} 条分析等待确认。`}
                  </p>
                </div>

                {profile.topThemes.length > 0 && (
                  <div>
                    <p className="text-[12px] tracking-[0.06em] text-ink/65">你反复回到的主题</p>
                    <ul className="mt-2.5 space-y-1.5">
                      {profile.topThemes.slice(0, 4).map((theme) => (
                        <li key={theme.id} className="flex items-baseline justify-between gap-3 border-b border-ink/10 pb-1.5">
                          <span className="text-[14px] text-ink/80">
                            {THEMES[theme.id].zh}
                            <span className="ml-2 text-[11px] uppercase tracking-[0.1em] text-ink/45">
                              {THEMES[theme.id].label}
                            </span>
                          </span>
                          <span className="font-mono text-[12px] text-ink/65">
                            {String(theme.count).padStart(2, '0')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                <Link to="/taste" className="link-rule text-brass-ink hover:text-ink">
                  查看完整观影品味 <ArrowRight size={12} />
                </Link>
                <p className="flex items-center gap-2 text-[12.5px] text-ink/65">
                  <Sparkles size={10} /> 只使用你确认过的 AI 证据。
                </p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

    </div>
  )
}
