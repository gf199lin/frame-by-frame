import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, Plus, RotateCcw, X } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { cn } from '@/lib/format'
import { useLockBody } from '@/components/ui/Toast'
import { NAV, filmCount, pageTitle } from '@/i18n/zh-CN'

const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 30 30" className={className} aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.1" />
    <rect x="6" y="6" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
    <rect x="11" y="11" width="8" height="8" fill="currentColor" opacity="0.95" />
  </svg>
)

const Brand = ({ compact = false }: { compact?: boolean }) => (
  <Link to="/" className="group flex shrink-0 items-center gap-2.5" aria-label="Frame by Frame — 返回首页">
    <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ink text-paper shadow-[0_8px_18px_rgba(29,35,121,0.2)] transition-transform duration-300 group-hover:-translate-y-0.5">
      <Mark className="h-[19px] w-[19px]" />
    </span>
    <span className="flex flex-col">
      <span className="font-display text-[20px] leading-none tracking-[0.005em] text-ink sm:text-[22px]">
        Frame <span className="italic text-taupe">by</span> Frame
      </span>
      {!compact && (
        <span className="mt-[5px] hidden text-[11.5px] tracking-[0.1em] text-taupe sm:block">
          私人电影记忆博物馆 · 2026
        </span>
      )}
    </span>
  </Link>
)

export const Shell = ({ children }: { children: ReactNode }) => {
  const { records, resetDemo, storageAvailable } = useAppStore()
  const { openAdd } = useAddFilm()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const location = useLocation()
  useLockBody(mobileOpen)

  useEffect(() => {
    window.scrollTo(0, 0)
    setMobileOpen(false)
    const current = NAV.find((item) =>
      item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to),
    )
    document.title = pageTitle(current?.label)
  }, [location.pathname])

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <div className="grain relative min-h-screen bg-paper">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[130] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        跳到主要内容
      </a>

      <header className="sticky top-0 z-[60] px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="site-nav mx-auto flex h-[64px] max-w-[1560px] items-center justify-between gap-2 px-2.5 sm:h-[72px] sm:px-4">
          <Brand />

          <nav className="hidden items-center gap-0.5 xl:flex" aria-label="主导航">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn('nav-item')}
                data-active={isActive(item.to)}
              >
                <span className="flex items-baseline gap-1.5">
                  <span className="nav-index">{item.index}</span>
                  <span className="font-zh-ui text-[14.5px] font-medium leading-none tracking-[0.04em]">
                    {item.label}
                  </span>
                </span>
                <span className="nav-en mt-1 text-[9.5px] uppercase tracking-[0.14em] opacity-60">
                  {item.en}
                </span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="hidden text-right 2xl:block">
              <p className="text-[12px] font-medium tracking-[0.03em] text-ink/80">
                {filmCount(records.length)}
              </p>
              <p className="mt-0.5 text-[10.5px] tracking-[0.1em] text-taupe/80">本地片库</p>
            </div>
            <button
              type="button"
              onClick={() => openAdd()}
              className="btn btn-primary h-10 min-h-0 shrink-0 px-3 text-[13px] sm:px-4"
              aria-label="添加电影"
            >
              <Plus size={13} strokeWidth={1.8} />
              <span className="hidden sm:inline">添加电影</span>
              <span className="sm:hidden">添加</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="icon-btn xl:hidden"
              aria-label="打开菜单"
              aria-expanded={mobileOpen}
            >
              <Menu size={17} />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-paper xl:hidden">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <Brand compact />
            <button type="button" onClick={() => setMobileOpen(false)} className="icon-btn" aria-label="关闭菜单">
              <X size={17} />
            </button>
          </div>
          <nav className="mx-3 flex-1 overflow-y-auto rounded-card border-[1.5px] border-ink bg-paper-sheet p-2 shadow-card" aria-label="移动端导航">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center justify-between rounded-[10px] px-4 py-4 transition-colors',
                  isActive(item.to) ? 'bg-ink text-paper' : 'text-ink hover:bg-ink/[0.04]',
                )}
              >
                <span className="flex items-baseline gap-4">
                  <span className={cn('font-mono text-[11px] tracking-[0.14em]', isActive(item.to) ? 'text-paper/55' : 'text-taupe')}>
                    {item.index}
                  </span>
                  <span>
                    <span className="font-zh-title block text-[1.55rem] leading-none">{item.label}</span>
                    <span className={cn('mt-1.5 block text-[10px] uppercase tracking-[0.16em]', isActive(item.to) ? 'text-paper/55' : 'text-taupe/80')}>
                      {item.en}
                    </span>
                  </span>
                </span>
                {isActive(item.to) && <span className="h-1.5 w-1.5 rounded-full bg-paper" aria-hidden="true" />}
              </NavLink>
            ))}
          </nav>
          <div className="px-3 pb-5 pt-3">
            <button type="button" onClick={() => openAdd()} className="btn btn-primary w-full">
              <Plus size={14} /> 添加电影
            </button>
            <p className="mt-3 text-center text-[12px] tracking-[0.06em] text-taupe">
              {filmCount(records.length)} · 保存在这台设备
            </p>
          </div>
        </div>
      )}

      {!storageAvailable && (
        <div className="mx-3 mt-3 rounded-[8px] border border-ink/20 bg-sheet px-5 py-2 text-center text-[12.5px] tracking-[0.03em] text-ink sm:mx-5">
          浏览器本地存储不可用，刷新页面后本次记录将无法保留。
        </div>
      )}

      <main id="main" key={location.pathname} className="overflow-x-hidden">
        {children}
      </main>

      <footer className="px-3 pb-4 pt-10 sm:px-5 sm:pb-6">
        <div className="ink-panel mx-auto max-w-[1560px]">
          <div className="shell py-14 lg:py-16">
            <div className="grid gap-12 lg:grid-cols-[1.5fr_0.8fr_0.8fr_1fr] lg:gap-16">
              <div>
                <p className="kicker">Frame by Frame · 第一卷 / 2026</p>
                <p className="mt-6 max-w-md font-display text-[2.1rem] leading-[1.04] tracking-[-0.02em] text-paper sm:text-[2.6rem]">
                  Every film leaves a frame.
                  <br />
                  <span className="italic text-paper-dim">Every frame tells your story.</span>
                </p>
                <p className="mt-5 max-w-xs text-[14px] leading-[1.9] text-paper-dim">
                  每一部电影都留下一帧，每一帧都在讲述你的故事。这是一座只属于你的电影记忆博物馆：片库、笔记与审美解读都保存在这台设备上，不会上传到服务器。
                </p>
              </div>

              <div className="lg:border-l lg:border-paper/15 lg:pl-6">
                <p className="text-[12.5px] font-medium tracking-[0.06em] text-paper-dim">馆内导航</p>
                <ul className="mt-5 space-y-3">
                  {NAV.map((item) => (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className="link-underline text-[14px] text-paper-dim transition-colors hover:text-paper"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="lg:border-l lg:border-paper/15 lg:pl-6">
                <p className="text-[12.5px] font-medium tracking-[0.06em] text-paper-dim">片库记录</p>
                <ul className="mt-5 space-y-3 text-[14px] leading-relaxed text-paper-dim">
                  <li>{filmCount(records.length)}已收录</li>
                  <li>本地存储 · 版本 2</li>
                  <li>无需注册账号</li>
                  <li className="text-paper-dim">仅在你授权后调用在线 AI，随时可关闭</li>
                </ul>
              </div>

              <div className="lg:border-l lg:border-paper/15 lg:pl-6">
                <p className="text-[12.5px] font-medium tracking-[0.06em] text-paper-dim">关于 AI</p>
                <p className="mt-5 text-[13.5px] leading-[1.9] text-paper-dim">
                  只有你主动授权后，才会把这一次记录发送给已配置的在线 AI 服务，生成情绪、主题和六维证据。未授权或服务未连接时不会生成任何 AI 解读；你的原始笔记始终只保存在本机。每条判断都带有置信度与原句依据，你可以同意、质疑或修正。
                </p>
                <p className="mt-4 text-[12.5px] leading-[1.8] text-paper-dim/70">
                  你的笔记默认只保存在本机浏览器。勾选同意后，单次分析所需的笔记、评分和少量相关旧片摘要才会发送给在线 AI 服务；模型密钥只保存在服务端。海报与剧照来自 TMDB 的官方影片图片，或经过核验的官方海报本地副本。
                </p>
                <p className="mt-2 text-[12.5px] leading-[1.8] text-paper-dim/60">
                  本产品使用 TMDB API，但未获得 TMDB 的认可或认证。
                </p>
                <div className="mt-6">
                  {confirmReset ? (
                    <div className="rounded-[8px] border border-paper/20 p-3">
                      <p className="text-[13px] leading-[1.8] text-paper-dim">
                        要恢复为十部示例电影吗？你自己添加的记录将被移除。
                      </p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            resetDemo()
                            setConfirmReset(false)
                          }}
                          className="btn btn-primary h-8 min-h-0 px-3 text-[12px]"
                        >
                          恢复示例
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmReset(false)}
                          className="btn btn-ghost h-8 min-h-0 px-3 text-[12px]"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="inline-flex items-center gap-2 text-[12px] tracking-[0.06em] text-paper-dim transition-colors hover:text-paper"
                    >
                      <RotateCcw size={11} /> 恢复示例数据
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-14 flex flex-col gap-3 border-t border-paper/15 pt-6 text-[12px] tracking-[0.06em] text-paper-dim sm:flex-row sm:items-center sm:justify-between">
              <p>© 2026 Frame by Frame · 个人作品</p>
              <p>为滴普杯 · DeepWorks 而作</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
