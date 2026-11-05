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
  <svg viewBox="0 0 28 28" className={className} aria-hidden="true">
    <rect x="1" y="1" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1" />
    <rect x="7" y="7" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="0.75" opacity="0.5" />
    <rect x="11" y="11" width="6" height="6" fill="currentColor" opacity="0.9" />
    <line x1="1" y1="1" x2="7" y2="7" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />
    <line x1="27" y1="27" x2="21" y2="21" stroke="currentColor" strokeWidth="0.6" opacity="0.4" />
  </svg>
)

const Brand = () => (
  <Link to="/" className="group flex items-center gap-3" aria-label="Frame by Frame — home">
    <Mark className="h-7 w-7 text-paper transition-colors group-hover:text-brass" />
    <span className="flex flex-col">
      <span className="font-display text-[20px] leading-none tracking-[0.01em] text-paper">
        Frame <span className="italic text-brass-soft">by</span> Frame
      </span>
      <span className="micro-sm mt-1 hidden text-paper-muted sm:block">Private Cinema Archive · Est. 2026</span>
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
      <div className="h-[2px] w-full bg-brass" aria-hidden="true" />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[130] focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-[60] border-b border-white/10 bg-ink/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-shell items-center justify-between gap-6 px-5 lg:px-10">
          <Brand />

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'group relative flex flex-col gap-[3px] py-2 transition-colors',
                  isActive(item.to) ? 'text-paper' : 'text-paper-muted hover:text-paper',
                )}
              >
                <span className="flex items-baseline gap-1.5">
                  <span
                    className={cn(
                      'font-mono text-[8px] tracking-[0.14em]',
                      isActive(item.to) ? 'text-brass' : 'text-paper-muted/60',
                    )}
                  >
                    {item.index}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em]">{item.label}</span>
                </span>
                <span className="text-[9px] tracking-[0.1em] text-paper-muted/60">{item.zh}</span>
                <span
                  className={cn(
                    'absolute -bottom-[1px] left-0 h-px w-full origin-left bg-brass transition-transform duration-500',
                    isActive(item.to) ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-50',
                  )}
                />
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden text-right xl:block">
              <p className="font-mono text-[10px] tracking-[0.16em] text-paper-dim">
                {String(records.length).padStart(2, '0')} FILMS
              </p>
              <p className="micro-sm mt-1 text-paper-muted/70">Local archive</p>
            </div>
            <button
              type="button"
              onClick={() => openAdd()}
              className="btn btn-primary h-10 px-4 text-[10px] sm:px-5"
            >
              <Plus size={13} strokeWidth={1.5} />
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
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] flex flex-col bg-[#111111] lg:hidden">
          <div className="flex h-[72px] items-center justify-between border-b border-white/10 px-5">
            <Brand />
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="icon-btn"
              aria-label="Close menu"
            >
              <X size={17} />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-5 py-8" aria-label="Mobile">
            {NAV.map((item, i) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-baseline justify-between border-b border-white/10 py-5',
                  isActive(item.to) ? 'text-paper' : 'text-paper-dim',
                )}
                style={{ animationDelay: `${i * 45}ms` }}
              >
                <span className="flex items-baseline gap-4">
                  <span className="font-mono text-[9px] tracking-[0.15em] text-brass/70">
                    {item.index}
                  </span>
                  <span className="font-display text-4xl">{item.label}</span>
                </span>
                <span className="micro-sm text-paper-muted">{item.zh}</span>
              </NavLink>
            ))}
          </nav>
          <div className="border-t border-white/10 px-5 py-6">
            <button type="button" onClick={() => openAdd()} className="btn btn-primary w-full">
              <Plus size={14} /> Add a Film
            </button>
            <p className="mt-4 text-center font-mono text-[10px] tracking-[0.14em] text-paper-muted">
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

      <main id="main" key={location.pathname} className="animate-fade-in">
        {children}
      </main>

      <footer className="border-t border-white/10 bg-[#0C0C0C]">
        <div className="mx-auto max-w-shell px-5 py-16 lg:px-10 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
            <div>
              <p className="micro text-brass">Frame by Frame · Vol. 01</p>
              <p className="mt-5 max-w-sm font-display text-4xl leading-[1.02] text-paper">
                Every film leaves a frame. Every frame tells your story.
              </p>
              <p className="mt-5 max-w-xs text-[12px] leading-relaxed text-paper-muted">
                An independent archive of the films you keep, the notes you write, and the
                person they reveal. Local-first; your archive lives in this browser, not on a server.
              </p>
            </div>

            <div>
              <p className="micro text-paper-muted">The Museum</p>
              <ul className="mt-5 space-y-3">
                {NAV.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      className="link-underline text-[12px] text-paper-dim transition-colors hover:text-paper"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="micro text-paper-muted">On the Record</p>
              <ul className="mt-5 space-y-3 text-[12px] text-paper-dim">
                <li>{String(records.length).padStart(2, '0')} films archived</li>
                <li>Local storage · v1</li>
                <li>No account required</li>
                <li className="text-paper-muted">Mock AI · not a live model</li>
              </ul>
            </div>

            <div>
              <p className="micro text-paper-muted">A Note on the AI</p>
              <p className="mt-5 text-[12px] leading-relaxed text-paper-muted">
                The taste readings in this build are produced by a transparent local engine:
                weighted ratings, note length, and theme overlap. No API key, no model call, and no
                claim that a model has read your mind.
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
                    className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-paper-muted transition-colors hover:text-paper"
                  >
                    <RotateCcw size={11} /> Reset demo data
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-6 text-[10px] uppercase tracking-[0.16em] text-paper-muted sm:flex-row sm:items-center sm:justify-between">
            <p>© 2026 Frame by Frame · A student prototype</p>
            <p className="flex items-center gap-2">
              Built for 滴普杯 · DeepWorks
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
