import { useState } from 'react'

type UserProfile = {
  username: string
  role: string
}

type LoginPageProps = {
  onLoginSuccess: (profile: UserProfile) => void
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !password.trim()) {
      setError('请输入账号和密码')
      return
    }

    setLoading(true)
    setError(null)

    const url = isLogin ? '/api/auth/login' : '/api/auth/register'

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password: password.trim(),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '操作失败，请重试')
        return
      }

      onLoginSuccess({ username: data.username, role: data.role })
    } catch {
      setError('网络请求失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-8 shadow-sm">
        <div className="text-center">
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.15em] text-[var(--accent)]">
            SnapLesson
          </p>
          <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-[var(--tracking-display)]">
            一拍成课
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            登录以开始生成或学习您的点读课程
          </p>
        </div>

        <div className="mt-6 flex border-b border-[var(--border-soft)]">
          <button
            className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors cursor-pointer ${
              isLogin
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
            onClick={() => {
              setIsLogin(true)
              setError(null)
            }}
            type="button"
          >
            登录账号
          </button>
          <button
            className={`flex-1 pb-3 text-center text-sm font-semibold transition-colors cursor-pointer ${
              !isLogin
                ? 'border-b-2 border-[var(--accent)] text-[var(--accent)]'
                : 'text-[var(--muted)] hover:text-[var(--fg)]'
            }`}
            onClick={() => {
              setIsLogin(false)
              setError(null)
            }}
            type="button"
          >
            快速注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              账号
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              placeholder="输入账号名字"
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--fg)] outline-none focus:border-[var(--accent)]"
              placeholder="输入密码"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] p-3 text-xs font-semibold text-[var(--danger)]">
              {error}
            </div>
          )}

          {!isLogin && (
            <p className="text-xs leading-5 text-[var(--muted)]">
              💡 <strong>提示</strong>: 系统的首个注册账号将自动成为<strong>系统管理员</strong>，拥有全局 AI 配置及用户管理的权限。
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-[var(--radius-md)] bg-[var(--accent)] py-3 text-sm font-semibold text-[var(--accent-on)] hover:opacity-90 disabled:opacity-50 transition cursor-pointer"
            disabled={loading}
          >
            {loading ? '处理中...' : isLogin ? '立即登录' : '创建并登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
