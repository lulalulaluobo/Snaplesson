// auth 域路由：账号注册/登录/登出/当前用户/改密。
import crypto from 'node:crypto'

const SESSION_COOKIE = 'ep_session'
const COOKIE_ATTRS = 'Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000'

function readSessionToken(req) {
  const cookieHeader = req.headers.cookie || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const parts = c.trim().split('=')
      return [parts[0], parts.slice(1).join('=')]
    })
  )
  return cookies[SESSION_COOKIE]
}

function setSessionCookie(res, token) {
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'Set-Cookie': `${SESSION_COOKIE}=${token}; ${COOKIE_ATTRS}`,
  })
}

function clearSessionCookie(res) {
  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'Set-Cookie': `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`,
  })
}

export async function handleAuthRoutes(req, res, url, ctx) {
  if (!url.pathname.startsWith('/api/auth/')) return false

  const { db, getAuthenticatedUser, hashPassword, verifyPassword, parseJsonBody, json } = ctx

  // 1. POST /api/auth/register
  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    try {
      const { username, password } = await parseJsonBody(req)
      if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
        json(res, 400, { error: '账号和密码不能为空' })
        return true
      }
      const trimmedUsername = username.trim().toLowerCase()
      if (trimmedUsername.length < 2) {
        json(res, 400, { error: '账号长度必须大于等于 2 位' })
        return true
      }
      if (password.length < 4) {
        json(res, 400, { error: '密码长度必须大于等于 4 位' })
        return true
      }

      // Check if username already exists
      const existingUser = db.prepare('SELECT username FROM users WHERE username = ?').get(trimmedUsername)
      if (existingUser) {
        json(res, 400, { error: '账号已被注册' })
        return true
      }

      // Determine if this is the first user
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count
      const isFirst = userCount === 0
      const role = isFirst ? 'admin' : 'user'

      const { salt, hash } = hashPassword(password)
      db.prepare('INSERT INTO users (username, salt, passwordHash, role, disabled) VALUES (?, ?, ?, ?, 0)').run(trimmedUsername, salt, hash, role)

      // Create session
      const token = crypto.randomBytes(32).toString('hex')
      db.prepare('INSERT INTO sessions (token, username) VALUES (?, ?)').run(token, trimmedUsername)

      setSessionCookie(res, token)
      res.end(JSON.stringify({ username: trimmedUsername, role }))
    } catch (err) {
      console.error(err)
      const status = err && err.status ? err.status : 500
      json(res, status, { error: status === 413 ? '请求体过大' : '注册失败，请稍后重试' })
    }
    return true
  }

  // 2. POST /api/auth/login
  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    try {
      const { username, password } = await parseJsonBody(req)
      if (!username || !password) {
        json(res, 400, { error: '账号和密码不能为空' })
        return true
      }
      const trimmedUsername = username.trim().toLowerCase()
      const user = db.prepare('SELECT * FROM users WHERE username = ?').get(trimmedUsername)
      if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
        json(res, 400, { error: '账号或密码不正确' })
        return true
      }

      if (user.disabled === 1) {
        json(res, 403, { error: '该账号已被禁用，请联系管理员' })
        return true
      }

      // Create session
      const token = crypto.randomBytes(32).toString('hex')
      db.prepare('INSERT INTO sessions (token, username) VALUES (?, ?)').run(token, trimmedUsername)

      setSessionCookie(res, token)
      res.end(JSON.stringify({ username: trimmedUsername, role: user.role }))
    } catch (err) {
      console.error(err)
      const status = err && err.status ? err.status : 500
      json(res, status, { error: status === 413 ? '请求体过大' : '登录失败，请稍后重试' })
    }
    return true
  }

  // 3. POST /api/auth/logout
  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    try {
      const token = readSessionToken(req)
      if (token) {
        db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
      }
    } catch (e) {}

    clearSessionCookie(res)
    res.end(JSON.stringify({ ok: true }))
    return true
  }

  // 4. GET /api/auth/me
  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const user = await getAuthenticatedUser(req, db)
    if (!user) {
      json(res, 200, { user: null })
      return true
    }
    json(res, 200, { user: { username: user.username, role: user.role } })
    return true
  }

  // 5. POST /api/auth/reset-password
  if (req.method === 'POST' && url.pathname === '/api/auth/reset-password') {
    try {
      const user = await getAuthenticatedUser(req, db)
      if (!user) {
        json(res, 401, { error: '未登录' })
        return true
      }

      const { oldPassword, newPassword } = await parseJsonBody(req)
      if (!oldPassword || !newPassword || typeof oldPassword !== 'string' || typeof newPassword !== 'string') {
        json(res, 400, { error: '旧密码和新密码不能为空' })
        return true
      }

      if (!verifyPassword(oldPassword, user.salt, user.passwordHash)) {
        json(res, 400, { error: '旧密码不正确' })
        return true
      }

      if (newPassword.length < 4) {
        json(res, 400, { error: '新密码长度必须大于等于 4 位' })
        return true
      }

      const { salt, hash } = hashPassword(newPassword)
      db.prepare('UPDATE users SET salt = ?, passwordHash = ? WHERE username = ?').run(salt, hash, user.username)

      json(res, 200, { ok: true })
    } catch (err) {
      console.error(err)
      json(res, 500, { error: '修改密码失败，请稍后重试' })
    }
    return true
  }

  return false
}
