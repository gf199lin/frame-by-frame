import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppStoreProvider, useAppStore } from '@/store/AppStore'
import { ToastProvider } from '@/components/ui/Toast'
import { AddFilmProvider } from '@/components/add/AddFilmProvider'
import { Shell } from '@/components/layout/Shell'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { Home } from '@/pages/Home'
import { Archive } from '@/pages/Archive'
import { FilmDetail } from '@/pages/FilmDetail'
import { MemoryMapPage } from '@/pages/MemoryMap'
import { Taste } from '@/pages/Taste'
import { Reflection } from '@/pages/Reflection'
import { NotFound } from '@/pages/NotFound'

const BootScreen = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-ink px-6">
    <div className="w-full max-w-[280px]">
      <div className="flex items-center justify-between">
        <p className="micro text-paper/50">Frame by Frame</p>
        <p className="micro-sm text-paper-muted">始于 2026</p>
      </div>
      <p className="mt-5 font-zh-title text-3xl leading-tight text-paper">
        正在打开你的片库<span className="text-paper">。</span>
      </p>
      <div className="relative mt-8 h-px w-full overflow-hidden bg-white/15">
        <div className="absolute inset-y-0 left-0 w-1/3 animate-[boot_1.1s_ease-in-out_infinite] bg-paper" />
      </div>
      <p className="mt-4 text-[13px] leading-[1.8] text-paper-muted">
        正在读取保存在这台设备上的片库，不会向服务器发送任何内容。
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

const AppRoutes = () => {
  const { hydrated } = useAppStore()
  if (!hydrated) return <BootScreen />

  return (
    <AddFilmProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/archive/:filmId" element={<FilmDetail />} />
          <Route path="/map" element={<MemoryMapPage />} />
          <Route path="/taste" element={<Taste />} />
          <Route path="/reflection" element={<Reflection />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Shell>
    </AddFilmProvider>
  )
}

const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/'

export const App = () => (
  <ErrorBoundary>
    <BrowserRouter basename={routerBasename}>
      <AppStoreProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AppStoreProvider>
    </BrowserRouter>
  </ErrorBoundary>
)
