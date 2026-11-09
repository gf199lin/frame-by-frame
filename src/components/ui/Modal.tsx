import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/format'
import { useLockBody } from './Toast'

type ModalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  labelledBy?: string
  size?: 'default' | 'wide' | 'full'
  className?: string
  hideClose?: boolean
}

export const Modal = ({
  open,
  onClose,
  children,
  labelledBy,
  size = 'default',
  className,
  hideClose = false,
}: ModalProps) => {
  useLockBody(open)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const widths = {
    default: 'max-w-2xl',
    wide: 'max-w-5xl',
    full: 'max-w-[1180px]',
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center overflow-y-auto bg-black/75 p-0 backdrop-blur-[6px] sm:items-start sm:p-6">
      <button
        type="button"
        aria-label="关闭对话框"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          'relative my-0 flex w-full flex-col border border-paper/15 bg-[#1b1814] shadow-[0_40px_120px_rgba(0,0,0,0.6)] animate-fade-up sm:my-6',
          widths[size],
          className,
        )}
      >
        {!hideClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center border border-paper/30 bg-[#211e19]/90 text-paper-dim shadow-lg backdrop-blur transition-colors hover:border-paper/60 hover:text-paper"
          >
            <X size={16} />
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}
