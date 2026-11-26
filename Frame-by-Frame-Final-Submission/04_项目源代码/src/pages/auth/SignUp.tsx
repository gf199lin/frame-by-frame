import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowRight, MailCheck } from 'lucide-react'
import { AuthShell } from '@/pages/auth/AuthShell'
import { getSupabaseClient, SUPABASE_CONFIG_HINT } from '@/lib/supabase/client'
import { PASSWORD_MIN_LENGTH, authErrorMessage, authRedirect } from '@/lib/supabase/auth'

export const SignUp = () => {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState('')

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

    const { data, error: signUpError } = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { display_name: name.trim() },
        emailRedirectTo: authRedirect('/auth/callback'),
      },
    })

    if (signUpError) {
      setError(authErrorMessage(signUpError))
      setPending(false)
      return
    }

    if (data.session) {
      navigate('/', { replace: true })
      return
    }

    setSentTo(email.trim())
    setPending(false)
  }

  if (sentTo) {
    return (
      <AuthShell
        eyebrow="CHECK YOUR INBOX / 还差一步"
        title="去邮箱确认一下"
        subtitle={
          <>
            如果 <span className="text-ink">{sentTo}</span> 还没有注册过，我们已经发出一封验证邮件。
            点击邮件里的链接后，就能进入你的片库。
          </>
        }
        footer={
          <p>
            没有收到？先看看垃圾邮件；还没好就{' '}
            <button
              type="button"
              className="link-rule text-ink"
              onClick={() => {
                setSentTo('')
                setError('')
              }}
            >
              换一个邮箱重试
            </button>
            。
          </p>
        }
      >
        <div className="flex items-start gap-4 border border-ink/15 bg-sheet px-5 py-5">
          <MailCheck size={20} className="mt-0.5 shrink-0 text-brass" />
          <div className="text-[14.5px] leading-[1.9] text-ink/80">
            <p>验证链接请在注册时的同一浏览器中打开。</p>
            <p className="mt-2 text-taupe">已经验证过了？直接去登录即可。</p>
          </div>
        </div>
        <Link to="/welcome" className="btn btn-ghost mt-6 w-full">
          返回登录
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow="CREATE ACCOUNT / 建立你自己的片库"
      title="把记忆交给账号，而不是浏览器"
      subtitle="一个邮箱，一座只属于你的电影博物馆。私人影评默认仅自己可见。"
      footer={
        <p>
          已经有账号？{' '}
          <Link to="/welcome" className="link-rule text-ink">
            去登录
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-6" noValidate>
        <div>
          <label htmlFor="signup-name" className="field-label">
            昵称 <span className="font-normal text-taupe">可选</span>
          </label>
          <input
            id="signup-name"
            className="input"
            type="text"
            name="display_name"
            autoComplete="nickname"
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="你希望被怎么称呼"
          />
        </div>

        <div>
          <label htmlFor="signup-email" className="field-label">
            邮箱
          </label>
          <input
            id="signup-email"
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
          <label htmlFor="signup-password" className="field-label">
            密码
          </label>
          <input
            id="signup-password"
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
          <label htmlFor="signup-confirm" className="field-label">
            再输一次密码
          </label>
          <input
            id="signup-confirm"
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
          {pending ? '正在创建…' : '创建账号'}
          {!pending && <ArrowRight size={14} />}
        </button>

        <p className="text-[12.5px] leading-[1.8] text-taupe">
          注册即表示你了解：笔记默认仅自己可见；只有你主动授权后，单篇笔记才会被发送给第三方 AI 服务生成解读。
        </p>
      </form>
    </AuthShell>
  )
}
