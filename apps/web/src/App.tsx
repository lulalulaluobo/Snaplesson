import { useEffect, useState } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { cn } from '@/lib/utils'

// Import pages (we will create them next)
import { LessonPage } from '@/pages/LessonPage'
import { CoursesPage } from '@/pages/CoursesPage'
import { VocabPage } from '@/pages/VocabPage'
import { LoginPage } from '@/pages/LoginPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AdminPage } from '@/pages/AdminPage'

const THEME_KEY = 'snaplesson-theme'
type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  const saved = window.localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)
  const [currentUser, setCurrentUserState] = useState<{ username: string; role: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me')
        const data = await res.json()
        if (data.user) {
          setCurrentUserState(data.user)
        } else {
          setCurrentUserState(null)
        }
      } catch (err) {
        console.error('Failed to check auth:', err)
        setCurrentUserState(null)
      } finally {
        setAuthChecked(true)
      }
    }
    checkAuth()
  }, [])

  const cycleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  if (!authChecked) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] text-[var(--muted)]">
        <p className="font-[var(--font-mono)] text-sm uppercase tracking-widest">加载中...</p>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-dvh bg-[var(--bg)] text-[var(--fg)]">
        <header className="flex h-14 items-center px-4 border-b border-[var(--border-soft)] md:px-7">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid size-7 place-items-center rounded-[var(--radius-sm)] bg-[var(--accent)] font-[var(--font-display)] text-sm font-bold text-[var(--accent-on)]">
              S
            </span>
            一拍成课 SnapLesson
          </div>
          <button
            onClick={cycleTheme}
            className="ml-auto p-2 rounded-full hover:bg-[var(--surface)] text-[var(--muted)]"
            type="button"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </header>
        <LoginPage onLoginSuccess={(profile) => setCurrentUserState(profile)} />
      </div>
    )
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {}
    setCurrentUserState(null)
  }

  return (
    <Routes>
      <Route
        path="/courses/:lessonId"
        element={
          <LessonPage
            theme={theme}
            onCycleTheme={cycleTheme}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        }
      />
      <Route
        path="/"
        element={
          <AppShell
            theme={theme}
            onCycleTheme={cycleTheme}
            currentUser={currentUser}
            onLogout={handleLogout}
          />
        }
      >
        <Route index element={<Navigate to="/courses" replace />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="vocab" element={<VocabPage />} />
        {currentUser.role === 'admin' && (
          <>
            <Route path="admin" element={<AdminPage currentUsername={currentUser.username} />} />
            <Route path="settings" element={<SettingsPage />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/courses" replace />} />
      </Route>
    </Routes>
  )
}

function AppShell({
  theme,
  onCycleTheme,
  currentUser,
  onLogout,
}: {
  theme: Theme
  onCycleTheme: () => void
  currentUser: { username: string; role: string }
  onLogout: () => void
}) {
  const dynamicNavItems: { to: string; label: string; eyebrow: string }[] = [
    { to: '/courses', label: '我的课程', eyebrow: 'Lessons' },
    { to: '/vocab', label: '我的收藏', eyebrow: 'Bookmarks' },
  ]
  if (currentUser.role === 'admin') {
    dynamicNavItems.push({ to: '/settings', label: '系统设置', eyebrow: 'Settings' })
    dynamicNavItems.push({ to: '/admin', label: '用户管理', eyebrow: 'Users' })
  }

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--fg)]">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] px-4 backdrop-blur-xl md:px-7">
        <Link to="/courses" className="flex items-center gap-2 font-semibold shrink-0">
          <span className="grid size-7 place-items-center rounded-[var(--radius-sm)] bg-[var(--accent)] font-[var(--font-display)] text-sm font-bold text-[var(--accent-on)]">
            S
          </span>
          <span className="font-semibold text-[var(--fg)]">一拍成课 SnapLesson</span>
        </Link>
        <div className="ml-auto flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted)] border-r border-[var(--border-soft)] pr-3 sm:pr-4">
            <span className="font-semibold text-[var(--fg)]">{currentUser.username}</span>
            <span className="rounded-full bg-[var(--surface-warm)] px-1.5 py-0.5 text-[10px] border border-[var(--border-soft)]">
              {currentUser.role === 'admin' ? '管理员' : '普通用户'}
            </span>
          </div>
          <button
            onClick={onLogout}
            className="text-xs font-semibold text-[var(--muted)] hover:text-[var(--danger)] transition cursor-pointer"
            type="button"
          >
            退出
          </button>
          <button
            onClick={onCycleTheme}
            className="p-2 rounded-full hover:bg-[var(--surface)] text-[var(--muted)] shrink-0"
            type="button"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
      </header>

      <div className="grid min-h-[calc(100dvh-56px)] grid-cols-1 md:grid-cols-[240px_1fr]">
        <aside className="border-b border-[var(--border-soft)] bg-[var(--surface-warm)] p-3 md:border-b-0 md:border-r">
          <nav className="grid gap-1 grid-cols-2 md:grid-cols-1">
            {dynamicNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-[var(--radius-md)] px-4 py-2.5 text-left transition hover:bg-[var(--surface)]',
                    isActive &&
                      'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]',
                  )
                }
              >
                <span className="block font-semibold text-sm">{item.label}</span>
                <span className="font-[var(--font-mono)] text-[10px] uppercase tracking-[0.08em] text-[var(--meta)]">
                  {item.eyebrow}
                </span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 px-4 py-6 md:px-8 lg:px-12">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default App
