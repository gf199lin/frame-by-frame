import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Check, Info, X } from 'lucide-react'

type Tone = 'default' | 'success' | 'error'
type Toast = { id: number; message: string; tone: Tone }

const ToastContext = createContext<{ push: (message: string, tone?: Tone) => void } | null>(null)

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)

  const push = useCallback((message: string, tone: Tone = 'default') => {
    counter.current += 1
    const id = counter.current
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4200)
  }, [])

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[120] flex w-[min(22rem,calc(100vw-3rem))] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-start gap-3 rounded-[10px] border border-paper/20 bg-ink/95 px-4 py-3 shadow-2xl backdrop-blur-md animate-fade-up"
            role="status"
          >
            <span className="mt-[2px] text-paper/60">
              {toast.tone === 'success' ? <Check size={13} /> : <Info size={13} />}
            </span>
            <p className="flex-1 text-[14px] leading-relaxed text-paper">{toast.message}</p>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-paper-dim transition-colors hover:text-paper"
              aria-label="关闭提示"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}

export const useLockBody = (locked: boolean) => {
  useEffect(() => {
    if (!locked) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [locked])
}
