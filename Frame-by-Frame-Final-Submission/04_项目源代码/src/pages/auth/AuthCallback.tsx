import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, MailWarning } from 'lucide-react'
import { AuthShell } from '@/pages/auth/AuthShell'
import { useSession } from '@/auth/session'

export const AuthCallback = () => {
  const { session, loading } = useSession()
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 3500)
    return () => window.clearTimeout(timer)
  }, [])

  if (loading || (!session && !slow)) {
    return (
      <AuthShell
        eyebrow="CONFIRMING / 正在确认"
        title="正在打开你的片库"
        subtitle="正在验证邮件里的安全链接，请稍等。"
      >
        <p className="text-[14.5px] leading-[1.9] text-ink/70">这一步不会读取你的笔记。</p>
      </AuthShell>
    )
  }

  if (session) {
    return (
      <AuthShell
        eyebrow="CONFIRMED / 邮箱已验证"
        title="欢迎回来"
        subtitle="邮箱已经确认。现在可以进入你的私人片库，开始记录下一部电影。"
      >
        <div className="flex items-start gap-4 border border-ink/15 bg-sheet px-5 py-5">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-brass" />
          <p className="text-[14.5px] leading-[1.9] text-ink/80">
            登录状态已经保存在这台设备上。换设备时，用同一个邮箱登录即可。
          </p>
        </div>
        <Link to="/" className="btn btn-primary mt-6 w-full">
          进入我的片库
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="LINK / 链接未生效"
      title="这个验证链接打不开"
      subtitle="链接可能已经过期，或者是在另一台设备 / 另一个浏览器里打开的。"
    >
      <div className="flex items-start gap-4 border border-ink/15 bg-sheet px-5 py-5">
        <MailWarning size={20} className="mt-0.5 shrink-0 text-sand" />
        <p className="text-[14.5px] leading-[1.9] text-ink/80">
          最稳妥的做法：回到注册时用的浏览器，重新登录；如果仍未验证，重新发一次验证邮件。
        </p>
      </div>
      <Link to="/welcome" className="btn btn-primary mt-6 w-full">
        返回登录
      </Link>
      <Link to="/auth/sign-up" className="btn btn-ghost mt-3 w-full">
        重新注册 / 重发邮件
      </Link>
    </AuthShell>
  )
}
