import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowLeft, MailCheck } from 'lucide-react'
import { AuthShell } from '@/pages/auth/AuthShell'
import { getSupabaseClient, SUPABASE_CONFIG_HINT } from '@/lib/supabase/client'
import { authErrorMessage, authRedirect } from '@/lib/supabase/auth'

export const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

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

    const { error: resetError } = await client.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: authRedirect('/auth/reset'),
    })

    if (resetError) {
      setError(authErrorMessage(resetError))
      setPending(false)
      return
    }

    setSent(true)
    setPending(false)
  }

  return (
    <AuthShell
      eyebrow="PASSWORD / 找回入口"
      title="重置你的密码"
      subtitle="填写注册时使用的邮箱。我们会发一封重置邮件，链接在一段时间内有效。"
      footer={
        <p>
          <Link to="/welcome" className="link-rule text-ink">
            返回登录
          </Link>
        </p>
      }
    >
      {sent ? (
        <div>
          <div className="flex items-start gap-4 border border-ink/15 bg-sheet px-5 py-5">
            <MailCheck size={20} className="mt-0.5 shrink-0 text-brass" />
            <div className="text-[14.5px] leading-[1.9] text-ink/80">
              <p>如果这个邮箱注册过，重置邮件已经发出。</p>
              <p className="mt-2 text-taupe">请在同一浏览器中打开邮件里的链接，否则链接可能无法验证。</p>
            </div>
          </div>
          <button type="button" className="btn btn-ghost mt-6 w-full" onClick={() => setSent(false)}>
            换一个邮箱重发
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-6" noValidate>
          <div>
            <label htmlFor="forgot-email" className="field-label">
              邮箱
            </label>
            <input
              id="forgot-email"
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
            {pending ? '正在发送…' : '发送重置邮件'}
          </button>

          <p className="flex items-center gap-2 text-[12.5px] leading-[1.8] text-taupe">
            <ArrowLeft size={13} />
            出于安全考虑，无论邮箱是否存在，提示都相同。
          </p>
        </form>
      )}
    </AuthShell>
  )
}
