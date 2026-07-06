// 用户认证辅助函数
import crypto from 'node:crypto'

/** 生成 salt + 哈希密码（PBKDF2） */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return { salt, hash }
}

/** 校验密码 */
export function verifyPassword(password, salt, hash) {
  const verify = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex')
  return verify === hash
}

/**
 * 从请求的 cookie 中解析当前登录用户。
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:sqlite').DatabaseSync} db - 由调用方注入
 * @returns {Promise<{username: string, role?: string, disabled?: number} | null>}
 */
export async function getAuthenticatedUser(req, db) {
  const cookieHeader = req.headers.cookie || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const parts = c.trim().split('=')
      return [parts[0], parts.slice(1).join('=')]
    }),
  )
  const token = cookies['ep_session']
  if (!token) return null

  try {
    const user = db.prepare(`
      SELECT u.* FROM users u
      JOIN sessions s ON s.username = u.username
      WHERE s.token = ?
    `).get(token)

    if (!user || user.disabled) return null
    return user
  } catch (err) {
    return null
  }
}
