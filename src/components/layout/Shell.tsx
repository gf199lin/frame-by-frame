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
    <rect x="1" y="1" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="0.9" />
    <rect x="6" y="6" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.45" />
    <rect x="11" y="11" width="8" height="8" fill="currentColor" opacity="0.92" />
    <line x1="1" y1="1" x2="6" y2="6" stroke="currentColor" strokeWidth="0.6" opacity="0.35" />
    <line x1="29" y1="29" x2="24" y2="24" stroke="currentColor" strokeWidth="0.6" opacity="0.35" />
  </svg>
)

const Brand = ({ compact = false }: { compact?: boolean }) => (
  <Link to="/" className="group flex items-center gap-3" aria-label="Frame by Frame — 返回首页">
    <Mark className="h-7 w-7 text-ink transition-colors group-hover:text-taupe" />
    <span className="flex flex-col">
      <span className="font-display text-[20px] leading-none tracking-[0.005em] text-ink sm:text-[23px]">
        Frame <span className="italic text-taupe">by</span> Frame
      </span>
      {!compact && (
        <span className="mt-[6px] hidden text-[12px] tracking-[0.08em] text-taupe sm:block">
          私人电影记忆博物馆 · Est. 2026
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
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[130] focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
      >
        跳到主要内容
      </a>

      <header className="sticky top-0 z-[60] border-b border-ink/10 bg-paper/90 backdrop-blur-xl">
        <div className="h-px w-full bg-ink/55" aria-hidden="true" />
        <div className="shell flex h-[76px] items-stretch justify-between gap-3 xl:gap-5">
          <div className="flex items-center">
            <Brand />
          </div>

          <nav className="hidden items-stretch xl:flex" aria-label="主导航">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'group relative flex flex-col justify-center border-l border-ink/10 px-4 transition-colors 2xl:px-5',
                  isActive(item.to) ? 'text-ink' : 'text-taupe hover:text-ink',
                )}
              >
                <span className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'font-mono text-[10px] tracking-[0.1em]',
                      isActive(item.to) ? 'text-ink' : 'text-taupe/85',
                    )}
                  >
                    {item.index}
                  </span>
                  <span
                    className={cn(
                      'font-zh-ui text-[15.5px] leading-none tracking-[0.04em]',
                      isActive(item.to) ? 'font-semibold text-ink' : 'font-medium',
                    )}
                  >
                    {item.label}
                  </span>
                </span>
                <span className="mt-[6px] text-[10px] uppercase tracking-[0.16em] text-taupe/85">
                  {item.en}
                </span>
                <span
                  className={cn(
                    'absolute inset-x-0 bottom-0 h-[2px] origin-left bg-ink transition-transform duration-500',
                    isActive(item.to) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50',
                  )}
                />
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden text-right 2xl:block">
              <p className="text-[12.5px] font-medium tracking-[0.04em] text-ink/80">
                {filmCount(records.length)}
              </p>
              <p className="mt-1 text-[11px] tracking-[0.12em] text-taupe/85">本地片库</p>
            </div>
            <button
              type="button"
              onClick={() => openAdd()}
              className="btn btn-primary h-10 shrink-0 px-3 text-[13.5px] sm:px-5"
              aria-label="添加电影"
            >
              <Plus size={13} strokeWidth={1.6} />
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
        <div className="h-px w-full bg-ink/10" aria-hidden="true" />
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-paper xl:hidden">
          <div className="h-px w-full bg-ink/55" />
          <div className="flex h-[76px] items-center justify-between border-b border-ink/10 px-5">
            <Brand compact />
            <button type="button" onClick={() => setMobileOpen(false)} className="icon-btn" aria-label="关闭菜单">
              <X size={17} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-5 py-6" aria-label="移动端导航">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center justify-between border-b border-ink/10 py-5',
                  isActive(item.to) ? 'text-ink' : 'text-ink/80',
                )}
              >
                <span className="flex items-baseline gap-4">
                  <span className="font-mono text-[12px] tracking-[0.15em] text-taupe">
                    {item.index}
                  </span>
                  <span>
                    <span className="font-zh-title block text-[1.75rem] leading-none">{item.label}</span>
                    <span className="mt-2 block text-[10.5px] uppercase tracking-[0.18em] text-taupe">
                      {item.en}
                    </span>
                  </span>
                </span>
                {isActive(item.to) && <span className="h-1.5 w-1.5 rounded-full bg-ink" aria-hidden="true" />}
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-ink/10 px-5 py-6">
            <button type="button" onClick={() => openAdd()} className="btn btn-primary w-full">
              <Plus size={14} /> 添加电影
            </button>
            <p className="mt-4 text-center text-[12.5px] tracking-[0.08em] text-taupe">
              {filmCount(records.length)} · 保存在这台设备
            </p>
          </div>
        </div>
      )}

      {!storageAvailable && (
        <div className="border-b border-ink/25 bg-ink/[0.06] px-5 py-2 text-center text-[12.5px] tracking-[0.04em] text-ink">
          浏览器本地存储不可用，刷新页面后本次记录将无法保留。
        </div>
      )}

      <main id="main" key={location.pathname} className="overflow-x-hidden">
        {children}
      </main>

      <footer className="chapter--night border-t border-paper/15">
        <div className="shell py-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.5fr_0.8fr_0.8fr_1fr] lg:gap-16">
            <div>
              <p className="kicker">Frame by Frame · 第一卷 / 2026</p>
              <p className="mt-6 max-w-md font-display text-[2.3rem] leading-[1.02] tracking-[-0.02em] text-paper sm:text-[2.8rem]">
                Every film leaves a frame.
                <br />
                <span className="italic text-paper-dim">Every frame tells your story.</span>
              </p>
              <p className="mt-5 max-w-xs text-[14px] leading-[1.9] text-paper-dim">
                每一部电影都留下一帧，每一帧都在讲述你的故事。这是一座只属于你的电影记忆博物馆：片库、笔记与审美解读都保存在这台设备上，不会上传到服务器。
              </p>
            </div>

            <div className="lg:border-l lg:border-paper/15 lg:pl-6">
              <p className="text-[12.5px] font-medium tracking-[0.08em] text-paper-dim">馆内导航</p>
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
              <p className="text-[12.5px] font-medium tracking-[0.08em] text-paper-dim">片库记录</p>
              <ul className="mt-5 space-y-3 text-[14px] leading-relaxed text-paper-dim">
                <li>{filmCount(records.length)}已收录</li>
                <li>本地存储 · 版本 2</li>
                <li>无需注册账号</li>
                <li className="text-paper-dim">仅在你授权后调用在线 AI，随时可关闭</li>
              </ul>
            </div>

            <div className="lg:border-l lg:border-paper/15 lg:pl-6">
              <p className="text-[12.5px] font-medium tracking-[0.08em] text-paper-dim">关于 AI</p>
              <p className="mt-5 text-[13.5px] leading-[1.9] text-paper-dim">
                只有你主动授权后，才会把这一次记录发送给已配置的在线 AI 服务，生成情绪、主题和六维证据。未授权或服务未连接时不会生成任何 AI 解读；你的原始笔记始终只保存在本机。每条判断都带有置信度与原句依据，你可以同意、质疑或修正。
              </p>
              <p className="mt-4 text-[12.5px] leading-[1.8] text-paper-dim/60">
                你的笔记默认只保存在本机浏览器。勾选同意后，单次分析所需的笔记、评分和少量相关旧片摘要才会发送给在线 AI 服务；模型密钥只保存在服务端。海报与剧照来自 TMDB 的官方影片图片，或经过核验的官方海报本地副本。
              </p>
              <p className="mt-2 text-[12.5px] leading-[1.8] text-paper-dim/50">
                本产品使用 TMDB API，但未获得 TMDB 的认可或认证。
              </p>
              <div className="mt-6">
                {confirmReset ? (
                  <div className="border border-paper/20 p-3">
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
                        className="btn btn-primary h-8 px-3 text-[12px]"
                      >
                        恢复示例
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="btn btn-ghost h-8 px-3 text-[12px]"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-2 text-[12px] tracking-[0.08em] text-paper-dim transition-colors hover:text-paper"
                  >
                    <RotateCcw size={11} /> 恢复示例数据
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-16 flex flex-col gap-3 border-t border-paper/15 pt-6 text-[12px] tracking-[0.08em] text-paper-dim sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Frame by Frame · 学生原型</p>
            <p>为滴普杯 · DeepWorks 而作</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
