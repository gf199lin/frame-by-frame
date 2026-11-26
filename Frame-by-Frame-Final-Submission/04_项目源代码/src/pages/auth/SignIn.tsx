import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight } from 'lucide-react'
import { AuthShell } from '@/pages/auth/AuthShell'
import { getSupabaseClient, SUPABASE_CONFIG_HINT } from '@/lib/supabase/client'
import { authErrorMessage } from '@/lib/supabase/auth'

type LocationState = { from?: string } | null

export const SignIn = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const nextPath = (() => {
    const from = (location.state as LocationState)?.from
    return from && from.startsWith('/') ? from : '/'
  })()

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return

    const client = getSupabaseClient()
    if (!client) {
      setError(SUPABASE_CONFIG_HINT)
      return
    }

    setPending(true)
    setError('')

    const { error: signInError } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (signInError) {
      setError(authErrorMessage(signInError))
      setPending(false)
      return
    }

    navigate(nextPath, { replace: true })
  }

  return (
    <AuthShell
      eyebrow="SIGN IN / 回到片库"
      title="继续你的观影记忆"
      subtitle="用邮箱和密码登录。你的片库、笔记与审美画像会跟着这个账号走。"
      footer={
        <p>
          还没有账号？{' '}
          <Link to="/auth/sign-up" className="link-rule text-ink">
            创建一个
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-6" noValidate>
        <div>
          <label htmlFor="signin-email" className="field-label">
            邮箱
          </label>
          <input
            id="signin-email"
            className="input"
            type="email"
            name="email"
            autoComplete="email"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <div className="field-label">
            <label htmlFor="signin-password">密码</label>
            <Link to="/auth/forgot" className="text-[13px] text-brass transition-colors hover:text-ink">
              忘记密码？
            </Link>
          </div>
          <input
            id="signin-password"
            className="input"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="至少 8 位"
          />
        </div>

        {error && (
          <p
            role="alert"
            aria-live="polite"
            className="flex items-start gap-2.5 border border-ink/20 bg-sheet px-4 py-3 text-[13.5px] leading-[1.75] text-ink"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-sand" />
            <span>{error}</span>
          </p>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? '正在登录…' : '进入我的片库'}
          {!pending && <ArrowRight size={14} />}
        </button>

        <p className="text-[12.5px] leading-[1.8] text-taupe">
          登录状态会保留在这台设备上。在共用电脑上使用完，记得在「账号」页退出。
        </p>
      </form>
    </AuthShell>
  )
}
