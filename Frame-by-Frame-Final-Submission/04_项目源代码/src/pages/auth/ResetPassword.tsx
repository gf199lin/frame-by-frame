import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, KeyRound } from 'lucide-react'
import { AuthShell } from '@/pages/auth/AuthShell'
import { useSession } from '@/auth/session'
import { getSupabaseClient, SUPABASE_CONFIG_HINT } from '@/lib/supabase/client'
import { PASSWORD_MIN_LENGTH, authErrorMessage } from '@/lib/supabase/auth'

export const ResetPassword = () => {
  const navigate = useNavigate()
  const { session, loading, signOut } = useSession()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`密码至少需要 ${PASSWORD_MIN_LENGTH} 位。`)
      return
    }
    if (password !== confirm) {
      setError('两次输入的密码不一致。')
      return
    }

    const client = getSupabaseClient()
    if (!client) {
      setError(SUPABASE_CONFIG_HINT)
      return
    }

    setPending(true)
    setError('')

    const { error: updateError } = await client.auth.updateUser({ password })

    if (updateError) {
      setError(authErrorMessage(updateError))
      setPending(false)
      return
    }

    setDone(true)
    setPending(false)
    await signOut()
  }

  if (done) {
    return (
      <AuthShell
        eyebrow="PASSWORD / 已完成"
        title="密码已经换好了"
        subtitle="下次登录请使用新密码。出于安全考虑，这台设备上的会话已经退出。"
      >
        <div className="flex items-start gap-4 border border-ink/15 bg-sheet px-5 py-5">
          <KeyRound size={20} className="mt-0.5 shrink-0 text-brass" />
          <p className="text-[14.5px] leading-[1.9] text-ink/80">
            如果这不是你本人的操作，请立刻重新走一次「忘记密码」，并检查邮箱是否被盗用。
          </p>
        </div>
        <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => navigate('/welcome', { replace: true })}>
          去登录
        </button>
      </AuthShell>
    )
  }

  if (loading) {
    return (
      <AuthShell eyebrow="PASSWORD / 验证链接" title="正在确认重置链接" subtitle="只需要一秒钟。">
        <p className="text-[14.5px] leading-[1.9] text-ink/70">正在读取安全会话…</p>
      </AuthShell>
    )
  }

  if (!session) {
    return (
      <AuthShell
        eyebrow="PASSWORD / 链接不可用"
        title="这个重置链接已经失效"
        subtitle="链接可能已过期，或在另一台设备 / 另一个浏览器中打开过。重新发送一次即可。"
      >
        <div className="flex items-start gap-4 border border-ink/15 bg-sheet px-5 py-5">
          <AlertCircle size={20} className="mt-0.5 shrink-0 text-sand" />
          <p className="text-[14.5px] leading-[1.9] text-ink/80">
            为了确认是你本人，重置链接必须和申请时的浏览器一致。
          </p>
        </div>
        <Link to="/auth/forgot" className="btn btn-primary mt-6 w-full">
          重新发送重置邮件
        </Link>
        <Link to="/welcome" className="btn btn-ghost mt-3 w-full">
          返回登录
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="PASSWORD / 设置新密码"
      title="给这段记忆换一把新钥匙"
      subtitle="设置一个至少 8 位的新密码。完成后会退出当前会话，请用新密码重新登录。"
      footer={
        <p>
          <Link to="/welcome" className="link-rule text-ink">
            放弃修改，返回登录
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-6" noValidate>
        <div>
          <label htmlFor="reset-password" className="field-label">
            新密码
          </label>
          <input
            id="reset-password"
            className="input"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={`至少 ${PASSWORD_MIN_LENGTH} 位`}
          />
        </div>

        <div>
          <label htmlFor="reset-confirm" className="field-label">
            再输一次
          </label>
          <input
            id="reset-confirm"
            className="input"
            type="password"
            name="confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            placeholder="确认没有打错"
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
          {pending ? '正在保存…' : '保存新密码'}
        </button>
      </form>
    </AuthShell>
  )
}
