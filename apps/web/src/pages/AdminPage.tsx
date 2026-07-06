import { useEffect, useState } from 'react'

interface User {
  username: string
  role: string
  disabled: boolean
}

interface AdminPageProps {
  currentUsername: string
}

export function AdminPage({ currentUsername }: AdminPageProps) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      } else {
        const data = await res.json()
        setError(data.error || '获取用户列表失败')
      }
    } catch {
      setError('网络连接错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const toggleStatus = async (username: string, currentDisabled: boolean) => {
    try {
      const res = await fetch('/api/admin/users/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, disabled: !currentDisabled })
      })
      if (res.ok) {
        setUsers(prev => prev.map(u => u.username === username ? { ...u, disabled: !currentDisabled } : u))
      } else {
        const data = await res.json()
        alert(data.error || '状态更新失败')
      }
    } catch {
      alert('网络错误')
    }
  }

  const deleteUser = async (username: string) => {
    if (username === currentUsername) {
      alert('不能删除自己')
      return
    }

    if (!window.confirm(`确定要彻底删除用户 "${username}" 吗？此操作将清除其名下所有的数据。`)) return

    try {
      const res = await fetch('/api/admin/users/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      })
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.username !== username))
      } else {
        const data = await res.json()
        alert(data.error || '删除用户失败')
      }
    } catch {
      alert('网络错误')
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-[var(--muted)]">
        <p className="font-[var(--font-mono)] text-xs uppercase tracking-widest">加载用户列表中...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] p-4 text-sm font-semibold text-[var(--danger)]">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="border-b border-[var(--border-soft)] pb-4">
        <h1 className="font-[var(--font-display)] text-2xl font-bold font-semibold">用户授权管理</h1>
        <p className="text-xs text-[var(--muted)] mt-1">管理员可在此控制用户账户的启用、禁用与删除（包含级联清除数据）</p>
      </div>

      {/* Desktop layout: Table */}
      <div className="hidden md:block overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)]">
        <table className="w-full border-collapse text-left text-sm text-[var(--fg)]">
          <thead className="bg-[var(--surface)] text-xs font-bold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border-soft)]">
            <tr>
              <th className="p-4">用户名</th>
              <th className="p-4">角色</th>
              <th className="p-4">状态</th>
              <th className="p-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)]">
            {users.map(u => (
              <tr key={u.username} className="hover:bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] transition">
                <td className="p-4 font-bold">{u.username}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    u.role === 'admin' ? 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] border border-[var(--accent)]' : 'bg-[var(--surface)] text-[var(--muted)]'
                  }`}>
                    {u.role === 'admin' ? '管理员' : '普通用户'}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    u.disabled ? 'bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]' : 'bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]'
                  }`}>
                    {u.disabled ? '已禁用' : '正常'}
                  </span>
                </td>
                <td className="p-4 text-right space-x-2">
                  {u.username !== currentUsername && (
                    <>
                      <button
                        onClick={() => toggleStatus(u.username, u.disabled)}
                        className={`px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-bold transition cursor-pointer ${
                          u.disabled ? 'bg-[var(--accent)] text-[var(--accent-on)]' : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)]'
                        }`}
                        type="button"
                      >
                        {u.disabled ? '启用' : '禁用'}
                      </button>
                      {u.role !== 'admin' && (
                        <button
                          onClick={() => deleteUser(u.username)}
                          className="px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-bold bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition cursor-pointer"
                          type="button"
                        >
                          删除
                        </button>
                      )}
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile layout: Card stack (Card List) */}
      <div className="block md:hidden space-y-3">
        {users.map(u => (
          <div
            key={u.username}
            className="p-4 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] space-y-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="font-bold text-base">{u.username}</span>
              <div className="space-x-1.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  u.role === 'admin' ? 'bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-[var(--accent)] border border-[var(--accent)]' : 'bg-[var(--surface)] text-[var(--muted)]'
                }`}>
                  {u.role === 'admin' ? '管理员' : '普通用户'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                  u.disabled ? 'bg-[color-mix(in_srgb,var(--danger)_15%,transparent)] text-[var(--danger)]' : 'bg-[color-mix(in_srgb,var(--success)_15%,transparent)] text-[var(--success)]'
                }`}>
                  {u.disabled ? '已禁用' : '正常'}
                </span>
              </div>
            </div>

            {/* Actions for mobile (ensure at least 44x44px touch region) */}
            {u.username !== currentUsername && (
              <div className="flex items-center justify-end gap-2 border-t border-[color-mix(in_srgb,var(--border-soft)_50%,transparent)] pt-3">
                <button
                  onClick={() => toggleStatus(u.username, u.disabled)}
                  className={`min-h-[44px] min-w-[70px] px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-bold transition cursor-pointer ${
                    u.disabled ? 'bg-[var(--accent)] text-[var(--accent-on)]' : 'bg-[var(--surface)] border border-[var(--border)] text-[var(--fg)]'
                  }`}
                  type="button"
                >
                  {u.disabled ? '启用账号' : '禁用账号'}
                </button>
                {u.role !== 'admin' && (
                  <button
                    onClick={() => deleteUser(u.username)}
                    className="min-h-[44px] min-w-[70px] px-3 py-1.5 rounded-[var(--radius-md)] text-xs font-bold bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-[var(--danger)] active:bg-[var(--danger)] active:text-white transition cursor-pointer"
                    type="button"
                  >
                    删除用户
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
