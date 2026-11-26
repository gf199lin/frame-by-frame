/** Helpers shared by every auth screen. No secrets live here. */

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '')

/**
 * Absolute URL Supabase should send the user back to.
 * Works both on localhost and under a GitHub Pages sub-path.
 */
export const authRedirect = (path: string): string => {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `${window.location.origin}${basePath}${clean}`
}

/**
 * Translate Supabase's English errors into calm Chinese copy.
 * Never echo the raw message: it can reveal whether an account exists.
 */
export const authErrorMessage = (error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const message = raw.toLowerCase()

  if (message.includes('invalid login credentials')) {
    return '邮箱或密码不正确。'
  }
  if (message.includes('email not confirmed')) {
    return '这个邮箱还没有验证，请先查收验证邮件。'
  }
  if (message.includes('user already registered')) {
    return '这个邮箱已经注册过了，直接登录即可。'
  }
  if (message.includes('password should be at least')) {
    return '密码至少需要 8 位。'
  }
  if (message.includes('pkce') || message.includes('code verifier')) {
    return '这个链接需要在注册时的同一浏览器中打开。也可以回到上一页重新发送邮件。'
  }
  if (
    message.includes('rate limit') ||
    message.includes('too many') ||
    message.includes('only request this after')
  ) {
    return '请求有点频繁，请等一分钟再试。'
  }
  if (message.includes('failed to fetch') || message.includes('network')) {
    return '网络连接失败，请检查网络后重试。'
  }
  if (message.includes('expired') || message.includes('invalid token')) {
    return '这个链接已经过期，请重新发送一次。'
  }
  return '操作没有完成，请稍后重试。'
}

export const PASSWORD_MIN_LENGTH = 8
