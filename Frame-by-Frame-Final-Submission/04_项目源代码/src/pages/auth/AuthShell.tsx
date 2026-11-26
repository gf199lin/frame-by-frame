import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

const Mark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 30 30" className={className} aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.1" />
    <rect x="6" y="6" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.55" />
    <rect x="11" y="11" width="8" height="8" fill="currentColor" opacity="0.95" />
  </svg>
)

type AuthShellProps = {
  eyebrow: string
  title: ReactNode
  subtitle: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/**
 * Shared frame for sign in / sign up / password screens.
 * Cream paper, ocean ink, hairline rules — a film annual, not a dashboard.
 */
export const AuthShell = ({ eyebrow, title, subtitle, children, footer }: AuthShellProps) => (
  <div className="min-h-screen bg-paper text-ink lg:grid lg:grid-cols-[1.08fr_0.92fr]">
    <div className="flex min-h-screen flex-col px-5 pb-8 pt-6 sm:px-10 lg:px-16">
      <header className="flex items-center justify-between gap-4">
        <Link to="/welcome" className="group flex items-center gap-2.5" aria-label="Frame by Frame 首页">
          <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-ink text-paper shadow-[0_8px_18px_rgba(29,35,121,0.2)] transition-transform duration-300 group-hover:-translate-y-0.5">
            <Mark className="h-[19px] w-[19px]" />
          </span>
          <span className="font-display text-[21px] leading-none tracking-[0.005em]">
            Frame <span className="italic text-taupe">by</span> Frame
          </span>
        </Link>
        <p className="micro text-taupe">私人电影记忆 · 2026</p>
      </header>

      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-12 sm:py-16">
        <p className="micro text-brass">{eyebrow}</p>
        <h1 className="mt-4 font-zh-title text-[2rem] leading-[1.3] text-ink sm:text-[2.35rem]">{title}</h1>
        <p className="mt-4 text-[15.5px] leading-[1.9] text-ink/70">{subtitle}</p>
        <div className="mt-9">{children}</div>
        {footer && <div className="mt-8 text-[14.5px] leading-[1.8] text-ink/65">{footer}</div>}
      </main>

      <footer className="flex items-center justify-between gap-4 text-[12px] tracking-[0.06em] text-taupe/85">
        <span>FRAME BY FRAME</span>
        <span>每一帧，都是你的</span>
      </footer>
    </div>

    <aside className="relative hidden overflow-hidden bg-ink px-14 py-14 text-paper lg:flex lg:flex-col lg:justify-between xl:px-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-6 border border-paper/15" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-28 top-[22%] h-80 w-80 rounded-full border border-paper/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-16 bottom-[18%] h-56 w-56 rounded-full border border-paper/10"
      />

      <p className="relative font-mono text-[11px] tracking-[0.28em] text-paper/55">ISSUE 01 / MEMORY</p>

      <blockquote className="relative my-16 max-w-[430px]">
        <p className="font-zh-title text-[2.15rem] leading-[1.5] text-paper xl:text-[2.45rem]">
          电影记忆属于你本人，
          <br />
          而不是某一台设备上的
          <br />
          <span className="italic text-paper-dim">浏览器。</span>
        </p>
        <p className="mt-8 text-[14.5px] leading-[1.95] text-paper-dim">
          这里保存的不是评分表，而是你一次次在黑暗里被击中的瞬间。
          登录之后，片库、笔记与审美解读会以你的账号为单位，慢慢长成一座只属于你的博物馆。
        </p>
      </blockquote>

      <div className="relative border-t border-paper/20 pt-5 text-[12.5px] leading-[1.85] text-paper/65">
        私人影评默认仅自己可见。
        <br />
        只有你主动授权时，笔记才会被送去生成 AI 解读。
      </div>
    </aside>
  </div>
)
