import path from 'node:path'
import { existsSync, rmSync } from 'node:fs'

// admin 域路由：用户管理（仅 admin 角色可访问）。
export async function handleAdminRoutes(req, res, url, ctx) {
  if (!url.pathname.startsWith('/api/admin/')) return false

  const { db, getAuthenticatedUser, parseJsonBody, json, resourceDir } = ctx

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

      // Delete all lessons created by this user and clean up their files on disk
      const lessons = db.prepare('SELECT id FROM lessons WHERE username = ?').all(username)
      for (const lesson of lessons) {
        const lessonDir = path.join(resourceDir, lesson.id)
        try {
          if (existsSync(lessonDir)) {
            rmSync(lessonDir, { recursive: true, force: true })
          }
        } catch (fsErr) {
          console.error('Failed to delete user lesson folder on user deletion:', lessonDir, fsErr)
        }
        db.prepare('DELETE FROM lessons WHERE id = ?').run(lesson.id)
        db.prepare('DELETE FROM reviews WHERE lessonId = ?').run(lesson.id)
      }

      // Delete user row
      db.prepare('DELETE FROM users WHERE username = ?').run(username)
      json(res, 200, { ok: true })
    } catch (err) {
      console.error('Delete user failed:', err)
      json(res, 500, { error: '删除用户失败' })
    }
    return true
  }

  // 4. POST /api/admin/users/reset-password
  if (url.pathname === '/api/admin/users/reset-password' && req.method === 'POST') {
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
        json(res, 400, { error: '无法重置管理员密码' })
        return true
      }
      const { hashPassword } = ctx
      const { salt, hash } = hashPassword('123456')
      db.prepare('UPDATE users SET salt = ?, passwordHash = ? WHERE username = ?').run(salt, hash, username)
      // Invalidate all existing sessions for this user
      db.prepare('DELETE FROM sessions WHERE username = ?').run(username)
      json(res, 200, { ok: true })
    } catch (err) {
      console.error('Reset password failed:', err)
      json(res, 500, { error: '重置密码失败' })
    }
    return true
  }

  return false
}
