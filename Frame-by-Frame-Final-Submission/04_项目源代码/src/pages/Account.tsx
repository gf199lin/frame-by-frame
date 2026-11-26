import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Check, LogOut, ShieldCheck } from 'lucide-react'
import { useSession } from '@/auth/session'
import { getSupabaseClient } from '@/lib/supabase/client'

type ProfileRow = {
  display_name: string | null
  created_at: string | null
}

const formatDate = (value: string | null) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(date)
}

export const Account = () => {
  const navigate = useNavigate()
  const { user, signOut } = useSession()
  const client = getSupabaseClient()

  const [name, setName] = useState('')
  const [createdAt, setCreatedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!client || !user) return
    let active = true
    setLoading(true)

    client
      .from('profiles')
      .select('display_name, created_at')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>()
      .then(({ data, error: readError }) => {
        if (!active) return
        if (readError) {
          setError('资料暂时读取失败，稍后刷新再试。')
        } else if (data) {
          setName(data.display_name ?? '')
          setCreatedAt(data.created_at)
        }
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [client, user])

  const saveName = async () => {
    if (!client || !user || saving) return
    setSaving(true)
    setError('')
    setSaved(false)

    const { error: writeError } = await client
      .from('profiles')
      .upsert({ id: user.id, display_name: name.trim() }, { onConflict: 'id' })

    if (writeError) {
      setError('保存没有成功，请稍后重试。')
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  const leave = async () => {
    await signOut()
    navigate('/welcome', { replace: true })
  }

  return (
    <div className="shell pb-24 pt-10 sm:pt-14">
      <div className="mx-auto max-w-[880px]">
        <p className="micro text-brass">ACCOUNT / 账号</p>
        <h1 className="mt-4 font-zh-title text-[2.1rem] leading-[1.3] sm:text-[2.5rem]">你的账号与记忆</h1>
        <p className="mt-4 max-w-[620px] text-[15.5px] leading-[1.9] text-ink/70">
          这里只保存与电影记忆有关的信息：邮箱、昵称，以及你写下的片库与笔记。没有手机号，也没有通讯录。
        </p>

        <section className="mt-10 border border-ink/15 bg-sheet px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-zh-title text-[1.35rem]">基本资料</h2>
            <p className="text-[12.5px] tracking-[0.04em] text-taupe">注册于 {formatDate(createdAt)}</p>
          </div>

          <dl className="mt-6 grid gap-6 sm:grid-cols-2">
            <div>
              <dt className="field-label">邮箱</dt>
              <dd className="mt-2 break-all text-[15px] text-ink/85">{user?.email ?? '—'}</dd>
              <p className="mt-2 text-[12.5px] leading-[1.8] text-taupe">
                邮箱由 Supabase Auth 保管，不能在这里修改。需要换邮箱请重新注册。
              </p>
            </div>
            <div>
              <dt className="field-label">
                <label htmlFor="account-name">昵称</label>
              </dt>
              <dd className="mt-2">
                <input
                  id="account-name"
                  className="input"
                  type="text"
                  maxLength={40}
                  value={name}
                  disabled={loading}
                  onChange={(event) => {
                    setName(event.target.value)
                    setSaved(false)
                  }}
                  placeholder="还没有起名字"
                />
              </dd>
            </div>
          </dl>

          {error && (
            <p role="alert" className="mt-5 flex items-start gap-2.5 border border-ink/20 px-4 py-3 text-[13.5px] leading-[1.75]">
              <AlertCircle size={15} className="mt-0.5 shrink-0 text-sand" />
              <span>{error}</span>
            </p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" onClick={saveName} disabled={saving || loading}>
              {saving ? '正在保存…' : '保存昵称'}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-[13px] text-taupe">
                <Check size={14} className="text-brass" /> 已保存
              </span>
            )}
          </div>
        </section>

        <section className="mt-6 border border-ink/15 bg-sheet px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex items-start gap-4">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brass" />
            <div>
              <h2 className="font-zh-title text-[1.35rem]">隐私与 AI</h2>
              <ul className="mt-4 space-y-3 text-[14.5px] leading-[1.9] text-ink/75">
                <li>私人影评默认仅自己可见，其他账号无法读取。</li>
                <li>只有你主动授权后，单篇笔记才会发送给第三方 AI 服务生成解读。</li>
                <li>我们不收集手机号、学号、位置或通讯录。</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-6 border border-ink/15 bg-paper px-5 py-6 sm:px-8 sm:py-8">
          <h2 className="font-zh-title text-[1.35rem]">会话与数据</h2>
          <p className="mt-3 text-[14px] leading-[1.85] text-ink/70">
            退出只结束这台设备上的登录，不会删除云端数据。
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" className="btn btn-ghost" onClick={leave}>
              <LogOut size={14} /> 退出登录
            </button>
          </div>

          <p className="mt-5 border-t border-ink/10 pt-4 text-[13px] leading-[1.85] text-taupe">
            「删除我的全部数据」会在笔记正式上云后开放。当前版本的本机档案仍保存在这台浏览器里，
            需要彻底清除时请使用浏览器的站点数据清理功能。
          </p>
        </section>

        <p className="mt-8 text-[13px] leading-[1.8] text-taupe">
          <Link to="/" className="link-rule text-ink">
            返回片库
          </Link>
        </p>
      </div>
    </div>
  )
}
