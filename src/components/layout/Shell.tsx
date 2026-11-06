import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Menu, Plus, RotateCcw, X } from 'lucide-react'
import { useAppStore } from '@/store/AppStore'
import { useAddFilm } from '@/components/add/AddFilmProvider'
import { cn } from '@/lib/format'
import { useLockBody } from '@/components/ui/Toast'

const NAV = [
  { to: '/', label: 'My Cinema', zh: '我的影院', index: '01' },
  { to: '/archive', label: 'My Archive', zh: '电影档案', index: '02' },
  { to: '/map', label: 'Memory Map', zh: '记忆地图', index: '03' },
  { to: '/taste', label: 'My Taste', zh: 'AI 眼中的我', index: '04' },
  { to: '/reflection', label: 'Reflection', zh: '电影回忆', index: '05' },
]

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
  <Link to="/" className="group flex items-center gap-3" aria-label="Frame by Frame — home">
    <Mark className="h-7 w-7 text-paper transition-colors group-hover:text-brass" />
    <span className="flex flex-col">
      <span className="font-display text-[18px] leading-none tracking-[0.005em] text-paper sm:text-[21px]">
        Frame <span className="italic text-brass-soft">by</span> Frame
      </span>
      {!compact && (
        <span className="mt-[5px] hidden font-mono text-[8px] uppercase tracking-[0.24em] text-paper-muted sm:block">
          Private cinema archive · Est. 2026
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
    document.title = current
      ? `${current.label} · Frame by Frame`
      : 'Frame by Frame — A Personal Cinema Memory Museum'
  }, [location.pathname])

  const isActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname.startsWith(to)

  return (
    <div className="grain relative min-h-screen bg-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[130] focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-[60] bg-ink/92 backdrop-blur-xl">
        <div className="h-px w-full bg-brass/70" aria-hidden="true" />
        <div className="shell flex h-[68px] items-stretch justify-between gap-3 lg:gap-6">
          <div className="flex items-center">
            <Brand />
          </div>

          <nav className="hidden items-stretch lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'group relative flex flex-col justify-center border-l border-white/[0.07] px-5 transition-colors xl:px-6',
                  isActive(item.to) ? 'text-paper' : 'text-paper-muted hover:text-paper',
                )}
              >
                <span className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'font-mono text-[7px] tracking-[0.14em]',
                      isActive(item.to) ? 'text-brass' : 'text-paper-muted/50',
                    )}
                  >
                    {item.index}
                  </span>
                  <span className="text-[9.5px] uppercase tracking-[0.2em]">{item.label}</span>
                </span>
                <span className="mt-[3px] text-[8.5px] tracking-[0.14em] text-paper-muted/55">
                  {item.zh}
                </span>
                <span
                  className={cn(
                    'absolute inset-x-0 bottom-0 h-[2px] origin-left bg-brass transition-transform duration-500',
                    isActive(item.to) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50',
                  )}
                />
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden text-right xl:block">
              <p className="font-mono text-[9px] tracking-[0.18em] text-paper-dim">
                {String(records.length).padStart(2, '0')} FILMS
              </p>
              <p className="mt-1 font-mono text-[7.5px] uppercase tracking-[0.2em] text-paper-muted/60">
                Local archive
              </p>
            </div>
            <button
              type="button"
              onClick={() => openAdd()}
              className="btn btn-primary h-9 shrink-0 px-3 text-[9px] sm:px-5"
              aria-label="Add a film"
            >
              <Plus size={13} strokeWidth={1.6} />
              <span className="hidden sm:inline">Add a Film</span>
              <span className="sm:hidden">Add</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="icon-btn lg:hidden"
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <Menu size={17} />
            </button>
          </div>
        </div>
        <div className="h-px w-full bg-white/10" aria-hidden="true" />
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-[#0d0d0d] lg:hidden">
          <div className="h-px w-full bg-brass/70" />
          <div className="flex h-[68px] items-center justify-between border-b border-white/10 px-5">
            <Brand compact />
            <button type="button" onClick={() => setMobileOpen(false)} className="icon-btn" aria-label="Close menu">
              <X size={17} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-5 py-6" aria-label="Mobile">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-baseline justify-between border-b border-white/10 py-5',
                  isActive(item.to) ? 'text-paper' : 'text-paper-dim',
                )}
              >
                <span className="flex items-baseline gap-4">
                  <span className="font-mono text-[9px] tracking-[0.15em] text-brass/70">
                    {item.index}
                  </span>
                  <span className="font-display text-[2.1rem] leading-none">{item.label}</span>
                </span>
                <span className="zh-label text-[9px] text-paper-muted">{item.zh}</span>
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-white/10 px-5 py-6">
            <button type="button" onClick={() => openAdd()} className="btn btn-primary w-full">
              <Plus size={14} /> Add a Film
            </button>
            <p className="mt-4 text-center font-mono text-[9px] tracking-[0.16em] text-paper-muted">
              {String(records.length).padStart(2, '0')} FILMS IN YOUR LOCAL ARCHIVE
            </p>
          </div>
        </div>
      )}

      {!storageAvailable && (
        <div className="border-b border-brass/30 bg-brass/10 px-5 py-2 text-center text-[9px] uppercase tracking-[0.16em] text-brass-soft">
          Local storage is unavailable — records will not survive a refresh in this browser.
        </div>
      )}

      <main id="main" key={location.pathname} className="overflow-x-hidden">
        {children}
      </main>

      <footer className="chapter--night border-t border-white/10">
        <div className="shell py-16 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.5fr_0.8fr_0.8fr_1fr] lg:gap-16">
            <div>
              <p className="kicker">Frame by Frame · Vol. 01 / 2026</p>
              <p className="mt-6 max-w-md font-display text-[2.3rem] leading-[1.02] tracking-[-0.02em] text-paper sm:text-[2.8rem]">
                Every film leaves a frame.
                <br />
                <span className="italic text-paper-dim">Every frame tells your story.</span>
              </p>
              <p className="mt-5 max-w-xs text-[11.5px] leading-relaxed text-paper-muted">
                An independent archive of the films you keep, the notes you write, and the person
                they reveal. Local-first; your archive lives in this browser, not on a server.
              </p>
            </div>

            <div className="lg:pl-6 lg:border-l lg:border-white/10">
              <p className="micro-sm text-paper-muted">The Museum</p>
              <ul className="mt-5 space-y-3">
                {NAV.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="link-underline text-[11.5px] text-paper-dim transition-colors hover:text-paper"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="lg:pl-6 lg:border-l lg:border-white/10">
              <p className="micro-sm text-paper-muted">On the Record</p>
              <ul className="mt-5 space-y-3 text-[11.5px] text-paper-dim">
                <li>{String(records.length).padStart(2, '0')} films archived</li>
                <li>Local storage · v1</li>
                <li>No account required</li>
                <li className="text-paper-muted">Mock AI · not a live model</li>
              </ul>
            </div>

            <div className="lg:pl-6 lg:border-l lg:border-white/10">
              <p className="micro-sm text-paper-muted">A Note on the AI</p>
              <p className="mt-5 text-[11.5px] leading-relaxed text-paper-muted">
                The taste readings in this build are produced by a transparent local engine:
                weighted ratings, note length, and theme overlap. No API key, no model call, and no
                claim that a model has read your mind.
              </p>
              <p className="mt-4 text-[10px] leading-relaxed text-paper-muted/60">
                Film frames are original editorial reconstructions, not official stills or posters.
              </p>
              <div className="mt-6">
                {confirmReset ? (
                  <div className="border border-white/15 p-3">
                    <p className="text-[11px] leading-relaxed text-paper-dim">
                      Reset to the ten sample films? Your own records will be removed.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          resetDemo()
                          setConfirmReset(false)
                        }}
                        className="btn btn-primary h-8 px-3 text-[9px]"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="btn btn-ghost h-8 px-3 text-[9px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[0.18em] text-paper-muted transition-colors hover:text-paper"
                  >
                    <RotateCcw size={11} /> Reset demo data
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-6 font-mono text-[9px] uppercase tracking-[0.18em] text-paper-muted sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Frame by Frame · A student prototype</p>
            <p>Built for 滴普杯 · DeepWorks</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
