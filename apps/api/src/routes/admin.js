// admin 域路由：用户管理（仅 admin 角色可访问）。
export async function handleAdminRoutes(req, res, url, ctx) {
  if (!url.pathname.startsWith('/api/admin/')) return false

  const { db, getAuthenticatedUser, parseJsonBody, json } = ctx

  const user = await getAuthenticatedUser(req, db)
  if (!user || user.role !== 'admin') {
    json(res, 403, { error: '无权操作' })
    return true
  }

  // 1. GET /api/admin/users
  if (url.pathname === '/api/admin/users' && req.method === 'GET') {
    try {
      const list = db.prepare('SELECT username, role, disabled FROM users').all()
      const formattedList = list.map(u => ({
        username: u.username,
        role: u.role,
        disabled: u.disabled === 1
      }))
      json(res, 200, formattedList)
    } catch (err) {
      json(res, 500, { error: '获取用户列表失败' })
    }
    return true
  }

  // 2. POST /api/admin/users/status
  if (url.pathname === '/api/admin/users/status' && req.method === 'POST') {
    try {
      const { username, disabled } = await parseJsonBody(req)
      if (!username || username === user.username) {
        json(res, 400, { error: '非法操作' })
        return true
      }
      const target = db.prepare('SELECT username FROM users WHERE username = ?').get(username)
      if (!target) {
        json(res, 404, { error: '用户未找到' })
        return true
      }
      db.prepare('UPDATE users SET disabled = ? WHERE username = ?').run(disabled ? 1 : 0, username)
      json(res, 200, { ok: true })
    } catch (err) {
      json(res, 500, { error: '状态更新失败' })
    }
    return true
  }

  // 3. POST /api/admin/users/delete
  if (url.pathname === '/api/admin/users/delete' && req.method === 'POST') {
    try {
      const { username } = await parseJsonBody(req)
      if (!username || username === user.username) {
        json(res, 400, { error: '非法操作' })
        return true
      }
      const target = db.prepare('SELECT role FROM users WHERE username = ?').get(username)
      if (!target) {
        json(res, 404, { error: '用户未找到' })
        return true
      }
      if (target.role === 'admin') {
        json(res, 400, { error: '无法删除管理员账户' })
        return true
      }
      db.prepare('DELETE FROM users WHERE username = ?').run(username)
      json(res, 200, { ok: true })
    } catch (err) {
      console.error('Delete user failed:', err)
      json(res, 500, { error: '删除用户失败' })
    }
    return true
  }

  return false
}
