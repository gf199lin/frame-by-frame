import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/format'

/**
 * A single, restrained entrance: 20px rise + fade, once.
 * Nothing here should compete with the photographs.
 */
export const Reveal = ({
  children,
  className,
  delay = 0,
  as: Tag = 'div',
  amount = 0.12,
}: {
  children: ReactNode
  className?: string
  delay?: number
  as?: ElementType
  amount?: number
}) => {
  const ref = useRef<HTMLElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: amount, rootMargin: '0px 0px -8% 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [amount])

  return (
    <Tag
      ref={ref as never}
      className={cn('reveal', shown && 'is-in', className)}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  )
}
