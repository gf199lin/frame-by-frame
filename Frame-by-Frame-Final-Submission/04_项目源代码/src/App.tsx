import { useMemo } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppStoreProvider, useAppStore } from '@/store/AppStore'
import { setStorageScope } from '@/lib/storage'
import { ToastProvider } from '@/components/ui/Toast'
import { AddFilmProvider } from '@/components/add/AddFilmProvider'
import { Shell } from '@/components/layout/Shell'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { SessionProvider, useSession } from '@/auth/session'
import { SUPABASE_CONFIG_HINT } from '@/lib/supabase/client'
import { Home } from '@/pages/Home'
import { Archive } from '@/pages/Archive'
import { FilmDetail } from '@/pages/FilmDetail'
import { MemoryMapPage } from '@/pages/MemoryMap'
import { Taste } from '@/pages/Taste'
import { ObservationDetail } from '@/pages/ObservationDetail'
import { Reflection } from '@/pages/Reflection'
import { Account } from '@/pages/Account'
import { NotFound } from '@/pages/NotFound'
import { SignIn } from '@/pages/auth/SignIn'
import { SignUp } from '@/pages/auth/SignUp'
import { ForgotPassword } from '@/pages/auth/ForgotPassword'
import { ResetPassword } from '@/pages/auth/ResetPassword'
import { AuthCallback } from '@/pages/auth/AuthCallback'

const BootScreen = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6">
    <div className="w-full max-w-[280px]">
      <div className="flex items-center justify-between">
        <p className="micro text-paper/50">Frame by Frame</p>
        <p className="micro-sm text-paper-muted">始于 2026</p>
      </div>
      <p className="mt-5 font-zh-title text-3xl leading-tight text-paper">正在打开你的片库</p>
      <div className="relative mt-8 h-px w-full overflow-hidden bg-white/15">
        <div className="absolute inset-y-0 left-0 w-1/3 animate-[boot_1.1s_ease-in-out_infinite] bg-paper" />
      </div>
      <p className="mt-4 text-[13px] leading-[1.8] text-paper-muted">
        正在确认登录状态。你的笔记不会在这里被读取或上传。
      </p>
    </div>
    <style>{`
      @keyframes boot {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(400%); }
      }
    `}</style>
  </div>
)

const ConfigMissing = () => (
  <div className="flex min-h-screen items-center justify-center bg-paper px-6">
    <div className="w-full max-w-[460px] border border-ink/15 bg-sheet px-7 py-8">
      <p className="micro text-brass">CONFIG / 未连接</p>
      <h1 className="mt-4 font-zh-title text-[1.9rem] leading-[1.35]">还没有连接到云端</h1>
      <p className="mt-4 text-[15px] leading-[1.9] text-ink/70">{SUPABASE_CONFIG_HINT}</p>
      <p className="mt-3 text-[13px] leading-[1.8] text-taupe">
        这是本机配置问题，不是账号问题。填写后需要重启开发服务器。
      </p>
    </div>
  </div>
)

/** Auth screens: visible only while signed out. */
const PublicOnly = ({ children }: { children: JSX.Element }) => {
  const { session, loading, configured } = useSession()
  if (!configured) return <ConfigMissing />
  if (loading) return <BootScreen />
  if (session) return <Navigate to="/" replace />
  return children
}

/** Protected area: every business route lives behind this gate. */
const ProtectedLayout = () => {
  const { session, loading, configured } = useSession()
  const location = useLocation()
  const userId = session?.user.id ?? null

  // Scope local storage before AppStore mounts, so two accounts signing in on
  // the same browser never share one archive.
  useMemo(() => {
    setStorageScope(userId)
    return userId
  }, [userId])

  if (!configured) return <ConfigMissing />
  if (loading) return <BootScreen />
  if (!session) {
    return <Navigate to="/welcome" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return (
    <AppStoreProvider>
      <ToastProvider>
        <HydratedShell />
      </ToastProvider>
    </AppStoreProvider>
  )
}

const HydratedShell = () => {
  const { hydrated } = useAppStore()
  if (!hydrated) return <BootScreen />

  return (
    <AddFilmProvider>
      <Shell>
        <Outlet />
      </Shell>
    </AddFilmProvider>
  )
}

const AppRoutes = () => (
  <Routes>
    <Route
      path="/welcome"
      element={
        <PublicOnly>
          <SignIn />
        </PublicOnly>
      }
    />
    <Route
      path="/auth/sign-up"
      element={
        <PublicOnly>
          <SignUp />
        </PublicOnly>
      }
    />
    <Route
      path="/auth/forgot"
      element={
        <PublicOnly>
          <ForgotPassword />
        </PublicOnly>
      }
    />
    {/* Recovery links must work with a live session, so this route is public. */}
    <Route path="/auth/reset" element={<ResetPassword />} />
    <Route path="/auth/callback" element={<AuthCallback />} />

    <Route element={<ProtectedLayout />}>
      <Route path="/" element={<Home />} />
      <Route path="/archive" element={<Archive />} />
      <Route path="/archive/:filmId" element={<FilmDetail />} />
      <Route path="/map" element={<MemoryMapPage />} />
      <Route path="/taste" element={<Taste />} />
      <Route path="/taste/observations/:observationId" element={<ObservationDetail />} />
      <Route path="/reflection" element={<Reflection />} />
      <Route path="/account" element={<Account />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  </Routes>
)

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export const App = () => (
  <ErrorBoundary>
    <BrowserRouter basename={routerBasename}>
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  </ErrorBoundary>
)
